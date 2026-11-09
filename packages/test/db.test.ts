import assert from "node:assert/strict";
import { test } from "node:test";

import { MemoryDatabaseDriver } from "../src/db/memoryDriver.ts";
import { openDatabase } from "../src/db/database.ts";
import { migrate } from "../src/db/migrate.ts";
import { CURRENT_SCHEMA_VERSION, MIGRATIONS } from "../src/db/schema.ts";
import { getCategoryById, listCategories } from "../src/db/repositories/categories.ts";
import {
  archiveAccount,
  getAccountById,
  insertAccount,
  listAccounts,
} from "../src/db/repositories/accounts.ts";
import {
  deleteTransaction,
  getTransactionById,
  insertTransaction,
  listTransactions,
  updateTransaction,
} from "../src/db/repositories/transactions.ts";
import {
  insertAttachment,
  listAttachmentsForTransaction,
} from "../src/db/repositories/attachments.ts";
import { SYSTEM_CATEGORY_KEYS } from "../src/domain/categories.ts";
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
    createdAt: 1_700_000_000_000,
    ...overrides,
  };
}

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "tx_1",
    type: "expense",
    amount: 129.9,
    currency: "TRY",
    accountId: "acc_1",
    toAccountId: null,
    categoryId: "sys_groceries",
    date: 1_700_000_000_000,
    merchant: "Market",
    note: null,
    isRecurring: false,
    source: "manual",
    createdAt: 1_700_000_000_000,
    ...overrides,
  };
}

async function freshDb(): Promise<MemoryDatabaseDriver> {
  const db = new MemoryDatabaseDriver();
  await openDatabase(db, { getOrCreateKey: async () => TEST_KEY });
  return db;
}

// --- driver basics ---------------------------------------------------------

test("driver requires a non-empty encryption key", async () => {
  const db = new MemoryDatabaseDriver();
  await assert.rejects(() => db.open(""), /non-empty encryption key/);
});

test("driver creates tables and rejects unknown tables", async () => {
  const db = new MemoryDatabaseDriver();
  await db.open(TEST_KEY);
  await db.exec("CREATE TABLE t (id TEXT PRIMARY KEY NOT NULL, n INTEGER DEFAULT 0)");

  assert.deepEqual(db._tableNames(), ["t"]);
  await assert.rejects(() => db.all("SELECT * FROM missing"), /no such table/);
  await assert.rejects(
    () => db.exec("CREATE TABLE bad (id TEXT); DROP TABLE nope;"),
    /no such table/,
  );
});

test("driver enforces the primary key unless a conflict clause is given", async () => {
  const db = new MemoryDatabaseDriver();
  await db.open(TEST_KEY);
  await db.exec("CREATE TABLE t (id TEXT PRIMARY KEY NOT NULL, v TEXT)");

  await db.run("INSERT INTO t (id, v) VALUES (?, ?)", ["a", "one"]);
  await assert.rejects(
    () => db.run("INSERT INTO t (id, v) VALUES (?, ?)", ["a", "two"]),
    /UNIQUE constraint failed/,
  );

  await db.run("INSERT INTO t (id, v) VALUES (?, ?) ON CONFLICT(id) DO NOTHING", ["a", "two"]);
  assert.deepEqual(db._rows("t"), [{ id: "a", v: "one" }]);

  await db.run("INSERT INTO t (id, v) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET v = excluded.v", [
    "a",
    "two",
  ]);
  assert.deepEqual(db._rows("t"), [{ id: "a", v: "two" }]);
});

