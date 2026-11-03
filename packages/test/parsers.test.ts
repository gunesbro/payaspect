import assert from "node:assert/strict";
import { test } from "node:test";

import { detectCurrency, normalizeNumber, parseAmount } from "../src/parsers/amount.ts";
import { parseDate } from "../src/parsers/date.ts";

// --- amount -----------------------------------------------------------------

test("parseAmount handles Turkish grouping (1.234,56)", () => {
  assert.deepEqual(parseAmount("1.234,56 TL"), { value: 1234.56, currency: "TRY" });
});

test("parseAmount handles English grouping (1,234.56)", () => {
  assert.deepEqual(parseAmount("$1,234.56"), { value: 1234.56, currency: "USD" });
});

test("parseAmount detects the lira sign and returns an absolute value", () => {
  assert.deepEqual(parseAmount("250₺"), { value: 250, currency: "TRY" });
  assert.equal(parseAmount("-250")?.value, 250);
});

test("parseAmount returns null when there is no amount", () => {
  assert.equal(parseAmount(""), null);
  assert.equal(parseAmount("merhaba dünya"), null);
});

test("normalizeNumber converts localized strings to JS numbers", () => {
  assert.equal(normalizeNumber("1.234,56"), 1234.56);
  assert.equal(normalizeNumber("1,234.56"), 1234.56);
  assert.equal(normalizeNumber("250"), 250);
  assert.equal(normalizeNumber("abc"), null);
});

test("detectCurrency recognizes common currency hints", () => {
  assert.equal(detectCurrency("€5"), "EUR");
  assert.equal(detectCurrency("£5"), "GBP");
  assert.equal(detectCurrency("no money"), null);
});

// --- date -------------------------------------------------------------------

test("parseDate handles YYYY-MM-DD", () => {
  assert.equal(parseDate("2024-03-15"), new Date(2024, 2, 15).getTime());
});

test("parseDate handles day-first numeric formats", () => {
  const expected = new Date(2024, 2, 15).getTime();
  assert.equal(parseDate("15.03.2024"), expected);
  assert.equal(parseDate("15/03/2024"), expected);
  assert.equal(parseDate("15-03-2024"), expected);
  assert.equal(parseDate("15.03.24"), new Date(2024, 2, 15).getTime());
});

test("parseDate handles abbreviated month names", () => {
  assert.equal(parseDate("15 Mar 2024"), new Date(2024, 2, 15).getTime());
  assert.equal(parseDate("15 Oca 2024"), new Date(2024, 0, 15).getTime());
});

test("parseDate rejects impossible dates instead of normalizing them", () => {
  assert.equal(parseDate("31.02.2024"), null);
  assert.equal(parseDate("29.02.2023"), null);
});

test("parseDate returns null for empty or dateless input", () => {
  assert.equal(parseDate(""), null);
  assert.equal(parseDate("merhaba"), null);
});
