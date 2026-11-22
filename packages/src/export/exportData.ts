/** Dependency-free, locale-independent serializers for user-controlled exports. */

import type { Account, Category, Transaction } from "../domain/types.ts";

export interface BackupData {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
}

const CSV_COLUMNS = [
  "id",
  "type",
  "date",
  "amount",
  "currency",
  "account_id",
  "to_account_id",
  "category_id",
  "merchant",
  "note",
  "is_recurring",
  "source",
  "created_at",
] as const;

function csvCell(value: string | number | null | undefined): string {
  if (value == null) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** UTC calendar date keeps exports independent of device locale and timezone. */
function isoDate(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10);
}

/** Export transactions with stable column names; numbers use `.` as separator. */
export function transactionsToCsv(transactions: Transaction[]): string {
  const rows = transactions.map((tx) =>
    [
      tx.id,
      tx.type,
      isoDate(tx.date),
      tx.amount,
      tx.currency,
      tx.accountId,
      tx.toAccountId,
      tx.categoryId,
      tx.merchant,
      tx.note,
      tx.isRecurring ? "1" : "0",
      tx.source,
      tx.createdAt,
    ]
      .map(csvCell)
      .join(","),
  );

  return [CSV_COLUMNS.join(","), ...rows].join("\r\n");
}

/** Full on-device backup as plain JSON. The caller may encrypt it externally. */
export function buildBackupJson(data: BackupData): string {
  return JSON.stringify(
    {
      format: "payaspect-backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      accounts: data.accounts,
      categories: data.categories,
      transactions: data.transactions,
    },
    null,
    2,
  );
}
