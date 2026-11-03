import type { DatabaseDriver, SQLRow } from "../driver.ts";
import type { Attachment } from "../../domain/types.ts";

function rowToAttachment(row: SQLRow): Attachment {
  return {
    id: String(row.id),
    transactionId: String(row.transaction_id),
    filePath: String(row.file_path),
    mime: String(row.mime),
    createdAt: Number(row.created_at),
  };
}

export async function insertAttachment(db: DatabaseDriver, a: Attachment): Promise<void> {
  await db.run(
    `INSERT INTO attachments (id, transaction_id, file_path, mime, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [a.id, a.transactionId, a.filePath, a.mime, a.createdAt],
  );
}

export async function listAttachmentsForTransaction(
  db: DatabaseDriver,
  transactionId: string,
): Promise<Attachment[]> {
  const rows = await db.all(
    "SELECT * FROM attachments WHERE transaction_id = ? ORDER BY created_at ASC",
    [transactionId],
  );
  return rows.map(rowToAttachment);
}

export async function getAttachmentById(
  db: DatabaseDriver,
  id: string,
): Promise<Attachment | null> {
  const row = await db.get("SELECT * FROM attachments WHERE id = ?", [id]);
  return row ? rowToAttachment(row) : null;
}

export async function deleteAttachment(db: DatabaseDriver, id: string): Promise<void> {
  await db.run("DELETE FROM attachments WHERE id = ?", [id]);
}
