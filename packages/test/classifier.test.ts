import assert from "node:assert/strict";
import { test } from "node:test";

import { KeywordClassifier } from "../src/ai/keywordClassifier.ts";

const classifier = new KeywordClassifier();

test("classifies a Turkish grocery merchant", async () => {
  const r = await classifier.classify({ merchant: "Migros Market" });
  assert.equal(r.categoryKey, "groceries");
  assert.equal(r.categoryId, "sys_groceries");
});

test("classifies a subscription merchant", async () => {
  const r = await classifier.classify({ merchant: "Netflix" });
  assert.equal(r.categoryKey, "digital_subscriptions");
});

test("classifies housing from a note", async () => {
  const r = await classifier.classify({ note: "kira ödemesi" });
  assert.equal(r.categoryKey, "housing");
});

test("falls back to 'other' for unknown input", async () => {
  const r = await classifier.classify({ merchant: "xyz123" });
  assert.equal(r.categoryKey, "other");
  assert.equal(r.categoryId, "sys_other");
  assert.equal(r.confidence, 0.3);
});

test("returns ranked scores and a confidence within (0, 0.95]", async () => {
  const r = await classifier.classify({ merchant: "Migros Market" });
  assert.ok(r.confidence > 0 && r.confidence <= 0.95);
  assert.ok(r.scores.length >= 1);
});

test("dispose is a no-op and resolves", async () => {
  await assert.doesNotReject(() => classifier.dispose());
});
