import assert from "node:assert/strict";
import { test } from "node:test";

import { MemoryDatabaseDriver } from "../src/db/memoryDriver.ts";
import { openDatabase } from "../src/db/database.ts";
import {
  insertCategory,
  listAllCategories,
  listCategories,
  updateCategory,
} from "../src/db/repositories/categories.ts";
import type { Category } from "../src/domain/types.ts";

const TEST_KEY = "test-key-not-a-real-secret";

async function freshDb(): Promise<MemoryDatabaseDriver> {
  const db = new MemoryDatabaseDriver();
  await openDatabase(db, { getOrCreateKey: async () => TEST_KEY });
  return db;
}

function customCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: "cat_custom",
    key: null,
    name: "Pets",
    parentId: null,
    type: "expense",
    isSystem: false,
    hidden: false,
    sort: 100,
    ...overrides,
  };
}

test("listAllCategories includes hidden rows while listCategories excludes them", async () => {
  const db = await freshDb();
  await insertCategory(db, customCategory());
  await insertCategory(db, customCategory({ id: "cat_hidden", name: "Old", hidden: true }));

  const all = await listAllCategories(db);
  assert.ok(all.some((category) => category.id === "cat_hidden"));

  const visible = await listCategories(db);
  assert.ok(visible.some((category) => category.id === "cat_custom"));
  assert.ok(!visible.some((category) => category.id === "cat_hidden"));
});

test("updateCategory keeps a system category's key and system flag", async () => {
  const db = await freshDb();
  const original = (await listAllCategories(db)).find(
    (category) => category.id === "sys_groceries",
  );
  assert.ok(original);

  await updateCategory(db, { ...original, name: "Food", hidden: true });

  const stored = (await listAllCategories(db)).find(
    (category) => category.id === "sys_groceries",
  );
  assert.equal(stored?.key, "groceries");
  assert.equal(stored?.isSystem, true);
  assert.equal(stored?.name, "Food");
  assert.equal(stored?.hidden, true);
});

test("custom categories round-trip through the database", async () => {
  const db = await freshDb();
  await insertCategory(db, customCategory());

  const stored = (await listAllCategories(db)).find(
    (category) => category.id === "cat_custom",
  );
  assert.deepEqual(stored, customCategory());
});
