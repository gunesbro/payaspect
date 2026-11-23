import assert from "node:assert/strict";
import { test } from "node:test";

import { openDatabase } from "../src/db/database.ts";
import { MemoryDatabaseDriver } from "../src/db/memoryDriver.ts";
import { insertAccount } from "../src/db/repositories/accounts.ts";
import { upsertBudget } from "../src/db/repositories/budgets.ts";
import { insertCategory } from "../src/db/repositories/categories.ts";
import { insertTransaction } from "../src/db/repositories/transactions.ts";
import {
  buildEncryptedBackupJson,
  collectEncryptedBackup,
  parseEncryptedBackupJson,
  restoreEncryptedBackup,
  BACKUP_FORMAT,
  BACKUP_VERSION,
} from "../src/export/encryptedBackup.ts";
import type {
  Account,
  Budget,
  Category,
  Transaction,
} from "../src/domain/types.ts";

const TEST_KEY = "test-key-not-a-real-secret";

function makeAccount(): Account {
  return {
    id: "acc_1",
    name: "Checking",
    type: "bank",
    currency: "TRY",
    isBudget: true,
    creditLimit: null,
    statementDay: null,
    minPaymentDay: null,
    currentValue: null,
    note: null,
    archived: false,
    createdAt: 0,
  };
}

function makeCategory(): Category {
  return {
    id: "custom_1",
    key: null,
    name: "My category",
    parentId: null,
    type: "expense",
    isSystem: false,
    hidden: false,
    sort: 99,
  };
}

function makeTransaction(): Transaction {
  return {
    id: "tx_1",
    type: "expense",
    amount: 125.5,
    currency: "TRY",
    accountId: "acc_1",
    toAccountId: null,
    categoryId: "custom_1",
    date: 1_700_000_000_000,
    merchant: "Store",
    note: null,
    isRecurring: false,
    source: "manual",
    createdAt: 1_700_000_000_000,
  };
}

function makeBudget(): Budget {
  return {
    id: "b_1",
    categoryId: "custom_1",
    currency: "TRY",
    amount: 500,
    createdAt: 0,
  };
}

async function freshDb(): Promise<MemoryDatabaseDriver> {
  const db = new MemoryDatabaseDriver();
  await openDatabase(db, { getOrCreateKey: async () => TEST_KEY });
  return db;
}

async function seededDb(): Promise<MemoryDatabaseDriver> {
  const db = await freshDb();
  await insertCategory(db, makeCategory());
  await insertAccount(db, makeAccount());
  await insertTransaction(db, makeTransaction());
  return db;
}

test("backup JSON round-trips every table with a format marker", () => {
  const data = {
    accounts: [makeAccount()],
    categories: [makeCategory()],
    transactions: [makeTransaction()],
    budgets: [makeBudget()],
  };
  const json = buildEncryptedBackupJson(data);
  const document = JSON.parse(json);

  assert.equal(document.format, BACKUP_FORMAT);
  assert.equal(document.version, BACKUP_VERSION);
  assert.ok(!Number.isNaN(Date.parse(document.exportedAt)));
  assert.deepEqual(parseEncryptedBackupJson(json), data);
});

test("parse rejects corrupt, foreign and malformed backups", () => {
  assert.throws(() => parseEncryptedBackupJson("not json"));
  assert.throws(() => parseEncryptedBackupJson("[]"));
  assert.throws(() => parseEncryptedBackupJson(JSON.stringify({ format: "other" })));

  const valid = JSON.parse(
    buildEncryptedBackupJson({
      accounts: [makeAccount()],
      categories: [makeCategory()],
      transactions: [makeTransaction()],
      budgets: [makeBudget()],
    }),
  );

  assert.throws(() =>
    parseEncryptedBackupJson(JSON.stringify({ ...valid, version: 99 })),
  );
  assert.throws(() =>
    parseEncryptedBackupJson(JSON.stringify({ ...valid, budgets: null })),
  );
  assert.throws(() =>
    parseEncryptedBackupJson(
      JSON.stringify({ ...valid, transactions: [{ ...makeTransaction(), amount: -1 }] }),
    ),
  );
  assert.throws(() =>
    parseEncryptedBackupJson(
      JSON.stringify({ ...valid, budgets: [{ ...makeBudget(), amount: 0 }] }),
    ),
  );
  assert.throws(() =>
    parseEncryptedBackupJson(
      JSON.stringify({ ...valid, accounts: [{ ...makeAccount(), type: "crypto" }] }),
    ),
  );
  assert.throws(() =>
    parseEncryptedBackupJson(
      JSON.stringify({ ...valid, accounts: [{ ...makeAccount(), currentValue: -5 }] }),
    ),
  );
});

test("backup round-trips investment accounts with their current value", () => {
  const investment: Account = {
    ...makeAccount(),
    id: "acc_inv",
    name: "Stocks",
    type: "investment",
    isBudget: false,
    currentValue: 1234.56,
  };
  const data = {
    accounts: [makeAccount(), investment],
    categories: [makeCategory()],
    transactions: [makeTransaction()],
    budgets: [makeBudget()],
  };
  assert.deepEqual(
    parseEncryptedBackupJson(buildEncryptedBackupJson(data)),
    data,
  );
});

test("collect reads accounts, categories, transactions and budgets", async () => {
  const db = await seededDb();
  await upsertBudget(db, makeBudget());

  const data = await collectEncryptedBackup(db);
  assert.deepEqual(
    data.accounts.map((a) => a.id),
    ["acc_1"],
  );
  assert.ok(data.categories.some((c) => c.id === "custom_1"));
  assert.deepEqual(
    data.transactions.map((t) => t.id),
    ["tx_1"],
  );
  assert.deepEqual(
    data.budgets.map((b) => b.id),
    ["b_1"],
  );
});

test("restore replaces data atomically without rolling back the schema", async () => {
  const source = await seededDb();
  await upsertBudget(source, makeBudget());
  const data = await collectEncryptedBackup(source);

  const target = await freshDb();
  // Pre-existing data must be fully replaced, not merged.
  await insertAccount(target, {
    ...makeAccount(),
    id: "old_account",
    name: "Old",
  });
  await restoreEncryptedBackup(target, data);

  const restored = await collectEncryptedBackup(target);
  assert.deepEqual(restored, data);
  assert.equal(restored.accounts.some((a) => a.id === "old_account"), false);

  // Schema version and migration bookkeeping survive the restore.
  const version = await target.get("SELECT value FROM meta WHERE key = ?", [
    "schema_version",
  ]);
  assert.ok(version != null);
  assert.ok(target._tableNames().includes("schema_migrations"));
});
