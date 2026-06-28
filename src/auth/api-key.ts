import { timingSafeEqual } from "node:crypto";
import { env } from "@/config/environment";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/** Returns true if API key is valid. Throws string error code if invalid. */
export function verifyApiKey(apiKey: string): true {
  if (!env.API_KEY || !safeEqual(apiKey, env.API_KEY)) {
    throw "INVALID_API_KEY";
  }
  return true;
}

/** Returns true if service token is valid. Throws string error code if invalid. */
export function verifyServiceToken(token: string): true {
  if (!env.SERVICE_TOKEN || !safeEqual(token, env.SERVICE_TOKEN)) {
    throw "FORBIDDEN";
  }
  return true;
}