test("driver supports WHERE, ORDER BY, LIMIT and OFFSET", async () => {
  const db = new MemoryDatabaseDriver();
  await db.open(TEST_KEY);
  await db.exec("CREATE TABLE t (id TEXT PRIMARY KEY NOT NULL, amount REAL, kind TEXT)");

  const rows: Array<[string, number, string]> = [
    ["a", 10, "expense"],
    ["b", 30, "income"],
    ["c", 20, "expense"],
    ["d", 40, "expense"],
  ];
  for (const [id, amount, kind] of rows) {
    await db.run("INSERT INTO t (id, amount, kind) VALUES (?, ?, ?)", [id, amount, kind]);
  }

  const expenses = await db.all(
    "SELECT id FROM t WHERE kind = ? AND amount >= ? ORDER BY amount DESC LIMIT ? OFFSET ?",
    ["expense", 20, 2, 0],
  );
  assert.deepEqual(
    expenses.map((r) => r.id),
    ["d", "c"],
  );

  const one = await db.get("SELECT * FROM t WHERE id = ?", ["b"]);
  assert.equal(one?.amount, 30);

  assert.equal(await db.get("SELECT * FROM t WHERE id = ?", ["zzz"]), null);
});

test("driver counts rows with COUNT(*)", async () => {
  const db = new MemoryDatabaseDriver();
  await db.open(TEST_KEY);
  await db.exec("CREATE TABLE t (id TEXT PRIMARY KEY NOT NULL, v TEXT)");
  await db.run("INSERT INTO t (id, v) VALUES (?, ?)", ["a", null]);
  await db.run("INSERT INTO t (id, v) VALUES (?, ?)", ["b", "x"]);

  assert.equal((await db.get("SELECT COUNT(*) AS c FROM t"))?.c, 2);
  assert.equal((await db.get("SELECT COUNT(v) AS c FROM t"))?.c, 1);
});

test("driver rolls back a failed transaction", async () => {
  const db = new MemoryDatabaseDriver();
  await db.open(TEST_KEY);
  await db.exec("CREATE TABLE t (id TEXT PRIMARY KEY NOT NULL)");

  await assert.rejects(
    () =>
      db.transaction(async (tx) => {
        await tx.run("INSERT INTO t (id) VALUES (?)", ["a"]);
        throw new Error("boom");
      }),
    /boom/,
  );
  assert.deepEqual(db._rows("t"), []);

  await db.transaction(async (tx) => {
    await tx.run("INSERT INTO t (id) VALUES (?)", ["b"]);
  });
  assert.deepEqual(db._rows("t"), [{ id: "b" }]);
});

// --- migrations ------------------------------------------------------------

test("migrate applies migrations once and is idempotent", async () => {
  const db = new MemoryDatabaseDriver();
  await db.open(TEST_KEY);

  assert.deepEqual(
    await migrate(db),
    MIGRATIONS.map((m) => m.version),
  );
  assert.deepEqual(await migrate(db), []);

  const version = await db.get("SELECT value FROM meta WHERE key = ?", ["schema_version"]);
  assert.equal(version?.value, String(CURRENT_SCHEMA_VERSION));
});

test("openDatabase seeds system categories exactly once", async () => {
  const db = await freshDb();

  assert.equal((await listCategories(db)).length, SYSTEM_CATEGORY_KEYS.length);

  // Re-opening the same database must not duplicate the seeded rows.
  await openDatabase(db, { getOrCreateKey: async () => TEST_KEY });
  assert.equal((await listCategories(db)).length, SYSTEM_CATEGORY_KEYS.length);

  const groceries = await getCategoryById(db, "sys_groceries");
  assert.equal(groceries?.key, "groceries");
  assert.equal(groceries?.isSystem, true);

  assert.equal(await getCategoryById(db, "nope"), null);
});

// --- repositories ----------------------------------------------------------

test("accounts round-trip through the database", async () => {
  const db = await freshDb();
  await insertAccount(db, makeAccount());
  await insertAccount(
    db,
    makeAccount({ id: "acc_2", name: "Card", type: "credit_card", creditLimit: 5000 }),
  );

  assert.deepEqual(
    (await listAccounts(db)).map((a) => a.id),
    ["acc_1", "acc_2"],
  );

  const card = await getAccountById(db, "acc_2");
  assert.equal(card?.type, "credit_card");
  assert.equal(card?.creditLimit, 5000);

  await archiveAccount(db, "acc_2");
  assert.deepEqual(
    (await listAccounts(db)).map((a) => a.id),
    ["acc_1"],
  );
  assert.deepEqual(
    (await listAccounts(db, true)).map((a) => a.id),
    ["acc_1", "acc_2"],
  );
  assert.equal((await getAccountById(db, "acc_2"))?.archived, true);
});

