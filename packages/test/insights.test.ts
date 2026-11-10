import assert from "node:assert/strict";
import { test } from "node:test";

import { MemoryDatabaseDriver } from "../src/db/memoryDriver.ts";
import { openDatabase } from "../src/db/database.ts";
import { insertAccount } from "../src/db/repositories/accounts.ts";
import { insertTransaction } from "../src/db/repositories/transactions.ts";
import { getAccountBalances, spendingTrend, summarizeSpending } from "../src/db/repositories/insights.ts";
import { monthRange } from "../src/domain/dateRange.ts";
import type { Account, Transaction } from "../src/domain/types.ts";

const TEST_KEY = "test-key-not-a-real-secret";

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: "acc_1",
    name: "Checking",
    type: "bank",
    currency: "TRY",
    isBudget: true,
    creditLimit: null,
    statementDay: null,
    minPaymentDay: null,
    note: null,
    archived: false,
    createdAt: 0,
    ...overrides,
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
    accountId: "acc_1",
    toAccountId: null,
    categoryId: "sys_groceries",
    date: 1_000,
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
  await insertAccount(db, makeAccount());
  return db;
}

test("summarizeSpending never mixes currencies", async () => {
  const db = await freshDb();
  await insertTransaction(db, makeTx("t1", { amount: 100, categoryId: "sys_groceries" }));
  await insertTransaction(db, makeTx("t2", { amount: 50, categoryId: "sys_dining" }));
  await insertTransaction(db, makeTx("t3", { type: "income", amount: 900, categoryId: "sys_other" }));
  await insertTransaction(db, makeTx("t4", { amount: 30, categoryId: "sys_groceries", currency: "USD" }));

  const summary = await summarizeSpending(db);

  // A single cross-currency total is meaningless, so it is null.
  assert.equal(summary.total, null);
  assert.equal(summary.currency, null);

  assert.deepEqual(summary.byCurrency, [
    {
      currency: "TRY",
      total: 150,
      byCategory: [
        { categoryId: "sys_groceries", total: 100 },
        { categoryId: "sys_dining", total: 50 },
      ],
      byAccount: [{ accountId: "acc_1", total: 150 }],
      byMerchant: [],
    },
    {
      currency: "USD",
      total: 30,
      byCategory: [{ categoryId: "sys_groceries", total: 30 }],
      byAccount: [{ accountId: "acc_1", total: 30 }],
      byMerchant: [],
    },
  ]);
});

test("summarizeSpending exposes a total for single-currency data", async () => {
  const db = await freshDb();
  await insertTransaction(db, makeTx("t1", { amount: 100, categoryId: "sys_groceries" }));
  await insertTransaction(db, makeTx("t2", { amount: 50, categoryId: "sys_dining" }));

  const summary = await summarizeSpending(db);

  assert.equal(summary.total, 150);
  assert.equal(summary.currency, "TRY");
  assert.deepEqual(summary.byCurrency, [
    {
      currency: "TRY",
      total: 150,
      byCategory: [
        { categoryId: "sys_groceries", total: 100 },
        { categoryId: "sys_dining", total: 50 },
      ],
      byAccount: [{ accountId: "acc_1", total: 150 }],
      byMerchant: [],
    },
  ]);
});

test("summarizeSpending groups merchants per currency", async () => {
  const db = await freshDb();
  await insertTransaction(db, makeTx("t1", { amount: 40, merchant: "Migros" }));
  await insertTransaction(db, makeTx("t2", { amount: 60, merchant: " Migros " }));
  await insertTransaction(db, makeTx("t3", { amount: 25, merchant: "Cafe" }));
  await insertTransaction(db, makeTx("t4", { amount: 90, merchant: null }));
  await insertTransaction(
    db,
    makeTx("t5", { amount: 10, merchant: "Cafe", currency: "USD" }),
  );

  const summary = await summarizeSpending(db);

  assert.deepEqual(summary.byCurrency[0]!.byMerchant, [
    { merchant: "Migros", total: 100 },
    { merchant: "Cafe", total: 25 },
  ]);
  assert.deepEqual(summary.byCurrency[1]!.byMerchant, [{ merchant: "Cafe", total: 10 }]);
});

