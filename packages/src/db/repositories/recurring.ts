import type { DatabaseDriver } from "../driver.ts";
import { detectRecurring } from "../../domain/recurring.ts";
import { listTransactions } from "./transactions.ts";

/**
 * Detect recurring transactions and persist the `is_recurring` flag.
 *
 * Only ever marks rows (never unmarks), so it is safe to call on every sync
 * without clobbering flags a user may have set manually.
 *
 * Note: scans up to `listTransactions`' documented cap (1000) — pagination
 * for larger datasets is a follow-up.
 */
export async function markRecurringTransactions(db: DatabaseDriver): Promise<string[]> {
  const transactions = await listTransactions(db, { limit: 1000 });
  const ids = [...detectRecurring(transactions)];
  if (ids.length === 0) return ids;

  await db.transaction(async (tx) => {
    for (const id of ids) {
      await tx.run("UPDATE transactions SET is_recurring = 1 WHERE id = ?", [id]);
    }
  });

  return ids;
}
