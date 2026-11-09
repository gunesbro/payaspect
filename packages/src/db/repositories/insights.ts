import type { DatabaseDriver } from "../driver.ts";
import { listTransactions } from "./transactions.ts";

/**
 * Spending broken down for a single currency.
 * Amounts in different currencies are never added together.
 */
export interface CurrencySpendingSummary {
  currency: string;
  total: number;
  byCategory: Array<{ categoryId: string | null; total: number }>;
  byAccount: Array<{ accountId: string; total: number }>;
}

export interface SpendingSummary {
  /** One entry per currency, sorted by currency code. */
  byCurrency: CurrencySpendingSummary[];
  /**
   * Convenience total for single-currency datasets. `0` when there are no
   * expenses, `null` when more than one currency is present (never mixed).
   */
  total: number | null;
  /** Currency of `total`, or `null` for empty/multi-currency datasets. */
  currency: string | null;
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

interface CurrencyAccumulator {
  total: number;
  byCategory: Map<string | null, number>;
  byAccount: Map<string, number>;
}

/**
 * Aggregate expenses (not income/transfers) over a date range.
 *
 * Amounts are grouped per currency first, so TRY/USD/EUR totals are never
 * mixed. Computed in JS (rather than SQL SUM/GROUP BY) so the in-memory driver
 * and the native driver behave identically. Scans up to `listTransactions`'
 * cap (1000); pagination for larger datasets is a follow-up.
 */
export async function summarizeSpending(
  db: DatabaseDriver,
  opts: SpendingOptions = {},
): Promise<SpendingSummary> {
  const transactions = await listTransactions(db, { ...opts, limit: 1000 });
  const expenses = transactions.filter((t) => t.type === "expense");

  const perCurrency = new Map<string, CurrencyAccumulator>();

  for (const t of expenses) {
    let acc = perCurrency.get(t.currency);
    if (!acc) {
      acc = { total: 0, byCategory: new Map(), byAccount: new Map() };
      perCurrency.set(t.currency, acc);
    }

    const categoryKey = t.categoryId ?? null;
    acc.total += t.amount;
    acc.byCategory.set(categoryKey, (acc.byCategory.get(categoryKey) ?? 0) + t.amount);
    acc.byAccount.set(t.accountId, (acc.byAccount.get(t.accountId) ?? 0) + t.amount);
  }

  const byCurrency: CurrencySpendingSummary[] = [...perCurrency.entries()]
    .map(([currency, acc]) => ({
      currency,
      total: roundMoney(acc.total),
      byCategory: [...acc.byCategory.entries()]
        .map(([categoryId, sum]) => ({ categoryId, total: roundMoney(sum) }))
        .sort((a, b) => b.total - a.total),
      byAccount: [...acc.byAccount.entries()]
        .map(([accountId, sum]) => ({ accountId, total: roundMoney(sum) }))
        .sort((a, b) => b.total - a.total),
    }))
    .sort((a, b) => a.currency.localeCompare(b.currency));

  const single = byCurrency.length === 1 ? byCurrency[0]! : null;

  return {
    byCurrency,
    total: single ? single.total : byCurrency.length === 0 ? 0 : null,
    currency: single ? single.currency : null,
  };
}

export interface AccountBalance {
  accountId: string;
  /** Money in: income + transfers received. */
  inflow: number;
  /** Money out: expenses + transfers sent. */
  outflow: number;
  /** Net position: inflow - outflow. */
  balance: number;
}

/**
 * Per-account cash position over a date range.
 *
 * Transfers are counted on both sides: the source loses the amount and the
 * target gains it, so an account's net worth is preserved correctly.
 */
export async function getAccountBalances(
  db: DatabaseDriver,
  opts: SpendingOptions = {},
): Promise<AccountBalance[]> {
  const transactions = await listTransactions(db, { ...opts, limit: 1000 });
  const map = new Map<string, AccountBalance>();

  const entry = (accountId: string): AccountBalance => {
    let e = map.get(accountId);
    if (!e) {
      e = { accountId, inflow: 0, outflow: 0, balance: 0 };
      map.set(accountId, e);
    }
    return e;
  };

  for (const t of transactions) {
    if (t.type === "income") {
      entry(t.accountId).inflow += t.amount;
    } else if (t.type === "expense") {
      entry(t.accountId).outflow += t.amount;
    } else if (t.type === "transfer" && t.toAccountId) {
      entry(t.accountId).outflow += t.amount;
      entry(t.toAccountId).inflow += t.amount;
    }
  }

  return [...map.values()]
    .map((b) => ({
      accountId: b.accountId,
      inflow: roundMoney(b.inflow),
      outflow: roundMoney(b.outflow),
      balance: roundMoney(b.inflow - b.outflow),
    }))
    .sort((a, b) => a.accountId.localeCompare(b.accountId));
}
