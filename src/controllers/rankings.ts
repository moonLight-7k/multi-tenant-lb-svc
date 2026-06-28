import type { Request, Response } from "express";
import { createHash } from "node:crypto";
import { sendSuccess, sendError } from "@/utils/response";
import * as leaderboard from "@/lib";

function etag(req: Request, res: Response, data: unknown): boolean {
  const hash = `"${createHash("md5").update(JSON.stringify(data)).digest("hex")}"`; // ponytail: md5 is fine for etag, not security
  res.setHeader("ETag", hash);
  if (req.headers["if-none-match"] === hash) {
    res.status(304).end();
    return true;
  }
  return false;
}

export async function getTopPlayers(req: Request, res: Response) {
  const { gameId, boardId } = req.params as Record<string, string>;
  const { limit, cursor } = req.query as unknown as {
    limit: number;
    cursor?: string;
  };

  const offset = cursor ? parseInt(cursor) || 0 : 0;
  const entries = await leaderboard.getTopPlayers(
    gameId,
    boardId,
    limit,
    offset,
  );

  const total = await leaderboard.getBoardSize(gameId, boardId);
  const hasMore = offset + entries.length < total;
  const nextCursor = hasMore ? String(offset + limit) : undefined;
  const extraMeta = { total, cursor: nextCursor, hasMore };

  if (etag(req, res, { data: entries, ...extraMeta })) return;
  sendSuccess(req, res, entries, "Top players retrieved", 200, extraMeta);
}

export async function getPlayerRank(req: Request, res: Response) {
  const { gameId, boardId, playerId } = req.params as Record<string, string>;

  const result = await leaderboard.getPlayerRank(gameId, boardId, playerId);
  if (!result) {
    sendError(
      req,
      res,
      "PLAYER_NOT_FOUND",
      "Player not found on this board",
      404,
    );
    return;
  }

  if (etag(req, res, result)) return;
  sendSuccess(req, res, result, "Player rank retrieved");
}

export async function getAroundPlayer(req: Request, res: Response) {
  const { gameId, boardId, playerId } = req.params as Record<string, string>;
  const { range } = req.query as unknown as { range: number };

  const allEntries = await leaderboard.getAroundPlayer(
    gameId,
    boardId,
    playerId,
    range,
  );
  if (!allEntries) {
    sendError(
      req,
      res,
      "PLAYER_NOT_FOUND",
      "Player not found on this board",
      404,
    );
    return;
  }

  const playerIdx = allEntries.findIndex((e) => e.playerId === playerId);
  const data = {
    above: allEntries.slice(0, playerIdx),
    player: allEntries[playerIdx],
    below: allEntries.slice(playerIdx + 1),
  };

  if (etag(req, res, data)) return;
  sendSuccess(req, res, data, "Surrounding players retrieved");
}

export async function batchGetRanks(req: Request, res: Response) {
  const { gameId, boardId } = req.params as Record<string, string>;
  const { playerIds } = req.body;

  const results = await leaderboard.batchGetRanks(gameId, boardId, playerIds);
  const data = results.map((r) => ({ ...r, found: r.rank !== null }));

  if (etag(req, res, data)) return;
  sendSuccess(req, res, data, "Batch ranks retrieved");
}

export async function getFriendsLeaderboard(req: Request, res: Response) {
  const { gameId, boardId } = req.params as Record<string, string>;
  const { playerIds } = req.body;

  const entries = await leaderboard.getFriendsLeaderboard(
    gameId,
    boardId,
    playerIds,
  );

  if (etag(req, res, entries)) return;
  sendSuccess(req, res, entries, "Friends leaderboard retrieved");
}
