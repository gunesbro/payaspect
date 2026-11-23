import type { DatabaseDriver, SQLRow } from "../driver.ts";
import type { Budget } from "../../domain/types.ts";

function rowToBudget(row: SQLRow): Budget {
  return {
    id: String(row.id),
    categoryId: String(row.category_id),
    currency: String(row.currency),
    amount: Number(row.amount),
    createdAt: Number(row.created_at),
  };
}

/**
 * Insert or update a category/currency monthly limit.
 * The composite key keeps one budget per category and currency.
 */
export async function upsertBudget(db: DatabaseDriver, b: Budget): Promise<void> {
  await db.run(
    `INSERT INTO budgets (id, category_id, currency, amount, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(category_id, currency) DO UPDATE SET
       amount = excluded.amount`,
    [b.id, b.categoryId, b.currency, b.amount, b.createdAt],
  );
}

export async function listBudgets(db: DatabaseDriver): Promise<Budget[]> {
  const rows = await db.all(
    "SELECT * FROM budgets ORDER BY category_id ASC, currency ASC",
  );
  return rows.map(rowToBudget);
}

export async function deleteBudget(db: DatabaseDriver, id: string): Promise<void> {
  await db.run("DELETE FROM budgets WHERE id = ?", [id]);
}
