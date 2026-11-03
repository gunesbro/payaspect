import type { DatabaseDriver, SQLRow } from "../driver.ts";
import type { Transaction } from "../../domain/types.ts";

function rowToTransaction(row: SQLRow): Transaction {
  return {
    id: String(row.id),
    type: String(row.type) as Transaction["type"],
    amount: Number(row.amount),
    currency: String(row.currency),
    accountId: String(row.account_id),
    toAccountId: row.to_account_id == null ? null : String(row.to_account_id),
    categoryId: row.category_id == null ? null : String(row.category_id),
    date: Number(row.date),
    merchant: row.merchant == null ? null : String(row.merchant),
    note: row.note == null ? null : String(row.note),
    isRecurring: Number(row.is_recurring) === 1,
    source: String(row.source) as Transaction["source"],
    createdAt: Number(row.created_at),
  };
}

export async function insertTransaction(
  db: DatabaseDriver,
  t: Transaction,
): Promise<void> {
  await db.run(
    `INSERT INTO transactions
       (id, type, amount, currency, account_id, to_account_id, category_id,
        date, merchant, note, is_recurring, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      t.id,
      t.type,
      t.amount,
      t.currency,
      t.accountId,
      t.toAccountId ?? null,
      t.categoryId ?? null,
      t.date,
      t.merchant ?? null,
      t.note ?? null,
      t.isRecurring ? 1 : 0,
      t.source,
      t.createdAt,
    ],
  );
}

export interface ListTransactionsOptions {
  from?: number;
  to?: number;
  accountId?: string;
  categoryId?: string;
  limit?: number;
  offset?: number;
}

export async function listTransactions(
  db: DatabaseDriver,
  opts: ListTransactionsOptions = {},
): Promise<Transaction[]> {
  const where: string[] = [];
  const params: (string | number)[] = [];

  if (opts.from != null) {
    where.push("date >= ?");
    params.push(opts.from);
  }
  if (opts.to != null) {
    where.push("date <= ?");
    params.push(opts.to);
  }
  if (opts.accountId) {
    where.push("account_id = ?");
    params.push(opts.accountId);
  }
  if (opts.categoryId) {
    where.push("category_id = ?");
    params.push(opts.categoryId);
  }

  const limit = Math.max(1, Math.min(opts.limit ?? 100, 1000));
  const offset = Math.max(0, opts.offset ?? 0);

  const sql =
    "SELECT * FROM transactions" +
    (where.length ? ` WHERE ${where.join(" AND ")}` : "") +
    " ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?";

  const rows = await db.all(sql, [...params, limit, offset]);
  return rows.map(rowToTransaction);
}

export async function getTransactionById(
  db: DatabaseDriver,
  id: string,
): Promise<Transaction | null> {
  const row = await db.get("SELECT * FROM transactions WHERE id = ?", [id]);
  return row ? rowToTransaction(row) : null;
}

export async function deleteTransaction(db: DatabaseDriver, id: string): Promise<void> {
  await db.run("DELETE FROM transactions WHERE id = ?", [id]);
}
