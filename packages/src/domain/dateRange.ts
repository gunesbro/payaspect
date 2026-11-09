/**
 * Calendar range helpers.
 *
 * Ranges are inclusive epoch-millis intervals, matching the `from`/`to`
 * options used by the transaction repository. Months are computed in the
 * device's local time zone, which is what users expect for "this month".
 */

export interface DateRange {
  /** First millisecond of the range (inclusive). */
  from: number;
  /** Last millisecond of the range (inclusive). */
  to: number;
}

function toDate(reference: number | Date): Date {
  const date = reference instanceof Date ? reference : new Date(reference);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("Invalid date reference");
  }
  return date;
}

/** Inclusive range covering the calendar month that contains `reference`. */
export function monthRange(reference: number | Date = Date.now()): DateRange {
  const date = toDate(reference);
  const year = date.getFullYear();
  const month = date.getMonth();

  const from = new Date(year, month, 1, 0, 0, 0, 0).getTime();
  // First millisecond of the next month minus one -> last ms of this month.
  const to = new Date(year, month + 1, 1, 0, 0, 0, 0).getTime() - 1;

  return { from, to };
}

/** Inclusive range covering the calendar month before `reference`. */
export function previousMonthRange(reference: number | Date = Date.now()): DateRange {
  const date = toDate(reference);
  return monthRange(new Date(date.getFullYear(), date.getMonth() - 1, 1));
}
