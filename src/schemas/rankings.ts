import { z } from "zod";

export const topPlayersQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().regex(/^\d+$/).optional(),
  seasonId: z.string().optional(),
  country: z
    .string()
    .length(2)
    .regex(/^[A-Z]{2}$/)
    .optional(),
  platform: z.enum(["ios", "android", "web", "pc", "console"]).optional(),
  league: z.string().optional(),
});

export const playerIdParams = z.object({
  gameId: z.string().min(1),
  boardId: z.string().min(1),
  playerId: z.string().min(1),
});

export const aroundPlayerQuery = z.object({
  range: z.coerce.number().int().min(1).max(50).default(5),
  seasonId: z.string().optional(),
});

export const batchRanksBody = z.object({
  playerIds: z
    .array(z.string().min(1))
    .min(1, "At least 1 player ID required")
    .max(100, "Maximum 100 player IDs"),
});

export const friendsBody = z.object({
  playerIds: z
    .array(z.string().min(1))
    .min(1, "At least 1 player ID required")
    .max(200, "Maximum 200 player IDs"),
});
