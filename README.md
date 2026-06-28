# betterLeaderboard

Self-hosted leaderboard service for game studios. One deployment serves multiple games with isolated boards, seasons, real-time rankings, and admin controls. Built on Redis sorted sets for sub-50ms reads.

## Stack

- Node.js 24, Express 5, TypeScript 6
- Redis (ioredis) — sorted sets for real-time ranking
- Neon Postgres — durable persistence
- JWT / gRPC / API key auth (per-game configurable)

## Quick start

```bash
# start redis
docker compose up -d

# install + build
pnpm install
pnpm build

# configure
cp .env.example .env
# edit .env with your REDIS_URL, DATABASE_URL, JWT_SECRET, etc.

# run
pnpm start
```

Development:

```bash
pnpm dev          # esbuild watch + nodemon
```

## Environment variables

| Variable                  | Required | Default | Description                                            |
| ------------------------- | -------- | ------- | ------------------------------------------------------ |
| `REDIS_URL`               | yes      | —       | Redis connection string                                |
| `DATABASE_URL`            | yes      | —       | Neon Postgres connection string                        |
| `JWT_SECRET`              | no       | —       | Default JWT secret (fallback if no per-game secret)    |
| `API_KEY`                 | no       | —       | `X-API-Key` for service-to-service (batch submissions) |
| `SERVICE_TOKEN`           | no       | —       | `X-Service-Token` for admin endpoints                  |
| `PORT`                    | no       | `3000`  | Server port                                            |
| `ALLOWED_ORIGINS`         | no       | `*`     | Comma-separated CORS origins                           |
| `RATE_LIMIT_WINDOW_MS`    | no       | `60000` | Rate limit window (ms)                                 |
| `RATE_LIMIT_MAX_REQUESTS` | no       | `100`   | Max requests per window                                |

## Game configuration

Games are defined in `src/config/games.ts`. Each game specifies auth method, boards, scoring strategies, and TTLs:

```ts
{
  id: "chess",
  name: "Chess Masters",
  auth: { type: "jwt", secret: process.env.CHESS_JWT_SECRET },
  boards: [
    { id: "daily", strategy: "highest", resetInterval: "daily" },
    { id: "weekly", strategy: "highest", resetInterval: "weekly" },
    { id: "alltime", strategy: "highest" },
  ],
  ttl: { daily: 604800, weekly: 2592000 },
}
```

### Scoring strategies

| Strategy    | Behavior                            |
| ----------- | ----------------------------------- |
| `highest`   | Keep highest score per player       |
| `lowest`    | Keep lowest score (speedruns)       |
| `increment` | Add to cumulative total (coins, XP) |
| `replace`   | Always overwrite                    |

## API

Base path: `/api/v1`

### Scores

| Method | Path                                          | Auth    | Description          |
| ------ | --------------------------------------------- | ------- | -------------------- |
| POST   | `/games/:gameId/boards/:boardId/scores`       | JWT     | Submit a score       |
| POST   | `/games/:gameId/boards/:boardId/scores/batch` | API key | Batch submit (1-100) |

### Rankings

| Method | Path                                                      | Description                 |
| ------ | --------------------------------------------------------- | --------------------------- |
| GET    | `/games/:gameId/boards/:boardId/top`                      | Top players (paginated)     |
| GET    | `/games/:gameId/boards/:boardId/players/:playerId/rank`   | Player rank + score         |
| GET    | `/games/:gameId/boards/:boardId/players/:playerId/around` | Neighbors around player     |
| POST   | `/games/:gameId/boards/:boardId/ranks/batch`              | Batch get ranks (1-100)     |
| POST   | `/games/:gameId/boards/:boardId/friends`                  | Friends leaderboard (1-200) |

### Boards & seasons

| Method | Path                     | Description            |
| ------ | ------------------------ | ---------------------- |
| GET    | `/games/:gameId/boards`  | List boards for a game |
| GET    | `/games/:gameId/seasons` | List seasons           |

### Players

| Method | Path                                      | Description                    |
| ------ | ----------------------------------------- | ------------------------------ |
| GET    | `/games/:gameId/players/:playerId/boards` | Player ranks across all boards |

### Admin (requires `X-Service-Token`)

| Method | Path                                                     | Description                         |
| ------ | -------------------------------------------------------- | ----------------------------------- |
| POST   | `/admin/games/:gameId/boards/:boardId/reset`             | Reset a board                       |
| DELETE | `/admin/games/:gameId/boards/:boardId/players/:playerId` | Remove player (requires `If-Match`) |
| POST   | `/admin/games/:gameId/boards/:boardId/freeze`            | Freeze board                        |
| POST   | `/admin/games/:gameId/boards/:boardId/unfreeze`          | Unfreeze board                      |

### Headers

| Header                        | Usage                                       |
| ----------------------------- | ------------------------------------------- |
| `Authorization: Bearer <jwt>` | Player auth                                 |
| `X-API-Key`                   | Service-to-service auth                     |
| `X-Service-Token`             | Admin auth                                  |
| `Idempotency-Key`             | Deduplicate score submissions               |
| `If-None-Match`               | Conditional GET (ETag)                      |
| `If-Match`                    | Conditional DELETE (optimistic concurrency) |

## Scripts

```bash
pnpm build              # esbuild bundle to dist/
pnpm start              # run production build
pnpm dev                # watch + auto-reload
pnpm test               # node --test
pnpm test:watch         # tests in watch mode
pnpm test:coverage      # coverage report
pnpm lint               # eslint
pnpm lint:fix           # eslint --fix
pnpm format             # prettier
pnpm format:check       # prettier --check
```

## License

ISC
