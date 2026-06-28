import type { Request, Response } from "express";
import { sendSuccess, sendError } from "@/utils/response";
import * as leaderboard from "@/lib";

export async function getPlayerBoards(req: Request, res: Response) {
  const { gameId } = req.params as Record<string, string>;
  const playerId = req.user?.playerId;

  if (!playerId) {
    sendError(req, res, "MISSING_PLAYER_ID", "playerId is required", 400);
    return;
  }

  const game = leaderboard.findGame(gameId);
  if (!game) {
    sendError(req, res, "GAME_NOT_FOUND", "Game not found", 404);
    return;
  }

  const boardIds = game.boards.map((b) => b.id);
  const boards = await leaderboard.getPlayerBoardRanks(
    gameId,
    boardIds,
    playerId,
  );

  sendSuccess(
    req,
    res,
    {
      playerId,
      boards,
    },
    "Player ranks retrieved",
  );
}
