import { Router } from "express";
import { scoresRouter } from "@/routes/scores";
import { rankingsRouter } from "@/routes/rankings";
import { boardsRouter } from "@/routes/boards";
import { playersRouter } from "@/routes/players";
import { adminRouter } from "@/routes/admin";
import { listSeasons } from "@/controllers/boards";

export const apiRouter = Router();

// Scores
apiRouter.use("/games/:gameId/boards/:boardId/scores", scoresRouter);

// Rankings
apiRouter.use("/games/:gameId/boards/:boardId", rankingsRouter);

// Boards
apiRouter.use("/games/:gameId/boards", boardsRouter);

// Seasons
apiRouter.get("/games/:gameId/seasons", listSeasons);

// Players
apiRouter.use("/games/:gameId/players", playersRouter);

// Admin
apiRouter.use("/admin", adminRouter);
