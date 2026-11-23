/** Pure category-level month-over-month comparison and anomaly detection. */

import type { SpendingTrend } from "../db/repositories/insights.ts";
import { compareSpending, type SpendingChange } from "./spendingComparison.ts";

export interface CategoryMonthChange {
  currency: string;
  categoryId: string;
  current: number;
  previous: number;
  /** null when the previous month had no spending (percentage undefined). */
  change: SpendingChange | null;
}

export interface SpendingAnomaly {
  currency: string;
  categoryId: string;
  /** Current month's expense total. */
  current: number;
  /** Median of the prior months' expense totals. */
  baseline: number;
  /** How far above the baseline, rounded to one decimal (positive). */
  percent: number;
}

/** Minimum prior months required before a spike is called unusual. */
const MIN_PRIOR_MONTHS = 2;
export const DEFAULT_ANOMALY_THRESHOLD_PERCENT = 50;

/** Pair each category series with its month-over-month change. */
export function categoryMonthChanges(trend: SpendingTrend): CategoryMonthChange[] {
  return trend.byCategory
    .map((series) => {
      const points = series.points;
      const current = points[points.length - 1]?.total ?? 0;
      const previous = points[points.length - 2]?.total ?? 0;
      return {
        currency: series.currency,
        categoryId: series.categoryId,
        current,
        previous,
        change: compareSpending(current, previous),
      };
    })
    .sort(
      (a, b) =>
        a.currency.localeCompare(b.currency) ||
        a.categoryId.localeCompare(b.categoryId),
    );
}

/** Median of prior monthly totals; one historical spike cannot skew it. */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle]!;
  return Math.round(((sorted[middle - 1]! + sorted[middle]!) / 2) * 100) / 100;
}

/**
 * Flag categories whose current-month spending is well above their own recent
 * typical level. The baseline is the median of prior months, so a single past
 * spike does not hide a new one. Currencies stay separate and no cross-category
 * or cross-currency comparison is made. Returns an empty list until there are
 * at least two prior months with positive spending.
 */
export function detectSpendingAnomalies(
  trend: SpendingTrend,
  thresholdPercent: number = DEFAULT_ANOMALY_THRESHOLD_PERCENT,
): SpendingAnomaly[] {
  const threshold =
    Number.isFinite(thresholdPercent) && thresholdPercent > 0
      ? thresholdPercent
      : DEFAULT_ANOMALY_THRESHOLD_PERCENT;

  const anomalies: SpendingAnomaly[] = [];

  for (const series of trend.byCategory) {
    const points = series.points;
    if (points.length < MIN_PRIOR_MONTHS + 1) continue;

    const current = points[points.length - 1]!.total;
    const history = points.slice(0, -1).map((point) => point.total);
    if (current <= 0 || history.every((value) => value <= 0)) continue;

    const baseline = median(history);
    if (baseline <= 0) continue;

    const percent = Math.round(((current - baseline) / baseline) * 1000) / 10;
    if (percent < threshold) continue;

    anomalies.push({
      currency: series.currency,
      categoryId: series.categoryId,
      current,
      baseline,
      percent,
    });
  }

  return anomalies.sort(
    (a, b) =>
      b.percent - a.percent ||
      a.currency.localeCompare(b.currency) ||
      a.categoryId.localeCompare(b.categoryId),
  );
}
