import type { Request, Response, NextFunction } from "express";
import { env } from "@/config/environment";
import { gameConfig } from "@/config/games";
import { sendError } from "@/utils/response";
import {
  verifyApiKey,
  verifyServiceToken,
  verifyJwt,
  verifyGrpc,
} from "@/auth";

export async function auth(req: Request, res: Response, next: NextFunction) {
  // X-API-Key: service-to-service, no player identity
  const apiKey = req.headers["x-api-key"] as string | undefined;
  if (apiKey) {
    try {
      verifyApiKey(apiKey);
    } catch {
      sendError(req, res, "INVALID_API_KEY", "Invalid API key", 401);
      return;
    }
    req.user = { playerId: req.body?.playerId };
    next();
    return;
  }

  // Bearer token
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    sendError(
      req,
      res,
      "MISSING_TOKEN",
      "Missing or malformed authorization header",
      401,
    );
    return;
  }

  const token = header.slice(7);

  // Per-game JWT secret, fall back to global
  const gameId = req.params.gameId;
  const game = gameId ? gameConfig.find((g) => g.id === gameId) : undefined;
  const jwtSecret =
    game?.auth?.type === "jwt" && game.auth.secret
      ? game.auth.secret
      : env.JWT_SECRET;

  if (jwtSecret) {
    try {
      const playerId = await verifyJwt(token, jwtSecret);
      req.user = { playerId };
      next();
    } catch {
      sendError(req, res, "INVALID_TOKEN", "Token verification failed", 401);
    }
    return;
  }

  // gRPC auth: delegate token verification to the game's auth service
  if (game?.auth?.type === "grpc" && game.auth.url) {
    try {
      const playerId = await verifyGrpc(game.auth.url, token, game.id);
      req.user = { playerId };
      next();
    } catch {
      sendError(
        req,
        res,
        "AUTH_UNAVAILABLE",
        "Authentication service unavailable",
        503,
      );
    }
    return;
  }

  sendError(
    req,
    res,
    "NO_AUTH_CONFIGURED",
    "No authentication method configured",
    501,
  );
}

/** Admin-only: requires X-Service-Token header */
export function serviceAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers["x-service-token"] as string | undefined;
  try {
    verifyServiceToken(token!);
    next();
  } catch {
    sendError(req, res, "FORBIDDEN", "Invalid or missing service token", 403);
  }
}
