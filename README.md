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

## Load testing

Load tests use [k6](https://grafana.com/docs/k6/latest/). Install it first:

```bash
# macOS
brew install k6

# linux (Debian/Ubuntu)
sudo gpg -k && sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D68 && echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list && sudo apt-get update && sudo apt-get install k6

# docker
docker run --rm -i grafana/k6 run - <k6/loadtest.js
```

### Running

```bash
# default: 50 RPS against localhost for 1 minute
k6 run k6/loadtest.js

# custom target and rate
k6 run -e BASE_URL=https://leaderboard.example.com/api/v1 -e RPS=200 k6/loadtest.js

# override duration, game, boards, player pool
k6 run -e DURATION=5m -e GAME_ID=chess -e BOARDS=daily,alltime -e PLAYER_COUNT=1000 k6/loadtest.js
```

### Environment variables

| Variable       | Default                          | Description                                 |
| -------------- | -------------------------------- | ------------------------------------------- |
| `BASE_URL`     | `http://localhost:3000/api/v1`   | API base URL                                |
| `API_KEY`      | `test-api-key`                   | `X-API-Key` for authenticated endpoints     |
| `GAME_ID`      | `chess`                          | Game to test against                        |
| `BOARDS`       | `daily,weekly,monthly,alltime`   | Comma-separated board IDs                   |
| `PLAYER_COUNT` | `500`                            | Size of the simulated player pool           |
| `RPS`          | `50`                             | Target requests per second (split 60/40 between random ops and user journeys) |
| `DURATION`     | `1m`                             | Test duration                               |

### What it tests

The load test runs two concurrent scenarios:

- **Random ops (60% of RPS)** — weighted random endpoint calls: score submissions, top player queries, rank lookups, around-player views, batch rank fetches, friends leaderboards, and paginated browsing.
- **User journeys (40% of RPS)** — chained requests simulating a real player session: submit score → check rank → ETag conditional re-fetch → view surrounding players → browse top with cursor pagination.

Features exercised: gzip compression, ETag/304 caching, idempotency keys on score submissions, cursor pagination, multi-board distribution.

### Thresholds

The test fails if:
- p95 response time exceeds 500ms
- p99 response time exceeds 1000ms
- More than 5% of requests fail

## License

ISC
