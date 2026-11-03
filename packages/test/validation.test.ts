import assert from "node:assert/strict";
import { test } from "node:test";

import { validateTransaction } from "../src/domain/validation.ts";
import type { Transaction } from "../src/domain/types.ts";

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
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

test("a valid expense has no errors", () => {
  assert.deepEqual(validateTransaction(makeTx()), []);
});

test("rejects a non-positive or non-finite amount", () => {
  assert.ok(validateTransaction(makeTx({ amount: 0 })).length > 0);
  assert.ok(validateTransaction(makeTx({ amount: -5 })).length > 0);
  assert.ok(validateTransaction(makeTx({ amount: Number.NaN })).length > 0);
});

test("rejects an invalid currency", () => {
  assert.ok(validateTransaction(makeTx({ currency: "TRY!" })).length > 0);
  assert.ok(validateTransaction(makeTx({ currency: "TR" })).length > 0);
});

test("enforces transfer-specific rules", () => {
  const good = makeTx({ type: "transfer", toAccountId: "acc_2", categoryId: null });
  assert.deepEqual(validateTransaction(good), []);

  // Missing target account.
  assert.ok(validateTransaction(makeTx({ type: "transfer", categoryId: null })).length > 0);
  // A transfer must not carry a category.
  assert.ok(
    validateTransaction(makeTx({ type: "transfer", toAccountId: "acc_2", categoryId: "sys_other" }))
      .length > 0,
  );
});

test("enforces non-transfer rules", () => {
  // Expense/income need a category and must not have a target account.
  assert.ok(validateTransaction(makeTx({ categoryId: null })).length > 0);
  assert.ok(validateTransaction(makeTx({ toAccountId: "acc_2" })).length > 0);
});
