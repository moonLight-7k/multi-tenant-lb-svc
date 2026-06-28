# TODO — Redis-only remaining work

| Feature                         | Size   | What                                                                                  | Status                                                                                                                                                        |
| ------------------------------- | ------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scoring strategies              | Small  | Add `lowest`/`increment`/`replace` to config + service. Currently hardcoded `GT` flag | Done. `BoardConfig` has `strategy` field, service uses `GT`/`LT`/`ZINCRBY`/plain `ZADD`. Read direction flips for `lowest`.                                   |
| Board TTL                       | Small  | Set `EXPIRE` on Redis keys, include period in key                                     | Done. Key is `{gameId}:{boardId}:{period}` for daily/weekly/monthly. `EXPIRE` set after each write. `resetInterval` on `BoardConfig`.                         |
| Events (Pub/Sub)                | Small  | `redis.publish()` after score submit / rank change                                    | Done. Fire-and-forget with `.catch` logging. `ScoreSubmitted` + `RankChanged` on `events:{gameId}:*` channels.                                                |
| ETag caching                    | Small  | Hash top-N response, `If-None-Match` short-circuit                                    | Done. MD5 ETag on all ranking endpoints, 304 on match.                                                                                                        |
| Idempotency keys                | Small  | `SET NX EX` in Redis before ZADD                                                      | Done. `Idempotency-Key` header on single score submit. 24h TTL. Cached result returned on duplicate.                                                          |
| API key auth                    | Small  | `X-API-Key` / `X-Service-Token` header check in middleware                            | Done. `X-API-Key` in `auth` middleware (playerId from body). `serviceAuth` middleware for admin with `X-Service-Token`. Env vars `API_KEY` + `SERVICE_TOKEN`. |
| Admin API (Redis-only)          | Medium | Reset board (`DEL`), ban player (`ZREM`), freeze board (flag)                         | Done. `/admin/` routes with `serviceAuth`. Freeze blocks score submission (423).                                                                              |
| Filtering                       | Small  | `country`/`platform`/`league` — needs player metadata store, skip without Postgres    | Blocked                                                                                                                                                       |
| Per-game/per-player rate limits | Small  | Key rate limiter by `gameId`/`playerId` instead of global IP                          | Done. `keyGenerator` on existing `express-rate-limit`: `{gameId}:{playerId}` if authed, `{gameId}:{ip}` otherwise.                                            |

## Remaining (requires Postgres or gRPC)

| Feature                             | Dependency                       |
| ----------------------------------- | -------------------------------- |
| Seasons CRUD + endpoints            | Postgres                         |
| DB persistence (write-through)      | Postgres                         |
| Historical queries                  | Postgres                         |
| Data retention / GDPR purge         | Postgres                         |
| gRPC auth provider                  | gRPC client                      |
| Filtering (country/platform/league) | Player metadata store (Postgres) |
| Cache warm-up (`/internal/`)        | Postgres → Redis sync            |

## Review fixes applied

- `unfreezeBoard` controller: added game/board validation (was missing vs `freezeBoard`)
- `redis.publish()`: added `.catch` with logger (was silently swallowing errors)
- Known dead code: `src/config/index.ts` (unused), `isDevelopment`/`isProduction` helpers (unused), schema fields `seasonId`/`country`/`platform`/`league`/`metadata` (validated but ignored) — left in place, delete when convenient
