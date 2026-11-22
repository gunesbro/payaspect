import assert from "node:assert/strict";
import { test } from "node:test";

import { parseDate } from "../src/parsers/date.ts";
import { parseReceiptText } from "../src/parsers/receipt.ts";

test("parses a Turkish receipt into suggested fields", () => {
  const text = [
    "MİKRO MARKET",
    "Tarih: 15.01.2026",
    "Ekmek 2 x 12,50 TL",
    "TOPLAM 1.234,56 TL",
  ].join("\n");

  const draft = parseReceiptText(text);
  assert.equal(draft.merchant, "MİKRO MARKET");
  assert.equal(draft.amount, 1234.56);
  assert.equal(draft.currency, "TRY");
  assert.equal(draft.date, parseDate("15.01.2026"));
  assert.equal(draft.rawText, text);
});

test("parses an English receipt and keeps the total over item prices", () => {
  const text = ["COFFEE SHOP", "Date: 2026-01-15", "Latte 4.50", "Total $12.34"].join("\n");

  const draft = parseReceiptText(text);
  assert.equal(draft.merchant, "COFFEE SHOP");
  assert.equal(draft.amount, 12.34);
  assert.equal(draft.currency, "USD");
  assert.equal(draft.date, parseDate("2026-01-15"));
});

test("returns null fields for text without usable data", () => {
  const draft = parseReceiptText("");
  assert.equal(draft.amount, null);
  assert.equal(draft.currency, null);
  assert.equal(draft.date, null);
  assert.equal(draft.merchant, null);
  assert.equal(draft.rawText, "");
});
