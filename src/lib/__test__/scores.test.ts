import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { redis } from "@/clients/redis";
import {
  submitScore,
  submitScoresBatch,
  claimIdempotency,
  setIdempotency,
} from "@/lib/scores";

before(async () => {
  await redis.flushdb();
});

after(async () => {
  await redis.flushdb();
  await redis.quit();
});

// --- submitScore: "highest" strategy (chess, alltime) ---

describe("submitScore — highest strategy", () => {
  it("first score → rank 1, newPersonalBest true", async () => {
    const r = await submitScore("chess", "alltime", "p1", 100);
    assert.equal(r.rank, 1);
    assert.equal(r.previousRank, null);
    assert.equal(r.newPersonalBest, true);
    assert.equal(r.bestScore, 100);
  });

  it("higher score → bestScore updates, newPersonalBest true", async () => {
    const r = await submitScore("chess", "alltime", "p1", 200);
    assert.equal(r.bestScore, 200);
    assert.equal(r.newPersonalBest, true);
    assert.equal(r.rank, 1);
  });

  it("lower score → bestScore unchanged, newPersonalBest false", async () => {
    const r = await submitScore("chess", "alltime", "p1", 50);
    assert.equal(r.bestScore, 200);
    assert.equal(r.newPersonalBest, false);
  });

  it("two players ranked correctly", async () => {
    await redis.flushdb();
    await submitScore("chess", "alltime", "low", 10);
    await submitScore("chess", "alltime", "high", 500);
    const rLow = await submitScore("chess", "alltime", "low", 10);
    const rHigh = await submitScore("chess", "alltime", "high", 500);
    assert.equal(rHigh.rank, 1);
    assert.equal(rLow.rank, 2);
  });

  it("previousRank tracks movement", async () => {
    await redis.flushdb();
    await submitScore("chess", "alltime", "a", 100);
    await submitScore("chess", "alltime", "b", 50);
    // b is rank 2, now submits top score
    const r = await submitScore("chess", "alltime", "b", 999);
    assert.equal(r.previousRank, 2);
    assert.equal(r.rank, 1);
  });
});

// --- submitScore: "increment" strategy (poker, alltime) ---

describe("submitScore — increment strategy", () => {
  before(async () => {
    await redis.flushdb();
  });

  it("first score → submitted value, newPersonalBest true", async () => {
    const r = await submitScore("poker", "alltime", "p1", 30);
    assert.equal(r.bestScore, 30);
    assert.equal(r.newPersonalBest, true);
    assert.equal(r.rank, 1);
  });

  it("second score → accumulates, newPersonalBest always true", async () => {
    const r = await submitScore("poker", "alltime", "p1", 20);
    assert.equal(r.bestScore, 50);
    assert.equal(r.newPersonalBest, true);
  });

  it("ranking by accumulated total", async () => {
    // p1 has 50 from above
    await submitScore("poker", "alltime", "p2", 100);
    const r1 = await submitScore("poker", "alltime", "p1", 0);
    const r2 = await submitScore("poker", "alltime", "p2", 0);
    assert.equal(r2.rank, 1); // 100 > 50
    assert.equal(r1.rank, 2);
  });
});

// --- submitScoresBatch ---

describe("submitScoresBatch", () => {
  before(async () => {
    await redis.flushdb();
  });

  it("batch of 3 → all submitted, all ranked", async () => {
    const r = await submitScoresBatch("chess", "alltime", [
      { playerId: "b1", score: 10 },
      { playerId: "b2", score: 20 },
      { playerId: "b3", score: 30 },
    ]);
    assert.equal(r.submitted, 3);
    assert.equal(r.failed, 0);
    // verify all in sorted set
    const count = await redis.zcard("board:chess:alltime");
    assert.equal(count, 3);
  });

  it("batch with increment strategy accumulates", async () => {
    await submitScoresBatch("poker", "alltime", [
      { playerId: "bp1", score: 10 },
    ]);
    await submitScoresBatch("poker", "alltime", [
      { playerId: "bp1", score: 5 },
    ]);
    const score = await redis.zscore("board:poker:alltime", "bp1");
    assert.equal(parseFloat(score!), 15);
  });
});

// --- claimIdempotency / setIdempotency ---

describe("idempotency", () => {
  before(async () => {
    await redis.flushdb();
  });

  it("first claim → null (proceed)", async () => {
    const r = await claimIdempotency("chess", "alltime", "p1", "k1", "h1");
    assert.equal(r, null);
  });

  it("retry before setIdempotency → false (in-flight)", async () => {
    const r = await claimIdempotency("chess", "alltime", "p1", "k1", "h1");
    assert.equal(r, false);
  });

  it("retry after setIdempotency → cached result", async () => {
    const cached = { rank: 1, score: 100 };
    await setIdempotency("chess", "alltime", "p1", "k1", "h1", cached);
    const r = await claimIdempotency("chess", "alltime", "p1", "k1", "h1");
    assert.deepEqual(r, cached);
  });

  it("different body hash → mismatch", async () => {
    const r = await claimIdempotency(
      "chess",
      "alltime",
      "p1",
      "k1",
      "different-hash",
    );
    assert.equal(r, "mismatch");
  });
});

// --- Edge case ---

describe("edge cases", () => {
  before(async () => {
    await redis.flushdb();
  });

  it("score of 0 is valid", async () => {
    const r = await submitScore("chess", "alltime", "zero-player", 0);
    assert.equal(r.rank, 1);
    assert.equal(r.bestScore, 0);
    assert.equal(r.newPersonalBest, true);
  });
});
