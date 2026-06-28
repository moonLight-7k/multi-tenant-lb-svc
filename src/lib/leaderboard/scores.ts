import { redis } from "@/clients/redis";
import { logger } from "@/utils/logger";
import { checkPipelineErrors } from "@/utils/redis";
import {
  KEY_PREFIX_IDEM,
  KEY_PREFIX_EVENTS,
  IDEM_TTL,
  key,
  applyTtl,
  isLowFirst,
  getStrategy,
} from "./internal";

export async function claimIdempotency(
  gameId: string,
  boardId: string,
  playerId: string,
  idempotencyKey: string,
  bodyHash: string,
): Promise<unknown> {
  const k = `${KEY_PREFIX_IDEM}:${gameId}:${boardId}:${playerId}:${idempotencyKey}`;
  const claimed = await redis.set(
    k,
    JSON.stringify({ h: bodyHash }),
    "EX",
    IDEM_TTL,
    "NX",
  );
  if (claimed) return null;
  const cached = await redis.get(k);
  if (!cached) return null;
  const entry = JSON.parse(cached);
  if (entry.h !== bodyHash) return "mismatch";
  return entry.r ?? false;
}

export async function setIdempotency(
  gameId: string,
  boardId: string,
  playerId: string,
  idempotencyKey: string,
  bodyHash: string,
  result: unknown,
): Promise<void> {
  await redis.set(
    `${KEY_PREFIX_IDEM}:${gameId}:${boardId}:${playerId}:${idempotencyKey}`,
    JSON.stringify({ h: bodyHash, r: result }),
    "EX",
    IDEM_TTL,
  );
}

export async function submitScore(
  gameId: string,
  boardId: string,
  playerId: string,
  score: number,
) {
  const k = key(gameId, boardId);
  const strategy = getStrategy(gameId, boardId);
  const low = isLowFirst(strategy);

  // ponytail: pre-read + write + ttl in one pipeline (6 round trips → 2-3)
  const pre = redis.pipeline();
  pre.zscore(k, playerId); // [0] previous score
  low ? pre.zrank(k, playerId) : pre.zrevrank(k, playerId); // [1] previous rank
  if (strategy === "increment") {
    pre.zincrby(k, score, playerId); // [2] write
  } else if (strategy === "lowest") {
    pre.zadd(k, "LT", score, playerId);
  } else if (strategy === "replace") {
    pre.zadd(k, score, playerId);
  } else {
    pre.zadd(k, "GT", score, playerId);
  }
  pre.ttl(k); // [3] current TTL
  const preRes = await pre.exec();
  checkPipelineErrors(preRes, "submitScore:pre");

  const previousScore = preRes![0][1] as string | null;
  const previousRank = preRes![1][1] as number | null;
  const currentTtl = preRes![3][1] as number;

  await applyTtl(gameId, boardId, k, currentTtl);

  // Post-read pipeline
  const post = redis.pipeline();
  low ? post.zrank(k, playerId) : post.zrevrank(k, playerId); // [0] new rank
  post.zscore(k, playerId); // [1] best score
  const postRes = await post.exec();
  checkPipelineErrors(postRes, "submitScore:post");

  const rank = postRes![0][1] as number | null;
  const bestScore = postRes![1][1] as string | null;

  const prev = previousScore !== null ? parseFloat(previousScore) : null;
  let newPersonalBest: boolean;
  if (prev === null) {
    newPersonalBest = true;
  } else if (strategy === "lowest") {
    newPersonalBest = score < prev;
  } else if (strategy === "increment" || strategy === "replace") {
    newPersonalBest = true;
  } else {
    newPersonalBest = score > prev;
  }

  const result = {
    rank: rank! + 1,
    previousRank: previousRank !== null ? previousRank + 1 : null,
    score,
    bestScore: parseFloat(bestScore!),
    newPersonalBest,
  };

  const event = { gameId, boardId, playerId, ...result, timestamp: Date.now() };
  redis
    .publish(
      `${KEY_PREFIX_EVENTS}:${gameId}:score_submitted`,
      JSON.stringify(event),
    )
    .catch((e) => logger.error("publish failed", { error: e.message }));
  if (previousRank !== null && rank !== previousRank) {
    redis
      .publish(
        `${KEY_PREFIX_EVENTS}:${gameId}:rank_changed`,
        JSON.stringify(event),
      )
      .catch((e) => logger.error("publish failed", { error: e.message }));
  }

  return result;
}

export async function submitScoresBatch(
  gameId: string,
  boardId: string,
  scores: { playerId: string; score: number }[],
) {
  const k = key(gameId, boardId);
  const strategy = getStrategy(gameId, boardId);
  const pipeline = redis.pipeline();

  for (const { playerId, score } of scores) {
    if (strategy === "increment") {
      pipeline.zincrby(k, score, playerId);
    } else if (strategy === "lowest") {
      pipeline.zadd(k, "LT", score, playerId);
    } else if (strategy === "replace") {
      pipeline.zadd(k, score, playerId);
    } else {
      pipeline.zadd(k, "GT", score, playerId);
    }
  }
  pipeline.ttl(k);
  const results = await pipeline.exec();
  const currentTtl = results![results!.length - 1][1] as number;
  const failed = checkPipelineErrors(
    results!.slice(0, -1) as [Error | null, unknown][],
    "submitScoresBatch",
  );
  await applyTtl(gameId, boardId, k, currentTtl);

  return { submitted: scores.length - failed, failed };
}
