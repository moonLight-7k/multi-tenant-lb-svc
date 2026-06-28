import type { Request, Response } from "express";
import { createHash } from "node:crypto";
import { sendSuccess, sendError } from "@/utils/response";
import * as leaderboard from "@/lib/leaderboard";

export async function submitScore(req: Request, res: Response) {
  const { gameId, boardId } = req.params as Record<string, string>;
  const { score } = req.body;
  const playerId = req.user?.playerId;

  if (!playerId) {
    sendError(req, res, "MISSING_PLAYER_ID", "playerId is required", 400);
    return;
  }

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

  if (await leaderboard.isBoardFrozen(gameId, boardId)) {
    sendError(
      req,
      res,
      "BOARD_FROZEN",
      "Board is frozen, scores not accepted",
      423,
    );
    return;
  }

  // Idempotency check
  const idempotencyKey = req.headers["idempotency-key"] as string | undefined;
  const bodyHash = idempotencyKey
    ? createHash("sha256")
        .update(JSON.stringify(req.body))
        .digest("hex")
        .slice(0, 16)
    : "";
  if (idempotencyKey) {
    const cached = await leaderboard.claimIdempotency(
      gameId,
      boardId,
      playerId,
      idempotencyKey,
      bodyHash,
    );
    if (cached === "mismatch") {
      sendError(
        req,
        res,
        "IDEMPOTENCY_MISMATCH",
        "Idempotency key already used with different request body",
        409,
      );
      return;
    }
    if (cached === false) {
      sendError(
        req,
        res,
        "IDEMPOTENCY_CONFLICT",
        "Request is already being processed",
        409,
      );
      return;
    }
    if (cached) {
      sendSuccess(req, res, cached, "Score submitted (idempotent)", 201);
      return;
    }
  }

  const result = await leaderboard.submitScore(
    gameId,
    boardId,
    playerId,
    score,
  );

  const response = {
    accepted: true,
    ...result,
    submittedAt: new Date().toISOString(),
  };

  if (idempotencyKey) {
    await leaderboard.setIdempotency(
      gameId,
      boardId,
      playerId,
      idempotencyKey,
      bodyHash,
      response,
    );
  }

  sendSuccess(req, res, response, "Score submitted", 201);
}

export async function submitScoresBatch(req: Request, res: Response) {
  if (!req.headers["x-api-key"]) {
    sendError(
      req,
      res,
      "API_KEY_REQUIRED",
      "Batch submission requires API key authentication",
      403,
    );
    return;
  }

  const gameId = req.params.gameId as string;
  const boardId = req.params.boardId as string;
  const { scores } = req.body;

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

  if (await leaderboard.isBoardFrozen(gameId, boardId)) {
    sendError(
      req,
      res,
      "BOARD_FROZEN",
      "Board is frozen, scores not accepted",
      423,
    );
    return;
  }

  const result = await leaderboard.submitScoresBatch(gameId, boardId, scores);

  sendSuccess(
    req,
    res,
    {
      ...result,
      results: [],
    },
    "Batch scores submitted",
    201,
  );
}
