import { redis } from "@/clients/redis";
import { KEY_PREFIX_FREEZE, key } from "./internal";

/** DEL the sorted set key for a board */
export async function resetBoard(gameId: string, boardId: string) {
  const k = key(gameId, boardId);
  return redis.del(k);
}

/** ZREM a player from a board */
export async function removePlayer(
  gameId: string,
  boardId: string,
  playerId: string,
) {
  const k = key(gameId, boardId);
  return redis.zrem(k, playerId);
}

/** Freeze/unfreeze a board — writes blocked when frozen */
export async function freezeBoard(gameId: string, boardId: string) {
  await redis.set(`${KEY_PREFIX_FREEZE}:${gameId}:${boardId}`, "1");
}

export async function unfreezeBoard(gameId: string, boardId: string) {
  await redis.del(`${KEY_PREFIX_FREEZE}:${gameId}:${boardId}`);
}

export async function isBoardFrozen(
  gameId: string,
  boardId: string,
): Promise<boolean> {
  return (
    (await redis.exists(`${KEY_PREFIX_FREEZE}:${gameId}:${boardId}`)) === 1
  );
}
