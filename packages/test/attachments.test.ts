import assert from "node:assert/strict";
import { test } from "node:test";

import { MemoryDatabaseDriver } from "../src/db/memoryDriver.ts";
import { openDatabase } from "../src/db/database.ts";
import {
  deleteAttachment,
  getAttachmentById,
  insertAttachment,
  listAttachmentsForTransaction,
} from "../src/db/repositories/attachments.ts";
import type { Attachment } from "../src/domain/types.ts";

const TEST_KEY = "test-key-not-a-real-secret";

function makeAttachment(overrides: Partial<Attachment> = {}): Attachment {
  return {
    id: "att_1",
    transactionId: "tx_1",
    filePath: "file:///receipts/att_1.jpg",
    mime: "image/jpeg",
    createdAt: 1_700_000_000_000,
    ...overrides,
  };
}

async function freshDb(): Promise<MemoryDatabaseDriver> {
  const db = new MemoryDatabaseDriver();
  await openDatabase(db, { getOrCreateKey: async () => TEST_KEY });
  return db;
}

test("attachments round-trip and are listed per transaction", async () => {
  const db = await freshDb();
  await insertAttachment(db, makeAttachment());
  await insertAttachment(db, makeAttachment({ id: "att_2", transactionId: "tx_2" }));
  await insertAttachment(db, makeAttachment({ id: "att_3", transactionId: "tx_1", createdAt: 2 }));

  // Ordered oldest-first; att_3 (createdAt 2) precedes att_1.
  assert.deepEqual(
    (await listAttachmentsForTransaction(db, "tx_1")).map((a) => a.id),
    ["att_3", "att_1"],
  );

  const att = await getAttachmentById(db, "att_2");
  assert.equal(att?.transactionId, "tx_2");
  assert.equal(att?.mime, "image/jpeg");

  await deleteAttachment(db, "att_1");
  assert.equal(await getAttachmentById(db, "att_1"), null);
  assert.deepEqual(
    (await listAttachmentsForTransaction(db, "tx_1")).map((a) => a.id),
    ["att_3"],
  );
});

test("getAttachmentById returns null for an unknown id", async () => {
  const db = await freshDb();
  assert.equal(await getAttachmentById(db, "nope"), null);
});
