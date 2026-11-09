import assert from "node:assert/strict";
import { test } from "node:test";

import { monthRange, previousMonthRange } from "../src/domain/dateRange.ts";

test("monthRange covers the whole local calendar month", () => {
  const reference = new Date(2026, 1, 15, 12, 30, 0, 0); // 15 Feb 2026, local
  const range = monthRange(reference);

  assert.equal(range.from, new Date(2026, 1, 1, 0, 0, 0, 0).getTime());
  assert.equal(range.to, new Date(2026, 2, 1, 0, 0, 0, 0).getTime() - 1);
});

test("monthRange includes the first and last millisecond of the month", () => {
  const first = new Date(2026, 0, 1, 0, 0, 0, 0).getTime();
  const last = new Date(2026, 1, 1, 0, 0, 0, 0).getTime() - 1;

  const fromRange = monthRange(first);
  const toRange = monthRange(last);

  assert.equal(fromRange.from, first);
  assert.equal(toRange.to, last);
});

test("monthRange handles leap years", () => {
  const range = monthRange(new Date(2024, 1, 10)); // February 2024

  assert.equal(range.from, new Date(2024, 1, 1).getTime());
  assert.equal(range.to, new Date(2024, 2, 1).getTime() - 1);
});

test("previousMonthRange crosses the year boundary", () => {
  const range = previousMonthRange(new Date(2026, 0, 15)); // January 2026

  assert.equal(range.from, new Date(2025, 11, 1).getTime());
  assert.equal(range.to, new Date(2026, 0, 1).getTime() - 1);
});

test("monthRange rejects invalid dates", () => {
  assert.throws(() => monthRange(new Date("not-a-date")), RangeError);
});
