import type { AccountType } from "./types.ts";

/** Budget accounts affect day-to-day spending; tracking accounts only track net worth. */
export const BUDGET_ACCOUNT_TYPES: readonly AccountType[] = [
  "cash",
  "bank",
  "credit_card",
];

export function isBudgetAccount(type: AccountType): boolean {
  return BUDGET_ACCOUNT_TYPES.includes(type);
}

/** Whether an account type supports optional credit fields (limit, statement day...). */
export function supportsCreditFields(type: AccountType): boolean {
  return type === "credit_card" || type === "loan";
}

