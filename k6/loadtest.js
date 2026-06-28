import http from "k6/http";
import { check } from "k6";
import { Rate, Trend } from "k6/metrics";

// ── Config ──────────────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || "http://localhost:3000/api/v1";
const API_KEY = __ENV.API_KEY || "test-api-key";
const GAME_ID = __ENV.GAME_ID || "chess";
const BOARDS = (__ENV.BOARDS || "daily,weekly,monthly,alltime").split(",");
const PLAYER_COUNT = parseInt(__ENV.PLAYER_COUNT || "500");
const RPS = parseInt(__ENV.RPS || "50");

// ── Custom metrics ──────────────────────────────────────────────────────
const submitScoreDuration = new Trend("submit_score_duration", true);
const getTopDuration = new Trend("get_top_duration", true);
const getRankDuration = new Trend("get_rank_duration", true);
const getAroundDuration = new Trend("get_around_duration", true);
const batchRanksDuration = new Trend("batch_ranks_duration", true);
const etagHitRate = new Rate("etag_cache_hits");
const failRate = new Rate("failed_requests");

// ── k6 options ──────────────────────────────────────────────────────────
export const options = {
  scenarios: {
    // Random independent operations — 60% of RPS budget
    load: {
      executor: "constant-arrival-rate",
      rate: Math.ceil(RPS * 0.6),
      timeUnit: "1s",
      duration: __ENV.DURATION || "1m",
      preAllocatedVUs: Math.max(RPS * 2, 50),
      maxVUs: RPS * 10,
      exec: "randomOps",
    },
    // Chained user journeys — 40% of RPS budget
    journeys: {
      executor: "constant-arrival-rate",
      rate: Math.ceil(RPS * 0.4),
      timeUnit: "1s",
      duration: __ENV.DURATION || "1m",
      preAllocatedVUs: Math.max(RPS, 25),
      maxVUs: RPS * 5,
      exec: "userJourney",
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<500", "p(99)<1000"],
    failed_requests: ["rate<0.05"],
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────
const authHeaders = { "Content-Type": "application/json", "X-API-Key": API_KEY, "Accept-Encoding": "gzip, deflate" };
const jsonHeaders = { "Content-Type": "application/json", "Accept-Encoding": "gzip, deflate" };
const readHeaders = { "Accept-Encoding": "gzip, deflate" };

function pid() {
  return `player_${Math.floor(Math.random() * PLAYER_COUNT)}`;
}

function randomScore() {
  return Math.floor(Math.random() * 10000);
}

function randomBoard() {
  return BOARDS[Math.floor(Math.random() * BOARDS.length)];
}

function pickPlayers(n) {
  const ids = new Set();
  while (ids.size < n) ids.add(pid());
  return [...ids];
}

// ── Scenario 1: weighted random operations ──────────────────────────────
// 40% submit | 20% top | 10% rank | 10% around | 8% batch | 7% friends | 5% top+paginate
export function randomOps() {
  const roll = Math.random();
  const board = randomBoard();

  if (roll < 0.40)      submitScore(board);
  else if (roll < 0.60) getTop(board);
  else if (roll < 0.70) getPlayerRank(board);
  else if (roll < 0.80) getAroundPlayer(board);
  else if (roll < 0.88) batchGetRanks(board);
  else if (roll < 0.95) friendsLeaderboard(board);
  else                   getTopPaginated(board);
}

// ── Scenario 2: chained user journey ────────────────────────────────────
// submit score → check rank → conditional re-fetch (ETag) → view around → browse top
export function userJourney() {
  const player = pid();
  const board = randomBoard();

  // 1. Submit score (with idempotency key)
  const idemKey = `${player}-${board}-${Date.now()}`;
  const scoreRes = http.post(
    `${BASE_URL}/games/${GAME_ID}/boards/${board}/scores`,
    JSON.stringify({ playerId: player, score: randomScore() }),
    {
      headers: { ...authHeaders, "Idempotency-Key": idemKey },
      tags: { name: "journey: POST /scores" },
    },
  );
  submitScoreDuration.add(scoreRes.timings.duration);
  failRate.add(scoreRes.status < 200 || scoreRes.status >= 300);

  // 2. Check own rank
  const rankRes = http.get(
    `${BASE_URL}/games/${GAME_ID}/boards/${board}/rank/${player}`,
    { headers: readHeaders, tags: { name: "journey: GET /rank" } },
  );
  getRankDuration.add(rankRes.timings.duration);
  failRate.add(rankRes.status !== 200 && rankRes.status !== 404);

  // 3. Conditional re-fetch with ETag (simulates client cache validation)
  const etag = rankRes.headers["Etag"];
  if (etag && rankRes.status === 200) {
    const cached = http.get(
      `${BASE_URL}/games/${GAME_ID}/boards/${board}/rank/${player}`,
      {
        headers: { ...readHeaders, "If-None-Match": etag },
        tags: { name: "journey: GET /rank (etag)" },
      },
    );
    etagHitRate.add(cached.status === 304);
  }

  // 4. View surrounding players
  const range = [5, 10, 25][Math.floor(Math.random() * 3)];
  const aroundRes = http.get(
    `${BASE_URL}/games/${GAME_ID}/boards/${board}/around/${player}?range=${range}`,
    { headers: readHeaders, tags: { name: "journey: GET /around" } },
  );
  getAroundDuration.add(aroundRes.timings.duration);
  failRate.add(aroundRes.status !== 200 && aroundRes.status !== 404);

  // 5. Browse top (page 1 → page 2 if available)
  const topRes = http.get(
    `${BASE_URL}/games/${GAME_ID}/boards/${board}/top?limit=25`,
    { headers: readHeaders, tags: { name: "journey: GET /top" } },
  );
  getTopDuration.add(topRes.timings.duration);
  failRate.add(topRes.status !== 200);

  if (topRes.status === 200) {
    try {
      const cursor = JSON.parse(topRes.body).meta?.cursor;
      if (cursor) {
        const page2 = http.get(
          `${BASE_URL}/games/${GAME_ID}/boards/${board}/top?limit=25&cursor=${cursor}`,
          { headers: readHeaders, tags: { name: "journey: GET /top (page 2)" } },
        );
        failRate.add(page2.status !== 200);
      }
    } catch { /* non-json response, skip */ }
  }
}

// ── Individual operations (used by randomOps) ───────────────────────────

function submitScore(board) {
  const player = pid();
  const hdrs = { ...authHeaders };

  // ~20% include idempotency key
  if (Math.random() < 0.2) {
    hdrs["Idempotency-Key"] = `${player}-${board}-${Date.now()}`;
  }

  const res = http.post(
    `${BASE_URL}/games/${GAME_ID}/boards/${board}/scores`,
    JSON.stringify({ playerId: player, score: randomScore() }),
    { headers: hdrs, tags: { name: "POST /scores" } },
  );
  submitScoreDuration.add(res.timings.duration);
  failRate.add(res.status < 200 || res.status >= 300);
  check(res, { "submit score 2xx": (r) => r.status >= 200 && r.status < 300 });
}

function getTop(board) {
  const limit = [10, 25, 50, 100][Math.floor(Math.random() * 4)];
  const res = http.get(
    `${BASE_URL}/games/${GAME_ID}/boards/${board}/top?limit=${limit}`,
    { headers: readHeaders, tags: { name: "GET /top" } },
  );
  getTopDuration.add(res.timings.duration);
  failRate.add(res.status !== 200);
  check(res, { "get top 200": (r) => r.status === 200 });
}

function getTopPaginated(board) {
  const limit = 25;
  const cursor = Math.floor(Math.random() * 200);
  const res = http.get(
    `${BASE_URL}/games/${GAME_ID}/boards/${board}/top?limit=${limit}&cursor=${cursor}`,
    { headers: readHeaders, tags: { name: "GET /top (paginated)" } },
  );
  getTopDuration.add(res.timings.duration);
  failRate.add(res.status !== 200);
  check(res, { "get top paginated 200": (r) => r.status === 200 });
}

function getPlayerRank(board) {
  const player = pid();
  const res = http.get(
    `${BASE_URL}/games/${GAME_ID}/boards/${board}/rank/${player}`,
    { headers: readHeaders, tags: { name: "GET /rank/:playerId" } },
  );
  getRankDuration.add(res.timings.duration);
  failRate.add(res.status !== 200 && res.status !== 404);
  check(res, { "get rank 200|404": (r) => r.status === 200 || r.status === 404 });

  // ~50% of successful lookups: ETag conditional re-fetch
  const etag = res.headers["Etag"];
  if (etag && res.status === 200 && Math.random() < 0.5) {
    const cached = http.get(
      `${BASE_URL}/games/${GAME_ID}/boards/${board}/rank/${player}`,
      {
        headers: { ...readHeaders, "If-None-Match": etag },
        tags: { name: "GET /rank/:playerId (etag)" },
      },
    );
    etagHitRate.add(cached.status === 304);
  }
}

function getAroundPlayer(board) {
  const player = pid();
  const range = [5, 10, 25][Math.floor(Math.random() * 3)];
  const res = http.get(
    `${BASE_URL}/games/${GAME_ID}/boards/${board}/around/${player}?range=${range}`,
    { headers: readHeaders, tags: { name: "GET /around/:playerId" } },
  );
  getAroundDuration.add(res.timings.duration);
  failRate.add(res.status !== 200 && res.status !== 404);
  check(res, { "around player 200|404": (r) => r.status === 200 || r.status === 404 });
}

function batchGetRanks(board) {
  const ids = pickPlayers(10);
  // POST /ranks is public (no auth middleware), just needs Content-Type
  const res = http.post(
    `${BASE_URL}/games/${GAME_ID}/boards/${board}/ranks`,
    JSON.stringify({ playerIds: ids }),
    { headers: jsonHeaders, tags: { name: "POST /ranks" } },
  );
  batchRanksDuration.add(res.timings.duration);
  failRate.add(res.status !== 200);
  check(res, { "batch ranks 200": (r) => r.status === 200 });
}

function friendsLeaderboard(board) {
  const ids = pickPlayers(15);
  // POST /friends requires auth
  const res = http.post(
    `${BASE_URL}/games/${GAME_ID}/boards/${board}/friends`,
    JSON.stringify({ playerIds: ids }),
    { headers: authHeaders, tags: { name: "POST /friends" } },
  );
  failRate.add(res.status !== 200);
  check(res, { "friends 200": (r) => r.status === 200 });
}

// ponytail: GET /players/me needs JWT (API key auth sets playerId from body, empty on GET → 400).
// Skipped — add when JWT generation is available (xk6-jose or pre-generated tokens).

// ── Lifecycle: seed all boards ──────────────────────────────────────────
export function setup() {
  const seeded = {};

  for (const board of BOARDS) {
    const scores = [];
    for (let i = 0; i < Math.min(PLAYER_COUNT, 200); i++) {
      scores.push({ playerId: `player_${i}`, score: randomScore() });
    }

    for (let i = 0; i < scores.length; i += 50) {
      const chunk = scores.slice(i, i + 50);
      const res = http.post(
        `${BASE_URL}/games/${GAME_ID}/boards/${board}/scores/batch`,
        JSON.stringify({ scores: chunk }),
        { headers: authHeaders, tags: { name: "setup: seed scores" } },
      );
      if (res.status >= 400) {
        console.warn(`Seed ${board} failed: ${res.status} ${res.body}`);
      }
    }

    seeded[board] = scores.length;
  }

  return { seeded };
}
