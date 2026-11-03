import assert from "node:assert/strict";
import { test } from "node:test";

import { isBudgetAccount, supportsCreditFields } from "../src/domain/accounts.ts";
import {
  defaultSystemCategories,
  isSystemCategoryKey,
  SYSTEM_CATEGORY_KEYS,
} from "../src/domain/categories.ts";

test("defaultSystemCategories matches the stable key list", () => {
  const cats = defaultSystemCategories();
  assert.equal(cats.length, SYSTEM_CATEGORY_KEYS.length);
  assert.equal(cats[0]?.id, "sys_housing");
  assert.equal(cats[0]?.key, "housing");
  assert.equal(cats[0]?.type, "expense");
  assert.equal(cats[0]?.isSystem, true);
});

test("isSystemCategoryKey accepts only known keys", () => {
  assert.equal(isSystemCategoryKey("groceries"), true);
  assert.equal(isSystemCategoryKey("nope"), false);
});

test("isBudgetAccount covers cash/bank/credit_card only", () => {
  assert.equal(isBudgetAccount("cash"), true);
  assert.equal(isBudgetAccount("bank"), true);
  assert.equal(isBudgetAccount("credit_card"), true);
  assert.equal(isBudgetAccount("loan"), false);
});

test("supportsCreditFields covers credit_card/loan only", () => {
  assert.equal(supportsCreditFields("credit_card"), true);
  assert.equal(supportsCreditFields("loan"), true);
  assert.equal(supportsCreditFields("cash"), false);
});
