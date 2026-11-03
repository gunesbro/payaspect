/**
 * Database driver abstraction.
 *
 * UI-independent and native-independent: the real app supplies an
 * implementation backed by SQLCipher (encrypted) via a native module,
 * while tests use an in-memory implementation.
 *
 * All queries are parameterized (never string-concatenated) to prevent SQL injection.
 */

export type SQLValue = string | number | null;

export type SQLRow = Record<string, SQLValue>;

export interface RunResult {
  /** Rows affected by INSERT/UPDATE/DELETE. */
  changes: number;
  /** Last inserted rowid, when applicable. */
  lastInsertRowId?: number;
}

export interface DatabaseDriver {
  /** Open (or create) the database with the given encryption key. */
  open(key: string): Promise<void>;
  /** Close the database and release native resources. */
  close(): Promise<void>;
  /** Execute one or more statements without returning rows (DDL, migrations). */
  exec(sql: string): Promise<void>;
  /** Execute a parameterized statement that mutates data. */
  run(sql: string, params?: SQLValue[]): Promise<RunResult>;
  /** Execute a parameterized query and return all rows. */
  all(sql: string, params?: SQLValue[]): Promise<SQLRow[]>;
  /** Execute a parameterized query and return the first row (or null). */
  get(sql: string, params?: SQLValue[]): Promise<SQLRow | null>;
  /** Run `fn` inside a transaction; rolls back on error. */
  transaction<T>(fn: (tx: DatabaseDriver) => Promise<T>): Promise<T>;
}

/**
 * Key provider — abstracts where the encryption key comes from.
 * In production this reads from Keychain/Keystore (never hard-coded, never logged).
 * In tests it returns a fixed key.
 */
export interface KeyProvider {
  getOrCreateKey(): Promise<string>;
}
