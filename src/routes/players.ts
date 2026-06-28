import { Router } from "express";
import { auth } from "@/middleware/auth";
import * as playersController from "@/controllers/players";

export const playersRouter = Router({ mergeParams: true });

playersRouter.get("/me", auth, playersController.getPlayerBoards);
