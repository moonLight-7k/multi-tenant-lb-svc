import { GameConfig } from "@/types/config";
import { env } from "@/config/environment";

export const gameConfig: GameConfig[] = [
  {
    id: "chess",
    name: "Chess Masters",
    auth: {
      type: "jwt",
      secret: env.CHESS_JWT_SECRET,
    },
    boards: [
      { id: "daily", strategy: "highest", resetInterval: "daily" },
      { id: "weekly", strategy: "highest", resetInterval: "weekly" },
      { id: "monthly", strategy: "highest", resetInterval: "monthly" },
      { id: "alltime", strategy: "highest" },
    ],
    ttl: {
      daily: 604800,
      weekly: 2592000,
      monthly: 7776000,
    },
  },
  {
    id: "poker",
    name: "Poker Nights",
    auth: {
      type: "grpc",
      url: env.POKER_GRPC_URL,
    },
    boards: [
      { id: "daily", strategy: "highest", resetInterval: "daily" },
      { id: "alltime", strategy: "increment" },
    ],
    ttl: {
      daily: 172800,
    },
  },
];
