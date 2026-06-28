import { z } from "zod";

export const submitScoreBody = z.object({
  score: z.number({ message: "Score must be a number" }),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const batchScoreBody = z.object({
  scores: z
    .array(
      z.object({
        playerId: z.string().min(1),
        score: z.number(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .min(1, "At least 1 score required")
    .max(100, "Maximum 100 scores per batch"),
});

export const gameAndBoardParams = z.object({
  gameId: z.string().min(1),
  boardId: z.string().min(1),
});