test("transactions can be inserted, filtered, read and deleted", async () => {
  const db = await freshDb();
  await insertAccount(db, makeAccount());

  await insertTransaction(db, makeTransaction({ id: "tx_1", date: 1_000 }));
  await insertTransaction(
    db,
    makeTransaction({ id: "tx_2", date: 2_000, categoryId: "sys_dining", amount: 50 }),
  );
  await insertTransaction(
    db,
    makeTransaction({ id: "tx_3", date: 3_000, type: "income", categoryId: "sys_other", amount: 900 }),
  );

  // Newest first by default.
  assert.deepEqual(
    (await listTransactions(db)).map((t) => t.id),
    ["tx_3", "tx_2", "tx_1"],
  );

  // Date range is inclusive on both ends.
  assert.deepEqual(
    (await listTransactions(db, { from: 1_000, to: 2_000 })).map((t) => t.id),
    ["tx_2", "tx_1"],
  );

  assert.deepEqual(
    (await listTransactions(db, { categoryId: "sys_dining" })).map((t) => t.id),
    ["tx_2"],
  );

  // Limit is clamped to the documented range.
  assert.equal((await listTransactions(db, { limit: 1 })).length, 1);
  assert.equal((await listTransactions(db, { limit: 0 })).length, 1);
  assert.equal((await listTransactions(db, { limit: 10_000 })).length, 3);

  assert.deepEqual(
    (await listTransactions(db, { limit: 1, offset: 1 })).map((t) => t.id),
    ["tx_2"],
  );

  const tx = await getTransactionById(db, "tx_1");
  assert.equal(tx?.amount, 129.9);
  assert.equal(tx?.isRecurring, false);
  assert.equal(tx?.source, "manual");

  await insertAttachment(db, {
    id: "att_1",
    transactionId: "tx_2",
    filePath: "file:///receipts/att_1.jpg",
    mime: "image/jpeg",
    createdAt: 1,
  });

  await deleteTransaction(db, "tx_2");
  assert.equal(await getTransactionById(db, "tx_2"), null);
  // Attachments must not survive their transaction, even without FK pragma.
  assert.deepEqual(await listAttachmentsForTransaction(db, "tx_2"), []);
  assert.equal((await listTransactions(db)).length, 2);
});

test("transactions can be updated in place without changing identity", async () => {
  const db = await freshDb();
  await insertAccount(db, makeAccount());

  const original = makeTransaction({ id: "tx_1" });
  await insertTransaction(db, original);

  await updateTransaction(db, {
    ...original,
    type: "income",
    amount: 250,
    currency: "USD",
    categoryId: "sys_other",
    merchant: null,
    note: "corrected",
    date: 1_700_000_100_000,
    isRecurring: true,
  });

  assert.deepEqual(await getTransactionById(db, "tx_1"), {
    ...original,
    type: "income",
    amount: 250,
    currency: "USD",
    categoryId: "sys_other",
    merchant: null,
    note: "corrected",
    date: 1_700_000_100_000,
    isRecurring: true,
  });

  // Updating a missing id is a no-op instead of inserting a new row.
  await updateTransaction(db, { ...original, id: "tx_missing" });
  assert.equal(await getTransactionById(db, "tx_missing"), null);
  assert.equal((await listTransactions(db)).length, 1);
});

test("queries are parameterized: hostile input is stored, not executed", async () => {
  const db = await freshDb();
  await insertAccount(db, makeAccount());

  const hostile = "Robert'); DROP TABLE transactions; --";
  await insertTransaction(db, makeTransaction({ id: "tx_x", merchant: hostile }));

  assert.equal((await getTransactionById(db, "tx_x"))?.merchant, hostile);
  assert.equal((await listTransactions(db)).length, 1);
});
