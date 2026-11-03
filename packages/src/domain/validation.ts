import type { Transaction } from "./types.ts";

/**
 * Validate the semantic invariants of a transaction before persisting.
 * Returns a list of human-readable errors; empty means valid.
 *
 * Useful at the app boundary (form → repository) to catch bad user/parsed
 * input before it reaches storage.
 */
export function validateTransaction(t: Transaction): string[] {
  const errors: string[] = [];

  if (!Number.isFinite(t.amount) || t.amount <= 0) {
    errors.push("amount must be a positive number");
  }
  if (typeof t.currency !== "string" || !/^[A-Z]{3}$/.test(t.currency)) {
    errors.push("currency must be a 3-letter ISO code");
  }
  if (!Number.isFinite(t.date) || t.date <= 0) {
    errors.push("date must be a positive epoch-millis timestamp");
  }
  if (!t.accountId) {
    errors.push("accountId is required");
  }

  if (t.type === "transfer") {
    if (!t.toAccountId) errors.push("toAccountId is required for transfers");
    if (t.categoryId != null) errors.push("categoryId must be null for transfers");
  } else {
    if (!t.categoryId) errors.push("categoryId is required for expenses and income");
    if (t.toAccountId != null) errors.push("toAccountId must be null for non-transfers");
  }

  return errors;
}
