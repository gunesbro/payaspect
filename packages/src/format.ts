/**
 * Locale-aware display formatting. Pure functions, no native/Intl dependency
 * (Hermes' Intl support is partial), deterministic given input.
 */

export type FormatLocale = "en" | "tr";

const CURRENCY_SYMBOLS: Record<string, string> = {
  TRY: "₺",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

/** Format an amount with 2 decimals and grouping for display. */
export function formatAmount(
  amount: number,
  currency: string,
  locale: FormatLocale = "tr",
): string {
  const negative = amount < 0;
  const [intPart = "0", decPart = "00"] = Math.abs(amount).toFixed(2).split(".");

  const grouping = locale === "tr" ? "." : ",";
  const decimal = locale === "tr" ? "," : ".";
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, grouping);

  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  const number = `${grouped}${decimal}${decPart}`;
  const formatted = locale === "tr" ? `${number} ${symbol}` : `${symbol}${number}`;
  return negative ? `-${formatted}` : formatted;
}

/** Format an epoch-millis timestamp as a calendar date. */
export function formatDate(epochMs: number, locale: FormatLocale = "tr"): string {
  const d = new Date(epochMs);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return locale === "tr" ? `${day}.${month}.${year}` : `${month}/${day}/${year}`;
}
