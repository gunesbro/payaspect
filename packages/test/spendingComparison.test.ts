import assert from "node:assert/strict";
import { test } from "node:test";

import { compareSpending } from "../src/domain/spendingComparison.ts";

test("compareSpending reports direction and rounded percentage", () => {
  assert.deepEqual(compareSpending(125, 100), { direction: "up", percent: 25 });
  assert.deepEqual(compareSpending(75, 100), { direction: "down", percent: -25 });
  assert.deepEqual(compareSpending(112.345, 100), { direction: "up", percent: 12.3 });
  assert.deepEqual(compareSpending(100.04, 100), { direction: "flat", percent: 0 });
});

test("compareSpending returns null without a positive previous total", () => {
  assert.equal(compareSpending(100, 0), null);
  assert.equal(compareSpending(100, -5), null);
  assert.equal(compareSpending(100, Number.NaN), null);
  assert.equal(compareSpending(Number.POSITIVE_INFINITY, 100), null);
});
