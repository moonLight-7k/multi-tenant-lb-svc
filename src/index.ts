import * as Sentry from "@sentry/node";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import swaggerUi from "swagger-ui-express";
import { apiRouter } from "@/routes";
import { env } from "@/config/environment";
import {
  RATE_LIMIT_STANDARD_HEADERS,
  DEFAULT_IP,
  CORS_METHODS,
  CORS_ALLOWED_HEADERS,
  API_PREFIX,
  DOCS_PATH,
  DOCS_JSON_PATH,
  HEALTH_PATH,
  READY_PATH,
  LIVE_PATH,
  VERSION_PATH,
  STATUS_OK,
  STATUS_DEGRADED,
  STATUS_NOT_READY,
} from "@/config/constant";
import { requestLogger } from "@/middleware/requestLogger";
import { redis } from "@/clients/redis";
import { logger } from "@/utils/logger";

const spec = parse(readFileSync(resolve("docs/contract.yaml"), "utf8"));

const app = express();

app.use(
  cors({
    origin:
      env.ALLOWED_ORIGINS.length === 1 && env.ALLOWED_ORIGINS[0] === "*"
        ? "*"
        : env.ALLOWED_ORIGINS,
    methods: [...CORS_METHODS],
    allowedHeaders: [...CORS_ALLOWED_HEADERS],
  }),
);

app.use(helmet());

app.use(compression());

const limiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: RATE_LIMIT_STANDARD_HEADERS,
  legacyHeaders: false,
  message: env.RATE_LIMIT_MESSAGE,
  // ponytail: no route params at this level. Per-game+player limit on score routes.
  keyGenerator: (req: express.Request) => ipKeyGenerator(req.ip || DEFAULT_IP),
});
app.use(limiter);

app.use(express.json({ limit: env.JSON_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: env.URL_ENCODED_LIMIT }));

app.use(
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const requestId = randomUUID();
    req.requestId = requestId;
    res.setHeader("X-Request-Id", requestId);
    next();
  },
);

app.use(requestLogger);

// API docs
app.use(DOCS_PATH, swaggerUi.serve, swaggerUi.setup(spec));
app.get(DOCS_JSON_PATH, (_req, res) => res.json(spec));

// Routes
app.use(API_PREFIX, apiRouter);

// System endpoints
app.get(HEALTH_PATH, async (_req, res) => {
  try {
    await redis.ping();
    res.json({ status: STATUS_OK });
  } catch {
    res.status(503).json({ status: STATUS_DEGRADED, redis: "unreachable" });
  }
});

app.get(READY_PATH, async (_req, res) => {
  try {
    await redis.ping();
    res.json({ status: STATUS_OK });
  } catch {
    res.status(503).json({ status: STATUS_NOT_READY });
  }
});

app.get(LIVE_PATH, (_req, res) => {
  res.json({ status: STATUS_OK });
});

app.get(VERSION_PATH, (_req, res) => {
  res.json({
    version: env.BUILD_VERSION,
    commit: env.GIT_COMMIT,
    builtAt: env.BUILD_TIME,
  });
});

if (!env.SERVICE_TOKEN) {
  logger.warn("SERVICE_TOKEN not set — admin API will reject all requests");
}

// Sentry error handler — must be after all routes
Sentry.setupExpressErrorHandler(app);

// Final error handler — JSON response instead of Express default HTML
app.use(
  (
    err: Error & { status?: number; statusCode?: number },
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const status = err.status || err.statusCode || 500;
    res.status(status).json({
      status: "error",
      code: status,
      message: err.message || "Internal Server Error",
      meta: {
        requestId: req.requestId,
        traceId: req.traceId,
      },
    });
  },
);

export { app, env };