test("summarizeSpending respects the date range", async () => {
  const db = await freshDb();
  await insertTransaction(db, makeTx("t1", { amount: 100, date: 1_000 }));
  await insertTransaction(db, makeTx("t2", { amount: 200, date: 2_000 }));
  await insertTransaction(db, makeTx("t3", { amount: 400, date: 3_000 }));

  const summary = await summarizeSpending(db, { from: 1_000, to: 2_000 });
  assert.equal(summary.total, 300);
  assert.equal(summary.currency, "TRY");
});

test("summarizeSpending can be scoped to a calendar month", async () => {
  const db = await freshDb();
  const current = new Date(2026, 5, 15, 12).getTime(); // June 2026
  const previous = new Date(2026, 4, 15, 12).getTime(); // May 2026

  await insertTransaction(db, makeTx("t1", { amount: 100, date: current }));
  await insertTransaction(db, makeTx("t2", { amount: 200, date: previous }));

  const summary = await summarizeSpending(db, monthRange(current));
  assert.equal(summary.total, 100);
  assert.equal(summary.currency, "TRY");
});

test("summarizeSpending returns zero for an empty database", async () => {
  const db = await freshDb();
  const summary = await summarizeSpending(db);
  assert.equal(summary.total, 0);
  assert.equal(summary.currency, null);
  assert.deepEqual(summary.byCurrency, []);
});

test("getAccountBalances handles income, expenses and transfers", async () => {
  const db = await freshDb();
  await insertAccount(db, makeAccount({ id: "acc_2", name: "Savings" }));

  await insertTransaction(db, makeTx("t1", { type: "income", amount: 3000, categoryId: "sys_other" }));
  await insertTransaction(db, makeTx("t2", { amount: 100, categoryId: "sys_groceries" }));
  await insertTransaction(
    db,
    makeTx("t3", { type: "transfer", amount: 50, toAccountId: "acc_2", categoryId: null }),
  );
  await insertTransaction(db, makeTx("t4", { amount: 30, accountId: "acc_2", categoryId: "sys_dining" }));

  const balances = await getAccountBalances(db);

  assert.deepEqual(balances, [
    { accountId: "acc_1", inflow: 3000, outflow: 150, balance: 2850 },
    { accountId: "acc_2", inflow: 50, outflow: 30, balance: 20 },
  ]);
});

test("spendingTrend zero-fills the last months per currency", async () => {
  const db = await freshDb();
  const reference = new Date(2026, 5, 15, 12); // June 2026

  await insertTransaction(
    db,
    makeTx("t1", { amount: 100, date: new Date(2026, 5, 10).getTime() }),
  );
  await insertTransaction(
    db,
    makeTx("t2", { amount: 50, date: new Date(2026, 4, 10).getTime() }),
  );
  await insertTransaction(
    db,
    makeTx("t3", {
      type: "income",
      amount: 900,
      date: new Date(2026, 5, 1).getTime(),
      categoryId: "sys_other",
    }),
  );
  await insertTransaction(
    db,
    makeTx("t4", {
      amount: 30,
      currency: "USD",
      date: new Date(2026, 5, 5).getTime(),
    }),
  );
  // Outside the 3-month window.
  await insertTransaction(
    db,
    makeTx("t5", { amount: 999, date: new Date(2026, 1, 10).getTime() }),
  );

  const trend = await spendingTrend(db, { months: 3, reference });

  assert.deepEqual(
    trend.byCurrency.map((entry) => entry.currency),
    ["TRY", "USD"],
  );

  const tryTrend = trend.byCurrency[0]!;
  assert.equal(tryTrend.points.length, 3);
  assert.deepEqual(
    tryTrend.points.map((point) => point.total),
    [0, 50, 100],
  );
  assert.equal(tryTrend.points[0]!.from, new Date(2026, 3, 1).getTime());
  assert.equal(tryTrend.points[2]!.from, new Date(2026, 5, 1).getTime());
  assert.equal(tryTrend.points[2]!.to, new Date(2026, 6, 1).getTime() - 1);

  const usdTrend = trend.byCurrency[1]!;
  assert.deepEqual(
    usdTrend.points.map((point) => point.total),
    [0, 0, 30],
  );
});

test("spendingTrend is empty without expenses", async () => {
  const db = await freshDb();
  await insertTransaction(db, makeTx("t1", { type: "income", amount: 100 }));

  const trend = await spendingTrend(db, {
    months: 2,
    reference: new Date(2026, 5, 15, 12),
  });
  assert.deepEqual(trend.byCurrency, []);
});
