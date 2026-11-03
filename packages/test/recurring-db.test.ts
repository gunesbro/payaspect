import assert from "node:assert/strict";
import { test } from "node:test";

import { MemoryDatabaseDriver } from "../src/db/memoryDriver.ts";
import { openDatabase } from "../src/db/database.ts";
import { insertAccount } from "../src/db/repositories/accounts.ts";
import { insertTransaction, listTransactions } from "../src/db/repositories/transactions.ts";
import { markRecurringTransactions } from "../src/db/repositories/recurring.ts";
import type { Account, Transaction } from "../src/domain/types.ts";

const TEST_KEY = "test-key-not-a-real-secret";
const DAY = 86_400_000;

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
    accountId: "acc_1",
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

async function freshDb(): Promise<MemoryDatabaseDriver> {
  const db = new MemoryDatabaseDriver();
  await openDatabase(db, { getOrCreateKey: async () => TEST_KEY });
  await insertAccount(db, makeAccount());
  return db;
}

test("markRecurringTransactions flags detected recurring rows", async () => {
  const db = await freshDb();
  await insertTransaction(db, makeTx("t1", 0, 100, "Netflix"));
  await insertTransaction(db, makeTx("t2", 30 * DAY, 100, "Netflix"));
  await insertTransaction(db, makeTx("t3", 60 * DAY, 105, "Netflix"));
  await insertTransaction(db, makeTx("t4", 0, 40, "Migros"));

  const marked = await markRecurringTransactions(db);
  assert.deepEqual([...marked].sort(), ["t1", "t2", "t3"]);

  const flagged = (await listTransactions(db))
    .filter((t) => t.isRecurring)
    .map((t) => t.id)
    .sort();
  assert.deepEqual(flagged, ["t1", "t2", "t3"]);
});

test("markRecurringTransactions is a no-op when nothing matches", async () => {
  const db = await freshDb();
  await insertTransaction(db, makeTx("t1", 0, 100, "Migros"));

  assert.deepEqual(await markRecurringTransactions(db), []);
  assert.equal((await listTransactions(db))[0]?.isRecurring, false);
});
