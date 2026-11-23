import assert from "node:assert/strict";
import { test } from "node:test";

import { openDatabase } from "../src/db/database.ts";
import { migrate } from "../src/db/migrate.ts";
import { MemoryDatabaseDriver } from "../src/db/memoryDriver.ts";
import {
  insertAccount,
  listAccounts,
  updateAccountValue,
} from "../src/db/repositories/accounts.ts";
import {
  ACCOUNT_TYPES,
  investmentTotals,
  isBudgetAccount,
  isTrackingAccount,
} from "../src/domain/accounts.ts";
import type { Account } from "../src/domain/types.ts";

const KEY = "test-key-not-a-real-secret";

function account(overrides: Partial<Account> = {}): Account {
  return {
    id: "acc_1",
    name: "Portfolio",
    type: "investment",
    currency: "TRY",
    isBudget: false,
    creditLimit: null,
    statementDay: null,
    minPaymentDay: null,
    currentValue: 1000,
    note: null,
    archived: false,
    createdAt: 0,
    ...overrides,
  };
}

async function freshDb(): Promise<MemoryDatabaseDriver> {
  const db = new MemoryDatabaseDriver();
  await openDatabase(db, { getOrCreateKey: async () => KEY });
  return db;
}

test("investment is a tracking account type, never a budget account", () => {
  assert.ok(ACCOUNT_TYPES.includes("investment"));
  assert.equal(isBudgetAccount("investment"), false);
  assert.equal(isTrackingAccount("investment"), true);
  assert.equal(isTrackingAccount("loan"), true);
  assert.equal(isBudgetAccount("bank"), true);
});

test("migration 4 adds the optional current value to an existing v3 database", async () => {
  const db = new MemoryDatabaseDriver();
  await db.open(KEY);
  await db.exec(`
    CREATE TABLE meta (key TEXT PRIMARY KEY NOT NULL, value TEXT);
    CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY NOT NULL, name TEXT NOT NULL, applied_at INTEGER NOT NULL);
    INSERT INTO schema_migrations (version, name, applied_at) VALUES (1, 'initial_schema', 0);
    INSERT INTO schema_migrations (version, name, applied_at) VALUES (2, 'attachments', 0);
    INSERT INTO schema_migrations (version, name, applied_at) VALUES (3, 'budgets', 0);
    CREATE TABLE accounts (
      id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL,
      currency TEXT NOT NULL, is_budget INTEGER NOT NULL DEFAULT 1,
      credit_limit REAL, statement_day INTEGER, min_payment_day INTEGER,
      note TEXT, archived INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
    );
  `);

  assert.deepEqual(await migrate(db), [4]);
  assert.deepEqual(await migrate(db), []);

  // Existing rows without the new column still load with a null value.
  await db.run(
    "INSERT INTO accounts (id, name, type, currency, is_budget, archived, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ["old", "Legacy", "bank", "TRY", 1, 0, 0],
  );
  const rows = await listAccounts(db);
  assert.equal(rows[0]?.currentValue, null);
});

test("investment current value persists and can be updated", async () => {
  const db = await freshDb();
  await insertAccount(db, account());
  assert.equal((await listAccounts(db))[0]?.currentValue, 1000);

  await updateAccountValue(db, "acc_1", 1234.56);
  assert.equal((await listAccounts(db))[0]?.currentValue, 1234.56);

  await updateAccountValue(db, "acc_1", null);
  assert.equal((await listAccounts(db))[0]?.currentValue, null);
});

test("investment totals stay per currency and skip archived or invalid values", () => {
  const totals = investmentTotals([
    account({ id: "a", currency: "TRY", currentValue: 100 }),
    account({ id: "b", currency: "TRY", currentValue: 250.5 }),
    account({ id: "c", currency: "USD", currentValue: 40 }),
    account({ id: "d", currency: "EUR", currentValue: null }),
    account({ id: "e", currency: "EUR", currentValue: Number.NaN }),
    account({ id: "f", currency: "GBP", currentValue: 99, archived: true }),
    account({ id: "g", currency: "GBP", currentValue: 10, type: "bank" }),
  ]);

  assert.deepEqual(totals, [
    { currency: "TRY", total: 350.5 },
    { currency: "USD", total: 40 },
  ]);
});
