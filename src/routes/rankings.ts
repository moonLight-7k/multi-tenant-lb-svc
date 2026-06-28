import { Router } from "express";
import { auth } from "@/middleware/auth";
import { validate } from "@/middleware/validate";
import { gameAndBoardParams } from "@/schemas/scores";
import {
  topPlayersQuery,
  playerIdParams,
  aroundPlayerQuery,
  batchRanksBody,
  friendsBody,
} from "@/schemas/rankings";
import * as rankingsController from "@/controllers/rankings";

export const rankingsRouter = Router({ mergeParams: true });

rankingsRouter.get(
  "/top",
  validate({ params: gameAndBoardParams, query: topPlayersQuery }),
  rankingsController.getTopPlayers,
);

rankingsRouter.get(
  "/rank/:playerId",
  validate({ params: playerIdParams }),
  rankingsController.getPlayerRank,
);

rankingsRouter.get(
  "/around/:playerId",
  validate({ params: playerIdParams, query: aroundPlayerQuery }),
  rankingsController.getAroundPlayer,
);

rankingsRouter.post(
  "/ranks",
  validate({ params: gameAndBoardParams, body: batchRanksBody }),
  rankingsController.batchGetRanks,
);

rankingsRouter.post(
  "/friends",
  auth,
  validate({ params: gameAndBoardParams, body: friendsBody }),
  rankingsController.getFriendsLeaderboard,
);
