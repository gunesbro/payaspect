import type { Transaction } from "./types";

/**
 * Lightweight, rule-based recurring detection.
 * Groups by normalized merchant + currency, then flags transactions whose
 * amounts are similar and whose dates are roughly evenly spaced.
 */

const DAY_MS = 86_400_000;
const AMOUNT_TOLERANCE = 0.1; // 10% amount drift allowed
const MIN_OCCURRENCES = 3;
const MIN_INTERVAL_DAYS = 25;
const MAX_INTERVAL_DAYS = 40;

function normalizeMerchant(merchant?: string | null): string | null {
  if (!merchant) return null;
  return merchant.trim().toLowerCase().replace(/\s+/g, " ");
}

function similarAmount(a: number, b: number): boolean {
  const base = Math.max(a, b);
  if (base === 0) return a === b;
  return Math.abs(a - b) / base <= AMOUNT_TOLERANCE;
}

/**
 * Return the set of transaction ids that appear to be recurring.
 * Callers can persist the isRecurring flag based on this.
 */
export function detectRecurring(transactions: ReadonlyArray<Transaction>): Set<string> {
  const groups = new Map<string, Transaction[]>();

  for (const t of transactions) {
    if (t.type === "transfer") continue;
    const merchant = normalizeMerchant(t.merchant);
    if (!merchant) continue;
    const key = `${merchant}|${t.currency}`;
    const arr = groups.get(key);
    if (arr) arr.push(t);
    else groups.set(key, [t]);
  }

  const recurring = new Set<string>();
  for (const group of groups.values()) {
    if (group.length < MIN_OCCURRENCES) continue;
    const sorted = [...group].sort((a, b) => a.date - b.date);

    let runStart = 0;
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const cur = sorted[i]!;
      const intervalDays = (cur.date - prev.date) / DAY_MS;
      const amountOk = similarAmount(prev.amount, cur.amount);
      const intervalOk =
        intervalDays >= MIN_INTERVAL_DAYS && intervalDays <= MAX_INTERVAL_DAYS;

      if (!(amountOk && intervalOk)) {
        runStart = i;
        continue;
      }
      if (i - runStart + 1 >= MIN_OCCURRENCES) {
        for (let k = runStart; k <= i; k++) recurring.add(sorted[k]!.id);
      }
    }
  }
  return recurring;
}
