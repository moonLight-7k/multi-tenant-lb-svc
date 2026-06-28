import type { Request, Response } from "express";
import { createHash } from "node:crypto";
import { sendSuccess, sendError } from "@/utils/response";
import * as leaderboard from "@/lib/leaderboard";

export async function resetBoard(req: Request, res: Response) {
  const { gameId, boardId } = req.params as Record<string, string>;

  const game = leaderboard.findGame(gameId);
  if (!game || !leaderboard.validateBoard(game, boardId)) {
    sendError(
      req,
      res,
      "INVALID_GAME_OR_BOARD",
      "Game or board not found",
      404,
    );
    return;
  }

  await leaderboard.resetBoard(gameId, boardId);
  sendSuccess(req, res, { gameId, boardId }, "Board reset");
}

export async function removePlayer(req: Request, res: Response) {
  const { gameId, boardId, playerId } = req.params as Record<string, string>;

  const game = leaderboard.findGame(gameId);
  if (!game || !leaderboard.validateBoard(game, boardId)) {
    sendError(
      req,
      res,
      "INVALID_GAME_OR_BOARD",
      "Game or board not found",
      404,
    );
    return;
  }

  const current = await leaderboard.getPlayerRank(gameId, boardId, playerId);
  if (!current) {
    sendError(
      req,
      res,
      "PLAYER_NOT_FOUND",
      "Player not found on this board",
      404,
    );
    return;
  }

  const ifMatch = req.headers["if-match"] as string | undefined;
  if (!ifMatch) {
    sendError(
      req,
      res,
      "PRECONDITION_REQUIRED",
      "If-Match header is required",
      412,
    );
    return;
  }

  const currentEtag = `"${createHash("md5").update(JSON.stringify(current)).digest("hex")}"`;
  if (ifMatch !== currentEtag) {
    sendError(
      req,
      res,
      "PRECONDITION_FAILED",
      "ETag mismatch — player state has changed",
      412,
    );
    return;
  }

  await leaderboard.removePlayer(gameId, boardId, playerId);
  res.status(204).end();
}

export async function freezeBoard(req: Request, res: Response) {
  const { gameId, boardId } = req.params as Record<string, string>;

  const game = leaderboard.findGame(gameId);
  if (!game || !leaderboard.validateBoard(game, boardId)) {
    sendError(
      req,
      res,
      "INVALID_GAME_OR_BOARD",
      "Game or board not found",
      404,
    );
    return;
  }

  await leaderboard.freezeBoard(gameId, boardId);
  sendSuccess(req, res, { gameId, boardId, frozen: true }, "Board frozen");
}

export async function unfreezeBoard(req: Request, res: Response) {
  const { gameId, boardId } = req.params as Record<string, string>;

  const game = leaderboard.findGame(gameId);
  if (!game || !leaderboard.validateBoard(game, boardId)) {
    sendError(
      req,
      res,
      "INVALID_GAME_OR_BOARD",
      "Game or board not found",
      404,
    );
    return;
  }

  await leaderboard.unfreezeBoard(gameId, boardId);
  sendSuccess(req, res, { gameId, boardId, frozen: false }, "Board unfrozen");
}
