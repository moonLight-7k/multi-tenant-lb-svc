import type { Request, Response } from "express";
import { sendSuccess, sendError } from "@/utils/response";
import * as leaderboard from "@/lib";

export async function listBoards(req: Request, res: Response) {
  const { gameId } = req.params as Record<string, string>;

  const game = leaderboard.findGame(gameId);
  if (!game) {
    sendError(req, res, "GAME_NOT_FOUND", "Game not found", 404);
    return;
  }

  const boards = await Promise.all(
    game.boards.map(async (board) => ({
      id: board.id,
      strategy: board.strategy,
      playerCount: await leaderboard.getBoardSize(gameId, board.id),
    })),
  );

  sendSuccess(req, res, boards, "Boards retrieved");
}

export async function listSeasons(_req: Request, res: Response) {
  // TODO: query seasons from Postgres

  sendSuccess(_req, res, [], "Seasons retrieved");
}
