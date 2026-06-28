import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || "development",
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || "1.0"),
  sendDefaultPii: true,
  includeLocalVariables: true,
  // ponytail: Sentry v8+ bundles OTel — auto-instruments express, ioredis, http
});
