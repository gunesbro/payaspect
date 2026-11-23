import assert from "node:assert/strict";
import { test } from "node:test";

import { openDatabase } from "../src/db/database.ts";
import { MemoryDatabaseDriver } from "../src/db/memoryDriver.ts";
import { insertAccount } from "../src/db/repositories/accounts.ts";
import {
  spendingTrend,
  type CategoryTrend,
  type SpendingTrend,
  type TrendPoint,
} from "../src/db/repositories/insights.ts";
import { insertTransaction } from "../src/db/repositories/transactions.ts";
import {
  categoryMonthChanges,
  detectSpendingAnomalies,
} from "../src/domain/anomalies.ts";
import type { Account, Transaction } from "../src/domain/types.ts";

const TEST_KEY = "test-key-not-a-real-secret";
const REFERENCE = new Date(2026, 5, 15, 12); // June 2026

function makeAccount(id: string, currency: string): Account {
  return {
    id,
    name: id,
    type: "bank",
    currency,
    isBudget: true,
    creditLimit: null,
    statementDay: null,
    minPaymentDay: null,
    note: null,
    archived: false,
    createdAt: 0,
  };
}

function makeTx(
  id: string,
  overrides: Partial<Transaction> = {},
): Transaction {
  return {
    id,
    type: "expense",
    amount: 100,
    currency: "TRY",
    accountId: "acc_try",
    toAccountId: null,
    categoryId: "sys_groceries",
    date: new Date(2026, 5, 10).getTime(),
    merchant: null,
    note: null,
    isRecurring: false,
    source: "manual",
    createdAt: 1_000,
    ...overrides,
  };
}

async function freshDb(): Promise<MemoryDatabaseDriver> {
  const db = new MemoryDatabaseDriver();
  await openDatabase(db, { getOrCreateKey: async () => TEST_KEY });
  await insertAccount(db, makeAccount("acc_try", "TRY"));
  await insertAccount(db, makeAccount("acc_usd", "USD"));
  return db;
}

function series(currency: string, categoryId: string, totals: number[]): CategoryTrend {
  const points: TrendPoint[] = totals.map((total, index) => ({
    from: index,
    to: index,
    total,
  }));
  return { currency, categoryId, points };
}

function trend(...seriesList: CategoryTrend[]): SpendingTrend {
  return { byCurrency: [], byCategory: seriesList };
}

test("spendingTrend builds zero-filled category series per currency in one scan", async () => {
  const db = await freshDb();
  const month = (index: number) => new Date(2026, 3 + index, 10).getTime();

  await insertTransaction(db, makeTx("t1", { amount: 100, date: month(0) }));
  await insertTransaction(db, makeTx("t2", { amount: 100, date: month(1) }));
  await insertTransaction(db, makeTx("t3", { amount: 200, date: month(2) }));
  await insertTransaction(db, makeTx("t4", {
    amount: 50,
    categoryId: "sys_dining",
    date: month(2),
  }));
  await insertTransaction(db, makeTx("t5", {
    amount: 20,
    currency: "USD",
    accountId: "acc_usd",
    date: month(2),
  }));
  // Income and uncategorised expenses must not create category series.
  await insertTransaction(db, makeTx("t6", {
    type: "income",
    amount: 900,
    categoryId: "sys_other",
    date: month(2),
  }));
  await insertTransaction(db, makeTx("t7", { categoryId: null, date: month(2) }));

  const result = await spendingTrend(db, { months: 3, reference: REFERENCE });

  assert.deepEqual(
    result.byCategory.map((entry) => `${entry.currency}/${entry.categoryId}`),
    [
      "TRY/sys_dining",
      "TRY/sys_groceries",
      "USD/sys_groceries",
    ],
  );
  assert.deepEqual(
    result.byCategory.map((entry) => entry.points.map((point) => point.total)),
    [
      [0, 0, 50],
      [100, 100, 200],
      [0, 0, 20],
    ],
  );
  // Existing per-currency totals still come from the same call.
  assert.deepEqual(
    result.byCurrency.map((entry) => entry.currency),
    ["TRY", "USD"],
  );
});

test("categoryMonthChanges compares the last two months and keeps currencies separate", () => {
  const rows = categoryMonthChanges(
    trend(
      series("TRY", "sys_groceries", [100, 100, 200]),
      series("TRY", "sys_dining", [0, 0, 50]),
      series("USD", "sys_groceries", [5, 5, 4]),
    ),
  );

  const groceries = rows.find((r) => r.currency === "TRY" && r.categoryId === "sys_groceries")!;
  assert.equal(groceries.current, 200);
  assert.equal(groceries.previous, 100);
  assert.deepEqual(groceries.change, { direction: "up", percent: 100 });
  assert.equal(
    rows.find((r) => r.categoryId === "sys_dining")?.change,
    null,
  );
  assert.deepEqual(
    rows.find((r) => r.currency === "USD")?.change,
    { direction: "down", percent: -20 },
  );
});

test("detectSpendingAnomalies flags spikes above the median baseline", () => {
  const rows = detectSpendingAnomalies(
    trend(
      series("TRY", "sys_groceries", [100, 100, 200]),
      series("TRY", "sys_dining", [80, 120, 130]),
      series("USD", "sys_groceries", [5, 5, 10]),
    ),
  );

  assert.deepEqual(
    rows.map(({ currency, categoryId, percent }) => ({ currency, categoryId, percent })),
    [
      { currency: "TRY", categoryId: "sys_groceries", percent: 100 },
      { currency: "USD", categoryId: "sys_groceries", percent: 100 },
    ],
  );
  assert.equal(rows[0]?.baseline, 100);
  assert.equal(rows[0]?.current, 200);
});

test("anomaly baseline resists a single historical spike", () => {
  // Median of [10, 1000, 200] is 200, not the inflated mean.
  const rows = detectSpendingAnomalies(
    trend(series("TRY", "sys_groceries", [10, 1000, 200])),
  );
  assert.deepEqual(rows, []);
});

test("anomaly threshold is configurable and invalid values fall back", () => {
  const data = trend(series("TRY", "sys_groceries", [100, 110, 160]));
  assert.equal(detectSpendingAnomalies(data).length, 1); // baseline 105, +52.4%
  assert.deepEqual(detectSpendingAnomalies(data, 60), []);
  assert.deepEqual(detectSpendingAnomalies(data, Number.NaN).length, 1);
});

test("anomalies need at least two positive prior months", () => {
  assert.deepEqual(
    detectSpendingAnomalies(trend(series("TRY", "sys_groceries", [100, 200]))),
    [],
  );
  assert.deepEqual(
    detectSpendingAnomalies(trend(series("TRY", "sys_groceries", [0, 0, 200]))),
    [],
  );
  assert.deepEqual(
    detectSpendingAnomalies(trend(series("TRY", "sys_groceries", []))),
    [],
  );
});
