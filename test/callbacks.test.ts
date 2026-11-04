import assert from "node:assert/strict";
import test from "node:test";
import { callbackData, parseCallback } from "../src/callbacks.js";

test("callback data round-trips for every action", () => {
  for (const action of [
    { kind: "category", categoryId: "c2" },
    { kind: "userClose", ticketId: 7 },
    { kind: "staffClose", ticketId: 7 },
    { kind: "rate", ticketId: 7, rating: 4 },
  ] as const) {
    assert.deepEqual(parseCallback(callbackData(action)), action);
  }
});

test("callback data fits Telegram's 64-byte limit", () => {
  const data = callbackData({ kind: "rate", ticketId: Number.MAX_SAFE_INTEGER, rating: 5 });
  assert.ok(Buffer.byteLength(data) <= 64);
});

test("malformed callback data is rejected", () => {
  for (const data of ["", "cat:", "cat:x y", "uc:abc", "sc:-1", "rate:7", "rate:7:x", "unknown:1", "open_ticket"]) {
    assert.equal(parseCallback(data), undefined, data);
  }
});
