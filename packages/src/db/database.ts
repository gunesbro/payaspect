import type { DatabaseDriver, KeyProvider } from "./driver.ts";
import { migrate } from "./migrate.ts";
import { seedSystemCategories } from "./repositories/categories.ts";

export interface OpenDatabaseResult {
  db: DatabaseDriver;
  appliedMigrations: number[];
}

/**
 * Open an encrypted database, run migrations, and seed system data.
 *
 * The key is obtained from a KeyProvider (in production: Keychain/Keystore).
 * Returns the opened driver and the migration versions applied this run.
 */
export async function openDatabase(
  db: DatabaseDriver,
  keyProvider: KeyProvider,
): Promise<OpenDatabaseResult> {
  const key = await keyProvider.getOrCreateKey();
  await db.open(key);

  const appliedMigrations = await migrate(db);
  await seedSystemCategories(db);

  return { db, appliedMigrations };
}
