import { redis } from "@/clients/redis";
import { checkPipelineErrors } from "@/utils/redis";
import { key, isLowFirst, getStrategy } from "./internal";

export async function getTopPlayers(
  gameId: string,
  boardId: string,
  limit: number,
  offset: number,
) {
  const k = key(gameId, boardId);
  const low = isLowFirst(getStrategy(gameId, boardId));
  const raw = low
    ? await redis.zrange(k, offset, offset + limit - 1, "WITHSCORES")
    : await redis.zrevrange(k, offset, offset + limit - 1, "WITHSCORES");

  const entries = [];
  for (let i = 0; i < raw.length; i += 2) {
    entries.push({
      playerId: raw[i],
      score: parseFloat(raw[i + 1]),
      rank: offset + i / 2 + 1,
    });
  }
  return entries;
}

export async function getPlayerRank(
  gameId: string,
  boardId: string,
  playerId: string,
) {
  const k = key(gameId, boardId);
  const low = isLowFirst(getStrategy(gameId, boardId));
  const pipeline = redis.pipeline();
  low ? pipeline.zrank(k, playerId) : pipeline.zrevrank(k, playerId);
  pipeline.zscore(k, playerId);
  pipeline.zcard(k);
  const results = await pipeline.exec();
  checkPipelineErrors(results, "getPlayerRank");

  const rank = results![0][1] as number | null;
  if (rank === null) return null;

  return {
    playerId,
    rank: rank + 1,
    score: parseFloat(results![1][1] as string),
    total: results![2][1] as number,
  };
}

export async function getAroundPlayer(
  gameId: string,
  boardId: string,
  playerId: string,
  range: number,
) {
  const k = key(gameId, boardId);
  const low = isLowFirst(getStrategy(gameId, boardId));
  const rank = low
    ? await redis.zrank(k, playerId)
    : await redis.zrevrank(k, playerId);
  if (rank === null) return null;

  const start = Math.max(0, rank - range);
  const stop = rank + range;
  const raw = low
    ? await redis.zrange(k, start, stop, "WITHSCORES")
    : await redis.zrevrange(k, start, stop, "WITHSCORES");

  const entries = [];
  for (let i = 0; i < raw.length; i += 2) {
    entries.push({
      playerId: raw[i],
      score: parseFloat(raw[i + 1]),
      rank: start + i / 2 + 1,
    });
  }
  return entries;
}

export async function batchGetRanks(
  gameId: string,
  boardId: string,
  playerIds: string[],
) {
  const k = key(gameId, boardId);
  const low = isLowFirst(getStrategy(gameId, boardId));
  const pipeline = redis.pipeline();
  for (const id of playerIds) {
    low ? pipeline.zrank(k, id) : pipeline.zrevrank(k, id);
    pipeline.zscore(k, id);
  }
  const results = await pipeline.exec();
  checkPipelineErrors(results, "batchGetRanks");

  return playerIds.map((playerId, i) => {
    const rank = results![i * 2][1] as number | null;
    const score = results![i * 2 + 1][1] as string | null;
    if (rank === null) return { playerId, rank: null, score: null };
    return { playerId, rank: rank + 1, score: parseFloat(score!) };
  });
}

export async function getFriendsLeaderboard(
  gameId: string,
  boardId: string,
  playerIds: string[],
) {
  const k = key(gameId, boardId);
  const low = isLowFirst(getStrategy(gameId, boardId));
  const pipeline = redis.pipeline();
  for (const id of playerIds) {
    pipeline.zscore(k, id);
  }
  const results = await pipeline.exec();
  checkPipelineErrors(results, "getFriendsLeaderboard");

  const entries = playerIds
    .map((playerId, i) => {
      const score = results![i][1] as string | null;
      if (score === null) return null;
      return { playerId, score: parseFloat(score) };
    })
    .filter((e): e is { playerId: string; score: number } => e !== null)
    .sort((a, b) => (low ? a.score - b.score : b.score - a.score))
    .map((e, i) => ({ ...e, rank: i + 1 }));

  return entries;
}

export async function getBoardSize(gameId: string, boardId: string) {
  return redis.zcard(key(gameId, boardId));
}

export async function getPlayerBoardRanks(
  gameId: string,
  boards: string[],
  playerId: string,
) {
  const pipeline = redis.pipeline();
  for (const boardId of boards) {
    const k = key(gameId, boardId);
    const low = isLowFirst(getStrategy(gameId, boardId));
    low ? pipeline.zrank(k, playerId) : pipeline.zrevrank(k, playerId);
    pipeline.zscore(k, playerId);
  }
  const results = await pipeline.exec();
  checkPipelineErrors(results, "getPlayerBoardRanks");

  return boards.map((boardId, i) => {
    const rank = results![i * 2][1] as number | null;
    const score = results![i * 2 + 1][1] as string | null;
    if (rank === null) return { boardId, rank: null, score: null };
    return { boardId, rank: rank + 1, score: parseFloat(score!) };
  });
}
