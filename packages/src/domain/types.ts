/**
 * PayAspect domain types.
 * Pure TypeScript, UI-independent. No native or network dependencies.
 */

/** Account types. First three are budget accounts, last is a tracking account. */
export type AccountType = "cash" | "bank" | "credit_card" | "loan";

/** Currency codes as ISO 4217 strings (e.g. "TRY", "USD"). */
export type CurrencyCode = string;

/** Transaction direction. */
export type TransactionType = "expense" | "income" | "transfer";

/** How a transaction was created. */
export type TransactionSource = "manual" | "ocr";

/** ISO-8601 date string (YYYY-MM-DD) for calendar fields. */
export type ISODate = string;

/** Epoch milliseconds for stored timestamps. */
export type EpochMs = number;

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  currency: CurrencyCode;
  /** 1 = counted in budget, 0 = tracking only. */
  isBudget: boolean;
  /** Optional credit card limit. */
  creditLimit?: number | null;
  /** Optional statement/closing day of month (1-31). */
  statementDay?: number | null;
  /** Optional minimum payment day of month (1-31). */
  minPaymentDay?: number | null;
  note?: string | null;
  archived: boolean;
  createdAt: EpochMs;
}

export interface Category {
  id: string;
  /** Stable key for system categories (e.g. "housing"). Null for user categories. */
  key?: string | null;
  name: string;
  parentId?: string | null;
  type: "expense" | "income";
  isSystem: boolean;
  hidden: boolean;
  sort: number;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  /** Always positive; direction implied by `type`. */
  amount: number;
  currency: CurrencyCode;
  accountId: string;
  /** Target account for transfers only. */
  toAccountId?: string | null;
  /** Null for transfers. */
  categoryId?: string | null;
  date: EpochMs;
  merchant?: string | null;
  note?: string | null;
  isRecurring: boolean;
  source: TransactionSource;
  createdAt: EpochMs;
}

/** Optional FX rate row (user-triggered only). */
export interface Rate {
  base: CurrencyCode;
  quote: CurrencyCode;
  rate: number;
  fetchedAt: EpochMs;
}

/** A receipt/bank image attached to a transaction (stored on-device, encrypted). */
export interface Attachment {
  id: string;
  transactionId: string;
  /** On-device file path or encrypted blob reference; never a remote URL. */
  filePath: string;
  mime: string;
  createdAt: EpochMs;
}

/** Result of AI category classification. */
export interface Classification {
  categoryKey: string | null;
  categoryId: string | null;
  /** 0..1 confidence. */
  confidence: number;
  /** Ranked alternatives. */
  scores: Array<{ categoryKey: string; score: number }>;
}

/** Parsed fields from OCR text (suggestions for a prefilled form). */
export interface ParsedTransactionDraft {
  amount?: number | null;
  currency?: CurrencyCode | null;
  date?: EpochMs | null;
  merchant?: string | null;
  rawText: string;
}
