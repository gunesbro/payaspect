import type { DatabaseDriver, SQLRow } from "../driver.ts";
import type { Category } from "../../domain/types.ts";
import { defaultSystemCategories } from "../../domain/categories.ts";

function rowToCategory(row: SQLRow): Category {
  return {
    id: String(row.id),
    key: row.key == null ? null : String(row.key),
    name: String(row.name),
    parentId: row.parent_id == null ? null : String(row.parent_id),
    type: String(row.type) as Category["type"],
    isSystem: Number(row.is_system) === 1,
    hidden: Number(row.hidden) === 1,
    sort: Number(row.sort),
  };
}

/** Insert system categories if they do not already exist. Idempotent. */
export async function seedSystemCategories(db: DatabaseDriver): Promise<void> {
  const existing = await db.all("SELECT 1 FROM categories WHERE is_system = 1 LIMIT 1");
  if (existing.length > 0) return;

  await db.transaction(async (tx) => {
    for (const c of defaultSystemCategories()) {
      await tx.run(
        `INSERT INTO categories (id, key, name, parent_id, type, is_system, hidden, sort)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO NOTHING`,
        [c.id, c.key ?? null, c.name, c.parentId ?? null, c.type, 1, c.hidden ? 1 : 0, c.sort],
      );
    }
  });
}

export async function listCategories(db: DatabaseDriver): Promise<Category[]> {
  const rows = await db.all(
    "SELECT * FROM categories WHERE hidden = 0 ORDER BY sort ASC, name ASC",
  );
  return rows.map(rowToCategory);
}

export async function getCategoryById(
  db: DatabaseDriver,
  id: string,
): Promise<Category | null> {
  const row = await db.get("SELECT * FROM categories WHERE id = ?", [id]);
  return row ? rowToCategory(row) : null;
}
