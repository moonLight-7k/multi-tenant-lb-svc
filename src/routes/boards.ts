import { Router } from "express";
import * as boardsController from "@/controllers/boards";

export const boardsRouter = Router({ mergeParams: true });

boardsRouter.get("/", boardsController.listBoards);
