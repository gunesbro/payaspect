import type { DatabaseDriver } from "../driver.ts";
import { listTransactions } from "./transactions.ts";

export interface SpendingSummary {
  total: number;
  byCategory: Array<{ categoryId: string | null; total: number }>;
  byAccount: Array<{ accountId: string; total: number }>;
  byCurrency: Array<{ currency: string; total: number }>;
}

export interface SpendingOptions {
  from?: number;
  to?: number;
  accountId?: string;
}

/** Round to two decimals to avoid floating-point drift in money totals. */
function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Aggregate expenses (not income/transfers) over a date range.
 *
 * Computed in JS (rather than SQL SUM/GROUP BY) so the in-memory driver and
 * the native driver behave identically. Scans up to `listTransactions`' cap
 * (1000); pagination for larger datasets is a follow-up.
 */
export async function summarizeSpending(
  db: DatabaseDriver,
  opts: SpendingOptions = {},
): Promise<SpendingSummary> {
  const transactions = await listTransactions(db, { ...opts, limit: 1000 });
  const expenses = transactions.filter((t) => t.type === "expense");

  const byCategory = new Map<string | null, number>();
  const byAccount = new Map<string, number>();
  const byCurrency = new Map<string, number>();
  let total = 0;

  for (const t of expenses) {
    const categoryKey = t.categoryId ?? null;
    total += t.amount;
    byCategory.set(categoryKey, (byCategory.get(categoryKey) ?? 0) + t.amount);
    byAccount.set(t.accountId, (byAccount.get(t.accountId) ?? 0) + t.amount);
    byCurrency.set(t.currency, (byCurrency.get(t.currency) ?? 0) + t.amount);
  }

  return {
    total: roundMoney(total),
    byCategory: [...byCategory.entries()]
      .map(([categoryId, sum]) => ({ categoryId, total: roundMoney(sum) }))
      .sort((a, b) => b.total - a.total),
    byAccount: [...byAccount.entries()]
      .map(([accountId, sum]) => ({ accountId, total: roundMoney(sum) }))
      .sort((a, b) => b.total - a.total),
    byCurrency: [...byCurrency.entries()]
      .map(([currency, sum]) => ({ currency, total: roundMoney(sum) }))
      .sort((a, b) => b.total - a.total),
  };
}
