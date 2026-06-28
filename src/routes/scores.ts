import { Router } from "express";
import { auth } from "@/middleware/auth";
import { validate } from "@/middleware/validate";
import {
  submitScoreBody,
  batchScoreBody,
  gameAndBoardParams,
} from "@/schemas/scores";
import * as scoresController from "@/controllers/scores";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { env } from "@/config/environment";
import { RATE_LIMIT_STANDARD_HEADERS, DEFAULT_IP } from "@/config/constant";

export const scoresRouter = Router({ mergeParams: true });

const playerRateLimit = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: RATE_LIMIT_STANDARD_HEADERS,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const gameId = req.params?.gameId || "global";
    const playerId = req.user?.playerId;
    const ip = ipKeyGenerator(req.ip || DEFAULT_IP);
    return playerId ? `${gameId}:${playerId}` : `${gameId}:${ip}`;
  },
});

scoresRouter.post(
  "/",
  auth,
  playerRateLimit,
  validate({ params: gameAndBoardParams, body: submitScoreBody }),
  scoresController.submitScore,
);

scoresRouter.post(
  "/batch",
  auth,
  playerRateLimit,
  validate({ params: gameAndBoardParams, body: batchScoreBody }),
  scoresController.submitScoresBatch,
);
