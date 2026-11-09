import {
  isSQLCipher,
  open,
  type DB,
  type QueryResult,
  type Transaction,
} from "@op-engineering/op-sqlite";
import { splitStatements } from "@payaspect/core";
import type { DatabaseDriver, RunResult, SQLRow, SQLValue } from "@payaspect/core";

/** Coerce an op-sqlite `Scalar` into PayAspect's narrower `SQLValue`. */
function toSQLValue(value: unknown): SQLValue {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" || typeof value === "string") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  // ArrayBuffer / typed arrays are not used by PayAspect's schema.
  return null;
}

function toSQLRow(row: Record<string, unknown>): SQLRow {
  const out: SQLRow = {};
  for (const [key, value] of Object.entries(row)) out[key] = toSQLValue(value);
  return out;
}

function toRunResult(result: QueryResult): RunResult {
  return { changes: result.rowsAffected, lastInsertRowId: result.insertId };
}

/**
 * SQLCipher-backed `DatabaseDriver` using op-sqlite.
 *
 * The real on-device driver; `MemoryDatabaseDriver` is its test double. All
 * queries are parameterized and the database file is encrypted at rest with
 * the key provided to `open`.
 */
export class SqlCipherDriver implements DatabaseDriver {
  private db: DB | null = null;

  async open(key: string): Promise<void> {
    if (!key) throw new Error("A non-empty encryption key is required");

    // Privacy guard: never create/read a plaintext database. If the native
    // module was built without SQLCipher, fail loudly instead of silently
    // storing financial data unencrypted.
    if (!isSQLCipher()) {
      throw new Error(
        "SQLCipher is not enabled in this build. Refusing to open an unencrypted database.",
      );
    }

    this.db = open({ name: "payaspect.db", encryptionKey: key });

    // SQLite disables foreign-key enforcement per connection by default.
    // Enable it so the schema's ON DELETE rules (e.g. attachments) hold.
    await this.db.execute("PRAGMA foreign_keys = ON");
  }

  async close(): Promise<void> {
    this.db?.close();
    this.db = null;
  }

  async exec(sql: string): Promise<void> {
    const db = this.requireDb();
    // op-sqlite runs only the first statement of a multi-statement string on
    // native, so migrations must be split.
    for (const statement of splitStatements(sql)) {
      await db.execute(statement);
    }
  }

  async run(sql: string, params: SQLValue[] = []): Promise<RunResult> {
    return toRunResult(await this.requireDb().execute(sql, params));
  }

  async all(sql: string, params: SQLValue[] = []): Promise<SQLRow[]> {
    const result = await this.requireDb().execute(sql, params);
    return result.rows.map(toSQLRow);
  }

  async get(sql: string, params: SQLValue[] = []): Promise<SQLRow | null> {
    const rows = await this.all(sql, params);
    return rows[0] ?? null;
  }

  async transaction<T>(fn: (tx: DatabaseDriver) => Promise<T>): Promise<T> {
    const db = this.requireDb();
    let result: T | undefined;
    await db.transaction(async (tx) => {
      result = await fn(new TransactionDriver(tx));
    });
    return result as T;
  }

  private requireDb(): DB {
    if (!this.db) throw new Error("Database is not open");
    return this.db;
  }
}

/** Transaction-scoped driver that forwards to op-sqlite's `Transaction`. */
class TransactionDriver implements DatabaseDriver {
  constructor(private readonly tx: Transaction) {}

  async open(): Promise<void> {
    throw new Error("Cannot open a database inside a transaction");
  }

  async close(): Promise<void> {
    throw new Error("Cannot close a database inside a transaction");
  }

  async exec(sql: string): Promise<void> {
    for (const statement of splitStatements(sql)) {
      await this.tx.execute(statement);
    }
  }

  async run(sql: string, params: SQLValue[] = []): Promise<RunResult> {
    return toRunResult(await this.tx.execute(sql, params));
  }

  async all(sql: string, params: SQLValue[] = []): Promise<SQLRow[]> {
    const result = await this.tx.execute(sql, params);
    return result.rows.map(toSQLRow);
  }

  async get(sql: string, params: SQLValue[] = []): Promise<SQLRow | null> {
    const rows = await this.all(sql, params);
    return rows[0] ?? null;
  }

  async transaction<T>(fn: (tx: DatabaseDriver) => Promise<T>): Promise<T> {
    // op-sqlite has no savepoints; a nested transaction reuses this one.
    return fn(this);
  }
}
