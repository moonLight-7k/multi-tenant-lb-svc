export type ScoringStrategy = "highest" | "lowest" | "increment" | "replace";

export type ResetInterval = "daily" | "weekly" | "monthly";

export interface BoardConfig {
  id: string;
  strategy: ScoringStrategy;
  resetInterval?: ResetInterval; // omit for alltime boards
}

export interface GameConfig {
  id: string;
  name: string;
  auth: {
    type: "jwt" | "grpc";
    secret?: string;
    url?: string;
  };
  boards: BoardConfig[];
  ttl: {
    [key: string]: number;
  };
}
