import assert from "node:assert/strict";
import { test } from "node:test";

import { buildBackupJson, transactionsToCsv } from "../src/export/exportData.ts";
import { openDatabase } from "../src/db/database.ts";
import { MemoryDatabaseDriver } from "../src/db/memoryDriver.ts";
import { insertAccount } from "../src/db/repositories/accounts.ts";
import {
  insertTransaction,
  listAllTransactions,
} from "../src/db/repositories/transactions.ts";
import type { Account, Transaction } from "../src/domain/types.ts";

const DAY = 24 * 60 * 60 * 1000;
const DATE = Date.UTC(2026, 0, 15);

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "tx_1",
    type: "expense",
    amount: 12.5,
    currency: "TRY",
    accountId: "acc_1",
    toAccountId: null,
    categoryId: "sys_groceries",
    date: DATE,
    merchant: "Market",
    note: null,
    isRecurring: false,
    source: "manual",
    createdAt: DATE + DAY,
    ...overrides,
  };
}

test("transactionsToCsv uses stable headers and ISO dates", () => {
  const csv = transactionsToCsv([transaction()]);
  const lines = csv.split("\r\n");
  assert.equal(lines.length, 2);
  assert.equal(lines[0], "id,type,date,amount,currency,account_id,to_account_id,category_id,merchant,note,is_recurring,source,created_at");
  assert.equal(
    lines[1],
    `tx_1,expense,2026-01-15,12.5,TRY,acc_1,,sys_groceries,Market,,0,manual,${DATE + DAY}`,
  );
});

test("transactionsToCsv escapes quotes, commas and newlines", () => {
  const csv = transactionsToCsv([
    transaction({ merchant: 'Shop, "A"\nBranch', note: "line1\nline2" }),
  ]);
  assert.match(csv, /"Shop, ""A""\nBranch"/);
  assert.match(csv, /"line1\nline2"/);
});

test("buildBackupJson includes all data with a version marker", () => {
  const tx = transaction();
  const parsed = JSON.parse(
    buildBackupJson({
      accounts: [],
      categories: [],
      transactions: [tx],
    }),
  );
  assert.equal(parsed.format, "payaspect-backup");
  assert.equal(parsed.version, 1);
  assert.deepEqual(parsed.transactions, [tx]);
});

test("listAllTransactions returns every row oldest-first", async () => {
  const db = new MemoryDatabaseDriver();
  await openDatabase(db, { getOrCreateKey: async () => "test-key-not-a-real-secret" });
  const account: Account = {
    id: "acc_1",
    name: "Cash",
    type: "cash",
    currency: "TRY",
    isBudget: true,
    archived: false,
    createdAt: DATE,
  };
  await insertAccount(db, account);

  for (let index = 0; index < 101; index += 1) {
    await insertTransaction(db, transaction({ id: `tx_${index}`, date: DATE + index }));
  }

  const all = await listAllTransactions(db);
  assert.equal(all.length, 101);
  assert.equal(all[0]?.id, "tx_0");
  assert.equal(all[100]?.id, "tx_100");
});
