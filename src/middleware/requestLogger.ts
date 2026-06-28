import type { Request, Response, NextFunction } from "express";
import { logger } from "@/utils/logger";

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const log = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      requestId: req.requestId,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    };

    if (res.statusCode >= 500) {
      logger.error("request failed", log);
    } else if (res.statusCode >= 400) {
      logger.warn("request error", log);
    } else {
      logger.info("request completed", log);
    }
  });

  next();
}
