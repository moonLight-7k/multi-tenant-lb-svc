import winston from "winston";
import { env } from "@/config/environment";

const { combine, timestamp, json, colorize, simple, errors } = winston.format;

export const logger = winston.createLogger({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  defaultMeta: { service: "betterleaderboard" },
  format: combine(
    errors({ stack: true }),
    timestamp({ format: "ISO" }),
    json(),
  ),
  transports: [
    new winston.transports.Console({
      format:
        env.NODE_ENV === "production"
          ? combine(timestamp({ format: "ISO" }), json())
          : combine(colorize(), simple()),
    }),
    ...(env.NODE_ENV !== "production"
      ? [new winston.transports.File({ filename: "logs/dev.log" })]
      : []),
  ],
});
