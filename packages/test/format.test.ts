import assert from "node:assert/strict";
import { test } from "node:test";

import { formatAmount, formatDate, formatMonthShort } from "../src/format.ts";

test("formatAmount uses Turkish grouping/symbol by default", () => {
  assert.equal(formatAmount(1234.56, "TRY"), "1.234,56 ₺");
  assert.equal(formatAmount(1234.5, "TRY"), "1.234,50 ₺");
  assert.equal(formatAmount(1_000_000, "TRY"), "1.000.000,00 ₺");
});

test("formatAmount uses English grouping/symbol", () => {
  assert.equal(formatAmount(1234.56, "USD", "en"), "$1,234.56");
  assert.equal(formatAmount(1234.56, "EUR", "en"), "€1,234.56");
});

test("formatAmount handles negative values and unknown currencies", () => {
  assert.equal(formatAmount(-5, "EUR", "en"), "-€5.00");
  assert.equal(formatAmount(10, "XYZ", "en"), "XYZ 10.00");
});

test("formatDate renders day-first (tr) and month-first (en)", () => {
  const t = new Date(2024, 2, 15).getTime();
  assert.equal(formatDate(t, "tr"), "15.03.2024");
  assert.equal(formatDate(t, "en"), "03/15/2024");
});

test("formatMonthShort returns locale month names", () => {
  assert.equal(formatMonthShort(new Date(2026, 5, 15).getTime(), "tr"), "Haz");
  assert.equal(formatMonthShort(new Date(2026, 5, 15).getTime(), "en"), "Jun");
  assert.equal(formatMonthShort(new Date(2026, 0, 1).getTime(), "tr"), "Oca");
  assert.equal(formatMonthShort(new Date(2026, 11, 1).getTime(), "en"), "Dec");
});
