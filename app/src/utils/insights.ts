import {
  compareSpending,
  type Locale,
  type SpendingChange,
  type TrendPoint,
} from "@payaspect/core";

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

/** Locale-aware percentage with one decimal, optionally signed. */
export function formatPercent(value: number, locale: Locale, signed = false): string {
  const rounded = Math.round(value * 10) / 10;
  const number = Math.abs(rounded)
    .toFixed(1)
    .replace(".", locale === "tr" ? "," : ".");
  if (!signed) return `${number}%`;

  const sign = rounded > 0 ? "+" : rounded < 0 ? "-" : "";
  return `${sign}${number}%`;
}
