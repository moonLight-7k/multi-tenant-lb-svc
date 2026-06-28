# betterLeaderboard — Product Requirements Document

## Overview

betterLeaderboard is an open-source, self-hosted leaderboard platform for game studios. One deployment serves multiple games with isolated configurations, seasons, real-time rankings, and a production-grade API. Built on Redis sorted sets for sub-50ms reads and Neon Postgres for durable persistence.

**Target users:** Game studios that want to own their leaderboard infrastructure without vendor lock-in.

**Primary differentiator:** Easy self-hosting. Docker Compose with Redis + Postgres + the service. One command to deploy, one config file to manage all games.

## Problem

Existing options are either SaaS with lock-in (PlayFab, GameSparks), too minimal (raw Redis ZADD), or require heavy infrastructure setup. Game studios need a leaderboard that is:

- Self-hosted and open source
- Multi-game from a single deployment
- Feature-complete out of the box (seasons, friends, around-me, filtering, admin)
- Performant at scale without operational complexity

## Non-Functional Requirements

| Requirement         | Target                                                      |
| ------------------- | ----------------------------------------------------------- |
| Read latency (p99)  | < 50ms                                                      |
| Write latency (p99) | < 100ms                                                     |
| Availability        | 99.9% (8.7h downtime/year)                                  |
| Launch scale        | 10K–100K DAU                                                |
| Data retention      | Configurable per game (auto-purge scores older than X days) |

## Architecture

- **Runtime:** Node.js 24 LTS, Express 5, TypeScript (type-stripped at runtime)
- **Primary store:** Redis (ioredis) — sorted sets for real-time ranking
- **Persistence:** Neon Postgres (@neondatabase/serverless) — source of truth, historical queries
- **Auth:** JWT (jose) for local verification, gRPC for external auth service, API key for service-to-service
- **Events:** Redis Pub/Sub for outbound events (ScoreSubmitted, RankChanged, SeasonEnded, etc.)
- **Deployment:** Railway (container, scales to zero). Docker Compose for self-hosting.
- **Multi-tenancy:** No. Each studio deploys their own instance.

## Game Configuration

Games are defined in a config file (`games.json`), not in a database. Each game entry specifies:

- Game ID and display name
- Game API URL (for webhooks, player data)
- Auth method (JWT with secret or gRPC with URL)
- Board definitions (ID, scoring strategy, reset interval, TTL)
- Webhook paths

New games are added by editing the config file and restarting the service.

### Scoring Strategies

Each board has a scoring strategy configured server-side. Clients only submit a score; the server decides how to apply it:

| Strategy    | Behavior                            |
| ----------- | ----------------------------------- |
| `highest`   | Keep the highest score per player   |
| `lowest`    | Keep the lowest score (speedruns)   |
| `increment` | Add to cumulative total (coins, XP) |
| `replace`   | Always overwrite with latest score  |

### Board Timeline & TTL

Boards can have reset intervals (daily, weekly, monthly, never). Redis keys include the time period (`lb:{gameId}:{boardId}:{period}`). Old period keys auto-expire via TTL. Postgres retains everything for historical queries.

| Board type       | Redis TTL | Postgres                              |
| ---------------- | --------- | ------------------------------------- |
| Daily            | 7 days    | Forever (subject to retention config) |
| Weekly           | 30 days   | Forever                               |
| Monthly          | 90 days   | Forever                               |
| Alltime / Season | No TTL    | Forever                               |

## Seasons

Seasons are named time windows managed via the admin API. Each season has an ID, start/end dates, and a status (upcoming, active, ended, archived). All board endpoints accept an optional `?season=` parameter; omitting it defaults to the current active season.

## Player Identity

The game server owns player identity. The leaderboard service treats `playerId` as an opaque string provided by the game in the JWT or request body. No player registration, no identity management.

## API Design

Full contract in `docs/contract.yaml` (OpenAPI 3.1).

### Public API (`/api/v1/`)

**Scores:**

- `POST /api/v1/games/:gameId/boards/:boardId/scores` — Submit a score (idempotent via `Idempotency-Key` header)
- `POST /api/v1/games/:gameId/boards/:boardId/scores/batch` — Batch submit (up to 100)

**Rankings:**

