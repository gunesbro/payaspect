/**
 * Amount and currency parsing for TR + EN receipt/bank text.
 * Pure functions, safe to run on-device. No network.
 */

export interface ParsedAmount {
  value: number;
  currency: string | null;
}

const CURRENCY_HINTS: Array<{ re: RegExp; code: string }> = [
  { re: /\bTL\b|₺|\bTRY\b/i, code: "TRY" },
  { re: /\$|\bUSD\b/i, code: "USD" },
  { re: /€|\bEUR\b/i, code: "EUR" },
  { re: /£|\bGBP\b/i, code: "GBP" },
];

/**
 * Parse the first monetary amount found in text.
 * Handles both "1.234,56" (TR) and "1,234.56" (EN) groupings.
 */
export function parseAmount(text: string): ParsedAmount | null {
  if (!text) return null;

  const match = text.match(
    /-?\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{1,2})?|-?\d+(?:[.,]\d{1,2})?/,
  );
  if (!match) return null;

  const normalized = normalizeNumber(match[0]!.trim());
  if (normalized === null) return null;

  return { value: Math.abs(normalized), currency: detectCurrency(text) };
}

/** Normalize a localized numeric string to a JS number. */
export function normalizeNumber(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/\s/g, "");

  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");

  let standard: string;
  if (hasComma && hasDot) {
    const lastComma = cleaned.lastIndexOf(",");
    const lastDot = cleaned.lastIndexOf(".");
    standard =
      lastComma > lastDot
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "");
  } else if (hasComma) {
    standard = /,\d{1,2}$/.test(cleaned)
      ? cleaned.replace(",", ".")
      : cleaned.replace(/,/g, "");
  } else {
    standard = cleaned;
  }

  const value = Number(standard);
  return Number.isFinite(value) ? value : null;
}

/** Detect currency code from text, defaulting to null. */
export function detectCurrency(text: string): string | null {
  for (const { re, code } of CURRENCY_HINTS) {
    if (re.test(text)) return code;
  }
  return null;
}
