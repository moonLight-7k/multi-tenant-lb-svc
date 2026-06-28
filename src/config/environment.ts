import "dotenv/config";

export const env = {
  PORT: parseInt(process.env.PORT || "3000"),
  NODE_ENV: process.env.NODE_ENV || "development",

  // Redis
  REDIS_URL: process.env.REDIS_URL!,
  REDIS_KEY_PREFIX: process.env.REDIS_KEY_PREFIX || "lb",

  // Database
  DATABASE_URL: process.env.DATABASE_URL!,

  // Auth
  JWT_SECRET: process.env.JWT_SECRET,
  AUTH_GRPC_URL: process.env.AUTH_GRPC_URL,
  API_KEY: process.env.API_KEY, // X-API-Key for service-to-service
  SERVICE_TOKEN: process.env.SERVICE_TOKEN, // X-Service-Token for admin

  // Game-specific
  CHESS_JWT_SECRET: process.env.CHESS_JWT_SECRET,
  POKER_GRPC_URL: process.env.POKER_GRPC_URL,

  // Observability
  SENTRY_DSN: process.env.SENTRY_DSN,
  SENTRY_TRACES_SAMPLE_RATE: parseFloat(
    process.env.SENTRY_TRACES_SAMPLE_RATE || "1.0",
  ),

  // Build metadata — baked by esbuild define, env fallback for dev (tsx)
  BUILD_VERSION: process.env.BUILD_VERSION || "0.0.0-dev",
  GIT_COMMIT: process.env.GIT_COMMIT || "unknown",
  BUILD_TIME: process.env.BUILD_TIME || "unknown",

  // CORS
  ALLOWED_ORIGINS: (process.env.ALLOWED_ORIGINS || "*").split(","),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000"),
  RATE_LIMIT_MAX_REQUESTS: parseInt(
    process.env.RATE_LIMIT_MAX_REQUESTS || "100",
  ),
  RATE_LIMIT_MESSAGE:
    process.env.RATE_LIMIT_MESSAGE ||
    "Too many requests, please try again later.",

  // Body parsing limits
  JSON_LIMIT: process.env.JSON_LIMIT || "10mb",
  URL_ENCODED_LIMIT: process.env.URL_ENCODED_LIMIT || "10mb",
} as const;

export const isDevelopment = () => env.NODE_ENV === "development";
export const isProduction = () => env.NODE_ENV === "production";
