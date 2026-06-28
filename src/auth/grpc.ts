import { verifyTokenViaGrpc } from "@/clients/grpc";

/** Returns playerId. Throws string error code on failure. */
export async function verifyGrpc(
  url: string,
  token: string,
  gameId: string,
): Promise<string> {
  const result = await verifyTokenViaGrpc(url, token, gameId);
  if (!result.valid) {
    throw result.error || "INVALID_TOKEN";
  }
  return result.playerId;
}
