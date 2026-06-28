import Redis from "ioredis";
import { env } from "@/config/environment";
import { logger } from "@/utils/logger";

export const redis = new Redis(env.REDIS_URL, {
  keyPrefix: `${env.REDIS_KEY_PREFIX}:`,
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 10) return null; // stop retrying
    return Math.min(times * 200, 2000);
  },
});

redis.on("connect", () => logger.info("Redis connected"));
redis.on("error", (err) => logger.error("Redis error", { error: err.message }));

// Add abstractions when multiple Redis instances needed.
