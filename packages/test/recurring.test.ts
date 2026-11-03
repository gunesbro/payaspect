import assert from "node:assert/strict";
import { test } from "node:test";

import { detectRecurring } from "../src/domain/recurring.ts";
import type { Transaction } from "../src/domain/types.ts";

const DAY = 86_400_000;

function tx(
  id: string,
  date: number,
  amount: number,
  merchant: string,
  overrides: Partial<Transaction> = {},
): Transaction {
  return {
    id,
    type: "expense",
    amount,
    currency: "TRY",
    accountId: "a",
    toAccountId: null,
    categoryId: "sys_other",
    date,
    merchant,
    note: null,
    isRecurring: false,
    source: "manual",
    createdAt: date,
    ...overrides,
  };
}

test("flags 3+ evenly-spaced transactions with similar amounts", () => {
  const txs = [
    tx("t1", 0 * DAY, 100, "Netflix"),
    tx("t2", 30 * DAY, 100, "Netflix"),
    tx("t3", 60 * DAY, 105, "Netflix"),
  ];
  assert.deepEqual(detectRecurring(txs), new Set(["t1", "t2", "t3"]));
});

test("requires at least 3 occurrences", () => {
  const txs = [tx("t1", 0, 100, "Netflix"), tx("t2", 30 * DAY, 100, "Netflix")];
  assert.deepEqual(detectRecurring(txs), new Set());
});

test("ignores large amount drift", () => {
  const txs = [
    tx("t1", 0, 100, "Netflix"),
    tx("t2", 30 * DAY, 100, "Netflix"),
    tx("t3", 60 * DAY, 250, "Netflix"),
  ];
  assert.deepEqual(detectRecurring(txs), new Set());
});

test("ignores dates that are too close together", () => {
  const txs = [
    tx("t1", 0, 100, "Netflix"),
    tx("t2", 5 * DAY, 100, "Netflix"),
    tx("t3", 10 * DAY, 100, "Netflix"),
  ];
  assert.deepEqual(detectRecurring(txs), new Set());
});

test("skips transfers", () => {
  const txs = [
    tx("t1", 0, 100, "Netflix", { type: "transfer" }),
    tx("t2", 30 * DAY, 100, "Netflix", { type: "transfer" }),
    tx("t3", 60 * DAY, 100, "Netflix", { type: "transfer" }),
  ];
  assert.deepEqual(detectRecurring(txs), new Set());
});

test("normalizes merchant casing/whitespace for grouping", () => {
  const txs = [
    tx("t1", 0, 100, "Netflix"),
    tx("t2", 30 * DAY, 100, "  Netflix  "),
    tx("t3", 60 * DAY, 100, "netflix"),
  ];
  assert.deepEqual(detectRecurring(txs), new Set(["t1", "t2", "t3"]));
});

test("keeps different currencies in separate groups", () => {
  const txs = [
    tx("t1", 0, 100, "Netflix"),
    tx("t2", 30 * DAY, 100, "Netflix"),
    tx("t3", 60 * DAY, 100, "Netflix", { currency: "USD" }),
  ];
  assert.deepEqual(detectRecurring(txs), new Set());
});
