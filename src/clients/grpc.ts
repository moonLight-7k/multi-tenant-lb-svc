import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { resolve } from "node:path";
import { logger } from "@/utils/logger";

// ponytail: cwd-based path survives esbuild bundling into dist/
const PROTO_PATH = resolve(process.cwd(), "src/proto/auth.proto");

const packageDef = protoLoader.loadSync(PROTO_PATH, {
  keepCase: false,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const proto = grpc.loadPackageDefinition(packageDef).auth as any;

// ponytail: one client per URL, lazy-created. Map is the cache.
const clients = new Map<string, any>();

function getClient(url: string) {
  let client = clients.get(url);
  if (!client) {
    client = new proto.AuthService(url, grpc.credentials.createInsecure());
    clients.set(url, client);
  }
  return client;
}

export interface GrpcAuthResult {
  valid: boolean;
  playerId: string;
  error: string;
}

const GRPC_DEADLINE_MS = 5_000;

export function verifyTokenViaGrpc(
  url: string,
  token: string,
  gameId: string,
): Promise<GrpcAuthResult> {
  const client = getClient(url);
  const deadline = new Date(Date.now() + GRPC_DEADLINE_MS);

  return new Promise((resolve, reject) => {
    client.verifyToken(
      { token, gameId },
      { deadline },
      (err: grpc.ServiceError | null, res: GrpcAuthResult) => {
        if (err) {
          logger.error(`gRPC auth call failed: url=${url} gameId=${gameId}`, {
            err,
          });
          reject(err);
          return;
        }
        resolve(res);
      },
    );
  });
}
