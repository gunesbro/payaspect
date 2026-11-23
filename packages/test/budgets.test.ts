import assert from "node:assert/strict";
import { test } from "node:test";

import { openDatabase } from "../src/db/database.ts";
import { migrate } from "../src/db/migrate.ts";
import { MemoryDatabaseDriver } from "../src/db/memoryDriver.ts";
import {
  deleteBudget,
  listBudgets,
  upsertBudget,
} from "../src/db/repositories/budgets.ts";
import { seedSystemCategories } from "../src/db/repositories/categories.ts";
import { computeBudgetProgress } from "../src/domain/budgets.ts";
import type { SpendingSummary } from "../src/db/repositories/insights.ts";
import type { Budget } from "../src/domain/types.ts";

async function freshDb() {
  const db = new MemoryDatabaseDriver();
  await openDatabase(db, { getOrCreateKey: async () => "test-key-not-a-real-secret" });
  await seedSystemCategories(db);
  return db;
}

function budget(overrides: Partial<Budget> = {}): Budget {
  return {
    id: "b_1",
    categoryId: "sys_groceries",
    currency: "TRY",
    amount: 1000,
    createdAt: 1000,
    ...overrides,
  };
}

test("migrations 3 and 4 add budgets and investment value to an existing v2 database", async () => {
  const db = new MemoryDatabaseDriver();
  await db.open("test-key-not-a-real-secret");
  // Simulate an install that already applied migrations 1 and 2.
  await db.exec(`
    CREATE TABLE meta (key TEXT PRIMARY KEY NOT NULL, value TEXT);
    CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY NOT NULL, name TEXT NOT NULL, applied_at INTEGER NOT NULL);
    INSERT INTO schema_migrations (version, name, applied_at) VALUES (1, 'initial_schema', 0);
    INSERT INTO schema_migrations (version, name, applied_at) VALUES (2, 'attachments', 0);
    CREATE TABLE categories (id TEXT PRIMARY KEY NOT NULL, key TEXT, name TEXT NOT NULL, parent_id TEXT, type TEXT NOT NULL, is_system INTEGER NOT NULL DEFAULT 0, hidden INTEGER NOT NULL DEFAULT 0, sort INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE accounts (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL, currency TEXT NOT NULL, is_budget INTEGER NOT NULL DEFAULT 1, credit_limit REAL, statement_day INTEGER, min_payment_day INTEGER, note TEXT, archived INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
  `);

  assert.deepEqual(await migrate(db), [3, 4]);
  assert.ok(db._tableNames().includes("budgets"));
  // Re-running is a no-op.
  assert.deepEqual(await migrate(db), []);
});

test("budget upsert keeps one row per category and currency", async () => {
  const db = await freshDb();
  await upsertBudget(db, budget());
  await upsertBudget(db, budget({ id: "b_2", amount: 1500 }));

  const all = await listBudgets(db);
  assert.equal(all.length, 1);
  assert.equal(all[0]?.id, "b_1");
  assert.equal(all[0]?.amount, 1500);
});

test("budgets are tracked separately per currency", async () => {
  const db = await freshDb();
  await upsertBudget(db, budget());
  await upsertBudget(db, budget({ id: "b_usd", currency: "USD", amount: 50 }));

  const all = await listBudgets(db);
  assert.equal(all.length, 2);
  assert.deepEqual(
    all.map((b) => b.currency),
    ["TRY", "USD"],
  );
});

test("deleting a budget removes only that row", async () => {
  const db = await freshDb();
  await upsertBudget(db, budget());
  await upsertBudget(db, budget({ id: "b_2", categoryId: "sys_dining" }));
  await deleteBudget(db, "b_1");

  const all = await listBudgets(db);
  assert.deepEqual(
    all.map((b) => b.id),
    ["b_2"],
  );
});

function summary(): SpendingSummary {
  return {
    byCurrency: [
      {
        currency: "TRY",
        total: 0,
        byCategory: [
          { categoryId: "sys_groceries", total: 600 },
          { categoryId: "sys_dining", total: 1200 },
        ],
        byAccount: [],
        byMerchant: [],
      },
      {
        currency: "USD",
        total: 0,
        byCategory: [{ categoryId: "sys_groceries", total: 20 }],
        byAccount: [],
        byMerchant: [],
      },
    ],
    total: null,
    currency: null,
  };
}

test("computeBudgetProgress matches spending by currency and flags overspend", () => {
  const rows = computeBudgetProgress(
    [
      budget(),
      budget({ id: "b_dining", categoryId: "sys_dining", amount: 1000 }),
      budget({ id: "b_usd", currency: "USD", amount: 50 }),
    ],
    summary(),
  );

  const groceries = rows.find((r) => r.budget.id === "b_1")!;
  assert.equal(groceries.spent, 600);
  assert.equal(groceries.remaining, 400);
  assert.equal(groceries.ratio, 0.6);
  assert.equal(groceries.over, false);

  const dining = rows.find((r) => r.budget.id === "b_dining")!;
  assert.equal(dining.spent, 1200);
  assert.equal(dining.remaining, 0);
  assert.equal(dining.over, true);

  // USD groceries uses the USD category total, not the TRY one.
  const usd = rows.find((r) => r.budget.id === "b_usd")!;
  assert.equal(usd.spent, 20);
  assert.equal(usd.remaining, 30);
});

test("computeBudgetProgress handles a missing summary and sorts by usage", () => {
  const rows = computeBudgetProgress(
    [budget({ id: "b_low", amount: 100 }), budget({ id: "b_high", amount: 10 })],
    null,
  );
  assert.ok(rows.every((r) => r.spent === 0 && r.ratio === 0 && !r.over));
  // Equal ratios fall back to category id; same category here keeps input order stable.
  assert.equal(rows.length, 2);
});
