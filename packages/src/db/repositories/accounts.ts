import type { DatabaseDriver, SQLRow } from "../driver.ts";
import type { Account } from "../../domain/types.ts";

function rowToAccount(row: SQLRow): Account {
  return {
    id: String(row.id),
    name: String(row.name),
    type: String(row.type) as Account["type"],
    currency: String(row.currency),
    isBudget: Number(row.is_budget) === 1,
    creditLimit: row.credit_limit == null ? null : Number(row.credit_limit),
    statementDay: row.statement_day == null ? null : Number(row.statement_day),
    minPaymentDay: row.min_payment_day == null ? null : Number(row.min_payment_day),
    note: row.note == null ? null : String(row.note),
    archived: Number(row.archived) === 1,
    createdAt: Number(row.created_at),
  };
}

export async function insertAccount(db: DatabaseDriver, a: Account): Promise<void> {
  await db.run(
    `INSERT INTO accounts
       (id, name, type, currency, is_budget, credit_limit, statement_day,
        min_payment_day, note, archived, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      a.id,
      a.name,
      a.type,
      a.currency,
      a.isBudget ? 1 : 0,
      a.creditLimit ?? null,
      a.statementDay ?? null,
      a.minPaymentDay ?? null,
      a.note ?? null,
      a.archived ? 1 : 0,
      a.createdAt,
    ],
  );
}

export async function listAccounts(
  db: DatabaseDriver,
  includeArchived = false,
): Promise<Account[]> {
  const sql = includeArchived
    ? "SELECT * FROM accounts ORDER BY created_at ASC"
    : "SELECT * FROM accounts WHERE archived = 0 ORDER BY created_at ASC";
  const rows = await db.all(sql);
  return rows.map(rowToAccount);
}

export async function getAccountById(
  db: DatabaseDriver,
  id: string,
): Promise<Account | null> {
  const row = await db.get("SELECT * FROM accounts WHERE id = ?", [id]);
  return row ? rowToAccount(row) : null;
}

export async function archiveAccount(db: DatabaseDriver, id: string): Promise<void> {
  await db.run("UPDATE accounts SET archived = 1 WHERE id = ?", [id]);
}
