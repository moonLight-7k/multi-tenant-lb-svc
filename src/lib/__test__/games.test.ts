import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { findGame, findBoard, validateBoard } from "@/lib/games";

describe("findGame", () => {
  it("returns chess config", () => {
    const game = findGame("chess");
    assert.equal(game?.id, "chess");
    assert.equal(game?.name, "Chess Masters");
    assert.equal(game?.auth.type, "jwt");
  });

  it("returns poker config", () => {
    const game = findGame("poker");
    assert.equal(game?.id, "poker");
    assert.equal(game?.auth.type, "grpc");
  });

  it("returns undefined for nonexistent game", () => {
    assert.equal(findGame("nonexistent"), undefined);
  });

  it("returns undefined for empty string", () => {
    assert.equal(findGame(""), undefined);
  });
});

describe("findBoard", () => {
  const chess = findGame("chess")!;
  const poker = findGame("poker")!;

  it("finds chess daily board", () => {
    const board = findBoard(chess, "daily");
    assert.equal(board?.strategy, "highest");
    assert.equal(board?.resetInterval, "daily");
  });

  it("finds chess alltime board with no resetInterval", () => {
    const board = findBoard(chess, "alltime");
    assert.equal(board?.strategy, "highest");
    assert.equal(board?.resetInterval, undefined);
  });

  it("finds poker alltime board with increment strategy", () => {
    const board = findBoard(poker, "alltime");
    assert.equal(board?.strategy, "increment");
  });

  it("returns undefined for nonexistent board", () => {
    assert.equal(findBoard(chess, "nonexistent"), undefined);
  });
});

describe("validateBoard", () => {
  const chess = findGame("chess")!;
  const poker = findGame("poker")!;

  it("returns true for valid chess board", () => {
    assert.equal(validateBoard(chess, "daily"), true);
  });

  it("returns false for invalid chess board", () => {
    assert.equal(validateBoard(chess, "nonexistent"), false);
  });

  it("returns true for valid poker board", () => {
    assert.equal(validateBoard(poker, "alltime"), true);
  });

  it("returns false for invalid poker board", () => {
    assert.equal(validateBoard(poker, "weekly"), false);
  });
});
