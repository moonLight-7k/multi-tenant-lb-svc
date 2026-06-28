import type { Request, Response, NextFunction } from "express";
import { metrics, trace } from "@opentelemetry/api";
import { logger } from "@/utils/logger";

const httpDuration = metrics
  .getMeter("leaderboard")
  .createHistogram("http.server.request.duration", {
    description: "HTTP request duration in milliseconds",
    unit: "ms",
  });

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  // Populate traceId from active OTel span for downstream use (buildMeta, logs)
  const spanContext = trace.getActiveSpan()?.spanContext();
  if (spanContext) {
    req.traceId = spanContext.traceId;
  }

  res.on("finish", () => {
    const duration = Date.now() - start;
    const route = req.route?.path || req.originalUrl;
    const method = req.method;
    const status = res.statusCode;

    httpDuration.record(duration, {
      "http.method": method,
      "http.route": route,
      "http.status_code": status,
    });

    const log = {
      method,
      url: req.originalUrl,
      route,
      status,
      duration: `${duration}ms`,
      requestId: req.requestId,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      traceId: spanContext?.traceId,
      spanId: spanContext?.spanId,
    };

    if (status >= 500) {
      logger.error("request failed", log);
    } else if (status >= 400) {
      logger.warn("request error", log);
    } else {
      logger.info("request completed", log);
    }
  });

  next();
}
