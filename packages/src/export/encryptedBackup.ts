/**
 * Full-device backup data and validation for the encrypted backup file.
 *
 * The file itself is a SQLCipher database created on the device with a
 * user-chosen passphrase; this module only handles the plaintext payload,
 * its validation and the on-device restore. No network is involved.
 */

import type { DatabaseDriver } from "../db/driver.ts";
import { insertAccount, listAccounts } from "../db/repositories/accounts.ts";
import { listBudgets, upsertBudget } from "../db/repositories/budgets.ts";
import { insertCategory, listAllCategories } from "../db/repositories/categories.ts";
import { insertTransaction, listAllTransactions } from "../db/repositories/transactions.ts";
import { ACCOUNT_TYPES } from "../domain/accounts.ts";
import { validateTransaction } from "../domain/validation.ts";
import type { Account, Budget, Category, Transaction } from "../domain/types.ts";

export const BACKUP_FORMAT = "payaspect-encrypted-backup";
export const BACKUP_VERSION = 1;

export interface EncryptedBackupData {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
}

export interface EncryptedBackupDocument extends EncryptedBackupData {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
}

/** Serialize the plaintext payload that is written into the encrypted file. */
export function buildEncryptedBackupJson(data: EncryptedBackupData): string {
  const document: EncryptedBackupDocument = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    accounts: data.accounts,
    categories: data.categories,
    transactions: data.transactions,
    budgets: data.budgets,
  };
  return JSON.stringify(document);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Invalid backup: ${field}`);
  }
  return value;
}

/**
 * Parse and validate a decrypted backup before any database write.
 * Corrupt or unexpected data is rejected so a restore can never partially
 * apply a malformed file.
 */
export function parseEncryptedBackupJson(json: string): EncryptedBackupData {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error("Invalid backup: not valid JSON");
  }

  if (!isRecord(raw)) throw new Error("Invalid backup: unexpected shape");
  if (raw.format !== BACKUP_FORMAT) throw new Error("Invalid backup: wrong format");
  if (raw.version !== BACKUP_VERSION) {
    throw new Error("Invalid backup: unsupported version");
  }

  for (const field of ["accounts", "categories", "transactions", "budgets"]) {
    if (!Array.isArray(raw[field])) throw new Error(`Invalid backup: ${field}`);
  }

  const accounts = raw.accounts as unknown[];
  for (const value of accounts) {
    if (!isRecord(value)) throw new Error("Invalid backup: account");
    requireString(value.id, "account.id");
    requireString(value.name, "account.name");
    requireString(value.currency, "account.currency");
    if (!ACCOUNT_TYPES.includes(String(value.type) as Account["type"])) {
      throw new Error("Invalid backup: account.type");
    }
    if (
      value.currentValue != null &&
      (!Number.isFinite(value.currentValue) || Number(value.currentValue) < 0)
    ) {
      throw new Error("Invalid backup: account.currentValue");
    }
  }

  const categories = raw.categories as unknown[];
  for (const value of categories) {
    if (!isRecord(value)) throw new Error("Invalid backup: category");
    requireString(value.id, "category.id");
    requireString(value.name, "category.name");
    if (!["expense", "income"].includes(String(value.type))) {
      throw new Error("Invalid backup: category.type");
    }
  }

  const transactions = raw.transactions as unknown[];
  for (const value of transactions) {
    if (!isRecord(value)) throw new Error("Invalid backup: transaction");
    const errors = validateTransaction(value as unknown as Transaction);
    if (errors.length > 0) throw new Error(`Invalid backup: transaction (${errors[0]})`);
  }

  const budgets = raw.budgets as unknown[];
  for (const value of budgets) {
    if (!isRecord(value)) throw new Error("Invalid backup: budget");
    requireString(value.id, "budget.id");
    requireString(value.categoryId, "budget.categoryId");
    requireString(value.currency, "budget.currency");
    if (!Number.isFinite(value.amount) || Number(value.amount) <= 0) {
      throw new Error("Invalid backup: budget.amount");
    }
  }

  return {
    accounts: accounts as Account[],
    categories: categories as Category[],
    transactions: transactions as Transaction[],
    budgets: budgets as Budget[],
  };
}

/** Read all backup tables from an open database. */
export async function collectEncryptedBackup(
  db: DatabaseDriver,
): Promise<EncryptedBackupData> {
  const [accounts, categories, transactions, budgets] = await Promise.all([
    listAccounts(db),
    listAllCategories(db),
    listAllTransactions(db),
    listBudgets(db),
  ]);
  return { accounts, categories, transactions, budgets };
}

/**
 * Replace the current data with a validated backup, atomically.
 * Schema version rows are untouched, so migrations are never rolled back.
 */
export async function restoreEncryptedBackup(
  db: DatabaseDriver,
  data: EncryptedBackupData,
): Promise<void> {
  await db.transaction(async (tx) => {
    // Children before parents to respect foreign keys.
    await tx.exec(`
      DELETE FROM transactions;
      DELETE FROM budgets;
      DELETE FROM accounts;
      DELETE FROM categories;
    `);
    for (const category of data.categories) await insertCategory(tx, category);
    for (const account of data.accounts) await insertAccount(tx, account);
    for (const transaction of data.transactions) await insertTransaction(tx, transaction);
    for (const budget of data.budgets) await upsertBudget(tx, budget);
  });
}
