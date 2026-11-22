/** Month-over-month spending comparison. */

export type SpendingChangeDirection = "up" | "down" | "flat";

export interface SpendingChange {
  direction: SpendingChangeDirection;
  /** Signed percentage change, rounded to one decimal. */
  percent: number;
}

/**
 * Compare two monthly spending totals.
 *
 * Returns `null` when the previous month has no spending: a percentage change
 * from zero is undefined and would be misleading. Currencies must match; the
 * caller is responsible for keeping them separate.
 */
export function compareSpending(current: number, previous: number): SpendingChange | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous <= 0) return null;

  const percent = Math.round(((current - previous) / previous) * 1000) / 10;
  if (percent === 0) return { direction: "flat", percent: 0 };
  return { direction: percent > 0 ? "up" : "down", percent };
}
