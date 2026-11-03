import assert from "node:assert/strict";
import { test } from "node:test";

import { MemoryDatabaseDriver } from "../src/db/memoryDriver.ts";
import { openDatabase } from "../src/db/database.ts";
import {
  deleteRate,
  getRate,
  listRates,
  upsertRate,
} from "../src/db/repositories/rates.ts";
import type { Rate } from "../src/domain/types.ts";

const TEST_KEY = "test-key-not-a-real-secret";

function makeRate(overrides: Partial<Rate> = {}): Rate {
  return { base: "USD", quote: "TRY", rate: 34.5, fetchedAt: 1_700_000_000_000, ...overrides };
}

async function freshDb(): Promise<MemoryDatabaseDriver> {
  const db = new MemoryDatabaseDriver();
  await openDatabase(db, { getOrCreateKey: async () => TEST_KEY });
  return db;
}

test("rates round-trip through the database and upsert by composite key", async () => {
  const db = await freshDb();
  await upsertRate(db, makeRate());
  await upsertRate(db, makeRate({ base: "EUR", quote: "TRY", rate: 37.2 }));

  assert.deepEqual(
    (await listRates(db)).map((r) => `${r.base}/${r.quote}`),
    ["EUR/TRY", "USD/TRY"],
  );

  // Upsert updates the existing (base, quote) pair rather than duplicating it.
  await upsertRate(db, makeRate({ base: "USD", quote: "TRY", rate: 35.1, fetchedAt: 2 }));
  const usd = await getRate(db, "USD", "TRY");
  assert.equal(usd?.rate, 35.1);
  assert.equal(usd?.fetchedAt, 2);
  assert.equal((await listRates(db)).length, 2);

  await deleteRate(db, "USD", "TRY");
  assert.equal(await getRate(db, "USD", "TRY"), null);
  assert.equal((await listRates(db)).length, 1);
});

test("getRate returns null for an unknown pair", async () => {
  const db = await freshDb();
  assert.equal(await getRate(db, "GBP", "JPY"), null);
});
