import { redis } from "@/clients/redis";
import { gameConfig } from "@/config/games";
import type { ResetInterval, ScoringStrategy } from "@/types/config";

export {
  KEY_PREFIX_IDEM,
  KEY_PREFIX_FREEZE,
  KEY_PREFIX_EVENTS,
  IDEM_TTL,
} from "@/config/constant";

export function currentPeriod(interval?: ResetInterval): string {
  if (!interval) return "";
  const now = new Date();
  if (interval === "daily") return now.toISOString().slice(0, 10); // YYYY-MM-DD
  if (interval === "monthly") return now.toISOString().slice(0, 7); // YYYY-MM
  const d = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
  );
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function key(gameId: string, boardId: string): string {
  const game = gameConfig.find((g) => g.id === gameId);
  const board = game?.boards.find((b) => b.id === boardId);
  const period = currentPeriod(board?.resetInterval);
  return period
    ? `board:${gameId}:${boardId}:${period}`
    : `board:${gameId}:${boardId}`;
}

// ponytail: skips EXPIRE when TTL already set — saves a write on every score after the first
export async function applyTtl(
  gameId: string,
  boardId: string,
  k: string,
  currentTtl?: number,
): Promise<void> {
  if (currentTtl !== undefined && currentTtl >= 0) return;
  const game = gameConfig.find((g) => g.id === gameId);
  const ttl = game?.ttl[boardId];
  if (ttl) await redis.expire(k, ttl);
}

export function isLowFirst(strategy: ScoringStrategy): boolean {
  return strategy === "lowest";
}

export function getStrategy(gameId: string, boardId: string): ScoringStrategy {
  const game = gameConfig.find((g) => g.id === gameId);
  return game?.boards.find((b) => b.id === boardId)?.strategy ?? "highest";
}
