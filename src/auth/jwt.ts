import { jwtVerify } from "jose";

/** Returns playerId (sub claim). Throws string error code on failure. */
export async function verifyJwt(
  token: string,
  secret: string,
): Promise<string> {
  const key = new TextEncoder().encode(secret);
  const { payload } = await jwtVerify(token, key);
  if (typeof payload.sub !== "string") {
    throw "INVALID_TOKEN_SUB";
  }
  return payload.sub;
}
