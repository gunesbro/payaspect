/**
 * Database schema (DDL) and versioning.
 *
 * Kept as ordered migrations so the schema evolves safely on existing installs.
 * SQLite dialect; works with SQLCipher (same dialect, encrypted storage).
 */

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const CURRENT_SCHEMA_VERSION = 2;

/**
 * Migration 1 — initial schema.
 * Amounts are stored as REAL; timestamps as INTEGER (epoch ms).
 * Foreign keys enforce referential integrity (enable PRAGMA foreign_keys = ON).
 */
const MIGRATION_1 = `
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  currency TEXT NOT NULL,
  is_budget INTEGER NOT NULL DEFAULT 1,
  credit_limit REAL,
  statement_day INTEGER,
  min_payment_day INTEGER,
  note TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY NOT NULL,
  key TEXT,
  name TEXT NOT NULL,
  parent_id TEXT,
  type TEXT NOT NULL,
  is_system INTEGER NOT NULL DEFAULT 0,
  hidden INTEGER NOT NULL DEFAULT 0,
  sort INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL,
  account_id TEXT NOT NULL,
  to_account_id TEXT,
  category_id TEXT,
  date INTEGER NOT NULL,
  merchant TEXT,
  note TEXT,
  is_recurring INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  FOREIGN KEY (to_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_tx_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_tx_merchant ON transactions(merchant);

CREATE TABLE IF NOT EXISTS rates (
  base TEXT NOT NULL,
  quote TEXT NOT NULL,
  rate REAL NOT NULL,
  fetched_at INTEGER NOT NULL,
  PRIMARY KEY (base, quote)
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT
);
`;

/**
 * Migration 2 — receipt/bank images.
 * Files are stored on-device (encrypted at rest); only path + mime are kept.
 */
const MIGRATION_2 = `
CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY NOT NULL,
  transaction_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  mime TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_attachment_tx ON attachments(transaction_id);
`;

export const MIGRATIONS: readonly Migration[] = [
  { version: 1, name: "initial_schema", sql: MIGRATION_1 },
  { version: 2, name: "attachments", sql: MIGRATION_2 },
];
