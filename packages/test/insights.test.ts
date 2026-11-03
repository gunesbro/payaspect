import assert from "node:assert/strict";
import { test } from "node:test";

import { MemoryDatabaseDriver } from "../src/db/memoryDriver.ts";
import { openDatabase } from "../src/db/database.ts";
import { insertAccount } from "../src/db/repositories/accounts.ts";
import { insertTransaction } from "../src/db/repositories/transactions.ts";
import { summarizeSpending } from "../src/db/repositories/insights.ts";
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

test("summarizeSpending totals only expenses across categories/currencies", async () => {
  const db = await freshDb();
  await insertTransaction(db, makeTx("t1", { amount: 100, categoryId: "sys_groceries" }));
  await insertTransaction(db, makeTx("t2", { amount: 50, categoryId: "sys_dining" }));
  await insertTransaction(db, makeTx("t3", { type: "income", amount: 900, categoryId: "sys_other" }));
  await insertTransaction(db, makeTx("t4", { amount: 30, categoryId: "sys_groceries", currency: "USD" }));

  const summary = await summarizeSpending(db);

  assert.equal(summary.total, 180);

  assert.deepEqual(summary.byCategory, [
    { categoryId: "sys_groceries", total: 130 },
    { categoryId: "sys_dining", total: 50 },
  ]);

  assert.deepEqual(summary.byAccount, [{ accountId: "acc_1", total: 180 }]);

  assert.deepEqual(summary.byCurrency, [
    { currency: "TRY", total: 150 },
    { currency: "USD", total: 30 },
  ]);
});

test("summarizeSpending respects the date range", async () => {
  const db = await freshDb();
  await insertTransaction(db, makeTx("t1", { amount: 100, date: 1_000 }));
  await insertTransaction(db, makeTx("t2", { amount: 200, date: 2_000 }));
  await insertTransaction(db, makeTx("t3", { amount: 400, date: 3_000 }));

  const summary = await summarizeSpending(db, { from: 1_000, to: 2_000 });
  assert.equal(summary.total, 300);
});

test("summarizeSpending returns zero for an empty database", async () => {
  const db = await freshDb();
  const summary = await summarizeSpending(db);
  assert.equal(summary.total, 0);
  assert.deepEqual(summary.byCategory, []);
  assert.deepEqual(summary.byAccount, []);
  assert.deepEqual(summary.byCurrency, []);
});
