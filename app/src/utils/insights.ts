import {
  compareSpending,
  type SpendingChange,
  type TrendPoint,
} from "@payaspect/core";

export { formatPercent } from "@payaspect/core";

/** Compare a month total with the previous point of an oldest-first series. */
export function monthChange(
  current: number,
  points: TrendPoint[] | undefined,
): SpendingChange | null {
  if (!points || points.length < 2) return null;

  const previous = points[points.length - 2]?.total;
  if (previous == null) return null;
  return compareSpending(current, previous);
}