- `GET /api/v1/games/:gameId/boards/:boardId/top` — Top N with cursor pagination, filtering (country, platform, league)
- `GET /api/v1/games/:gameId/boards/:boardId/rank/:playerId` — Player rank, score, percentile
- `GET /api/v1/games/:gameId/boards/:boardId/around/:playerId` — Players above and below
- `POST /api/v1/games/:gameId/boards/:boardId/ranks` — Batch rank lookup
- `POST /api/v1/games/:gameId/boards/:boardId/friends` — Friend-scoped leaderboard

**Players:**

- `GET /api/v1/games/:gameId/players/me` — Authenticated player's ranks across all boards

**Boards & Seasons:**

- `GET /api/v1/games/:gameId/boards` — List boards with config and player counts
- `GET /api/v1/games/:gameId/seasons` — List seasons

### Admin API (`/api/v1/admin/`)

Secured with internal service token (`X-Service-Token`).

- Reset board
- Ban/remove player score (with optimistic concurrency via `If-Match`)
- Recalculate board from Postgres
- Freeze/unfreeze board
- Create/end seasons

### Internal API (`/internal/`)

Not versioned. Service-to-service only.

- Cache warm-up (populate Redis from Postgres)
- Redis-Postgres sync

### System Endpoints

- `/health` — Health check (Redis + DB connectivity)
- `/ready` — Readiness probe
- `/live` — Liveness probe
- `/version` — Service version, commit, build time

### Cross-Cutting Concerns

| Concern           | Implementation                                                 |
| ----------------- | -------------------------------------------------------------- |
| Response envelope | `{ data, meta: { requestId, traceId, generatedAt } }`          |
| Errors            | `{ code, message, traceId, details }` — machine-readable codes |
| Pagination        | Cursor-based, not offset                                       |
| Caching           | ETag / If-None-Match on ranking endpoints                      |
| Idempotency       | Idempotency-Key header on score submission, stored in Redis    |
| Tracing           | X-Request-ID, X-Trace-ID on every response                     |
| Rate limiting     | Three layers: per game, per API key, per player                |
| Auth              | Bearer JWT, X-API-Key, X-Service-Token (admin/internal)        |

## Events (Redis Pub/Sub)

The leaderboard publishes events to Redis channels. Downstream services subscribe.

| Event            | Channel                           | Trigger                 |
| ---------------- | --------------------------------- | ----------------------- |
| `ScoreSubmitted` | `events:{gameId}:score_submitted` | New score accepted      |
| `RankChanged`    | `events:{gameId}:rank_changed`    | Player's rank changed   |
| `SeasonEnded`    | `events:{gameId}:season_ended`    | Season closed via admin |
| `BoardFrozen`    | `events:{gameId}:board_frozen`    | Board frozen via admin  |

## Data Retention

Configurable per game in `games.json`:

```json
{
  "retention": {
    "scoreDays": 365,
    "deletedPlayerPurge": true
  }
}
```

- Scores older than `scoreDays` are purged from Postgres by a cleanup job.
- `DELETE /api/v1/admin/games/:gameId/players/:playerId` purges all player data (scores, rankings) for GDPR compliance.

## Anti-Cheat

Trust the game server. The leaderboard records what it receives. Score validation is the game's responsibility before calling the leaderboard API.

## Deployment

### Self-Hosted (Primary)

Docker Compose with three services:

```yaml
services:
  leaderboard:
    image: betterleaderboard:latest
    ports: ['3000:3000']
    env_file: .env
  redis:
    image: redis:7-alpine
  postgres:
    image: postgres:16-alpine
```

### Railway

Container deployment. Managed Redis and Postgres add-ons. Scales to zero when idle.

## Success Criteria (v1)

- Full `contract.yaml` implemented — every endpoint functional
- Docker Compose one-command deploy works
- p99 read latency < 50ms, write < 100ms under load
- Documentation: README, API docs (Swagger UI), deployment guide
- At least one example game configuration demonstrating multi-board, seasons

## Out of Scope (v1)

- Web dashboard / admin UI
- Multi-tenancy (shared infra for multiple studios)
- Webhooks (using Redis Pub/Sub instead)
- Client SDKs (API-first, studios use REST directly)
- Multi-region / geo-distributed deployment
- Real-time WebSocket feeds
