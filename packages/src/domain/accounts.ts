import type { Account, AccountType } from "./types.ts";

/** All account types in display order; a single source of truth for UI and validation. */
export const ACCOUNT_TYPES: readonly AccountType[] = [
  "cash",
  "bank",
  "credit_card",
  "loan",
  "investment",
];

/** Budget accounts affect day-to-day spending; tracking accounts only track net worth. */
export const BUDGET_ACCOUNT_TYPES: readonly AccountType[] = [
  "cash",
  "bank",
  "credit_card",
];

export function isBudgetAccount(type: AccountType): boolean {
  return BUDGET_ACCOUNT_TYPES.includes(type);
}

export function isTrackingAccount(type: AccountType): boolean {
  return !isBudgetAccount(type);
}

/** Whether an account type supports optional credit fields (limit, statement day...). */
export function supportsCreditFields(type: AccountType): boolean {
  return type === "credit_card" || type === "loan";
}

/** Sum investment market values per currency; currencies are never mixed. */
export function investmentTotals(
  accounts: Account[],
): Array<{ currency: string; total: number }> {
  const perCurrency = new Map<string, number>();
  for (const account of accounts) {
    if (account.type !== "investment" || account.archived) continue;
    const value = account.currentValue;
    if (value == null || !Number.isFinite(value)) continue;
    perCurrency.set(account.currency, (perCurrency.get(account.currency) ?? 0) + value);
  }
  return [...perCurrency.entries()]
    .map(([currency, total]) => ({ currency, total: Math.round(total * 100) / 100 }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}
