import { openDatabase, type DatabaseDriver } from "@payaspect/core";
import { createKeyProvider } from "./keyProvider";
import { SqlCipherDriver } from "./sqlcipherDriver";

let dbPromise: Promise<DatabaseDriver> | null = null;

/**
 * Open (or reuse) the encrypted database, applying migrations and seeding
 * system categories exactly once. op-sqlite recommends a single connection
 * per app session, so this is cached.
 */
export function getDatabase(): Promise<DatabaseDriver> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = new SqlCipherDriver();
      await openDatabase(db, createKeyProvider());
      return db;
    })();
  }
  return dbPromise;
}
