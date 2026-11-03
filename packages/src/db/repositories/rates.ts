import type { DatabaseDriver, SQLRow } from "../driver.ts";
import type { Rate } from "../../domain/types.ts";

function rowToRate(row: SQLRow): Rate {
  return {
    base: String(row.base),
    quote: String(row.quote),
    rate: Number(row.rate),
    fetchedAt: Number(row.fetched_at),
  };
}

/** Insert or update an exchange rate (composite key: base + quote). */
export async function upsertRate(db: DatabaseDriver, r: Rate): Promise<void> {
  await db.run(
    `INSERT INTO rates (base, quote, rate, fetched_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(base, quote) DO UPDATE SET
       rate = excluded.rate,
       fetched_at = excluded.fetched_at`,
    [r.base, r.quote, r.rate, r.fetchedAt],
  );
}

export async function getRate(
  db: DatabaseDriver,
  base: string,
  quote: string,
): Promise<Rate | null> {
  const row = await db.get("SELECT * FROM rates WHERE base = ? AND quote = ?", [base, quote]);
  return row ? rowToRate(row) : null;
}

export async function listRates(db: DatabaseDriver): Promise<Rate[]> {
  const rows = await db.all("SELECT * FROM rates ORDER BY base ASC, quote ASC");
  return rows.map(rowToRate);
}

export async function deleteRate(db: DatabaseDriver, base: string, quote: string): Promise<void> {
  await db.run("DELETE FROM rates WHERE base = ? AND quote = ?", [base, quote]);
}
