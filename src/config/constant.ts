// Rate limiting
export const RATE_LIMIT_STANDARD_HEADERS = "draft-7" as const;

// Network
export const DEFAULT_IP = "127.0.0.1";
export const IPV6_MAPPED_PREFIX = /^::ffff:/;

// CORS
export const CORS_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH"] as const;
export const CORS_ALLOWED_HEADERS = [
  "Content-Type",
  "Authorization",
  "X-API-Key",
  "X-Service-Token",
  "Idempotency-Key",
  "If-None-Match",
  "If-Match",
] as const;

// Route prefixes
export const API_PREFIX = "/api/v1";
export const DOCS_PATH = "/docs";
export const DOCS_JSON_PATH = "/docs.json";
export const HEALTH_PATH = "/health";
export const READY_PATH = "/ready";
export const LIVE_PATH = "/live";
export const VERSION_PATH = "/version";

// Leaderboard Redis key prefixes
export const KEY_PREFIX_IDEM = "idem";
export const KEY_PREFIX_FREEZE = "freeze";
export const KEY_PREFIX_EVENTS = "events";
export const IDEM_TTL = 86400; // 24h

// Health status
export const STATUS_OK = "ok";
export const STATUS_DEGRADED = "degraded";
export const STATUS_NOT_READY = "not ready";
