import type { DatabaseDriver } from "./driver.ts";
import { MIGRATIONS, CURRENT_SCHEMA_VERSION } from "./schema.ts";

/**
 * Apply pending migrations inside a transaction.
 * Returns the list of versions that were applied.
 *
 * Safe to call on every startup: already-applied versions are skipped.
 */
export async function migrate(db: DatabaseDriver): Promise<number[]> {
  const applied: number[] = [];

  await db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    applied_at INTEGER NOT NULL
  );`);

  const rows = await db.all(
    "SELECT version FROM schema_migrations ORDER BY version ASC",
  );
  const currentVersions = new Set(rows.map((r) => Number(r.version)));

  for (const migration of MIGRATIONS) {
    if (currentVersions.has(migration.version)) continue;

    await db.transaction(async (tx) => {
      await tx.exec(migration.sql);
      await tx.run(
        "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
        [migration.version, migration.name, Date.now()],
      );
    });
    applied.push(migration.version);
  }

  // Record the schema version in meta for diagnostics.
  await db.run(
    "INSERT INTO meta (key, value) VALUES ('schema_version', ?) " +
      "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [String(CURRENT_SCHEMA_VERSION)],
  );

  return applied;
}
