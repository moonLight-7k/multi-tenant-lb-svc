import { gameConfig } from "@/config/games";
import type { GameConfig, BoardConfig } from "@/types/config";

export function findGame(gameId: string): GameConfig | undefined {
  return gameConfig.find((g) => g.id === gameId);
}

export function findBoard(
  game: GameConfig,
  boardId: string,
): BoardConfig | undefined {
  return game.boards.find((b) => b.id === boardId);
}

export function validateBoard(game: GameConfig, boardId: string): boolean {
  return game.boards.some((b) => b.id === boardId);
}
