import { Router } from "express";
import { serviceAuth } from "@/middleware/auth";
import * as adminController from "@/controllers/admin";

export const adminRouter = Router();

adminRouter.use(serviceAuth);

adminRouter.post(
  "/games/:gameId/boards/:boardId/reset",
  adminController.resetBoard,
);

adminRouter.delete(
  "/games/:gameId/boards/:boardId/players/:playerId",
  adminController.removePlayer,
);

adminRouter.post(
  "/games/:gameId/boards/:boardId/freeze",
  adminController.freezeBoard,
);

adminRouter.post(
  "/games/:gameId/boards/:boardId/unfreeze",
  adminController.unfreezeBoard,
);
