/**
 * Extract likely transaction fields from on-device OCR text.
 * All results are suggestions: the UI always asks the user to confirm.
 */

import type { ParsedTransactionDraft } from "../domain/types.ts";
import { detectCurrency, parseAmount } from "./amount.ts";
import { parseDate } from "./date.ts";

const TOTAL_HINT = /\b(tutar|toplam|total|amount|sum|ödenen|paid|balance)\b/i;
const META_LINE =
  /^(?:fiş|receipt|invoice|fatura|tarih|date|saat|time|tutar|total|amount|toplam|subtotal|ara\s*toplam|vergi|tax|kdv|change|üst|card|kart|thank|teşekkür|tel|phone|adres|address)\b/i;
const HAS_LETTER = /[A-Za-zçğıöşüÇĞİÖŞÜ]/;
const DECIMAL_TOTAL = /\d[.,]\d{2}\s*(?:tl|try|₺|\$|€|£)?$/i;

export function parseReceiptText(rawText: string): ParsedTransactionDraft {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const date = parseDate(rawText);
  const currency = detectCurrency(rawText);

  const candidates: Array<{ value: number; score: number; index: number }> = [];
  lines.forEach((line, index) => {
    // A date line is never an amount, even when it contains two-digit groups.
    if (date != null && parseDate(line) != null) return;
    const parsed = parseAmount(line);
    if (!parsed) return;

    let score = 0;
    if (TOTAL_HINT.test(line)) score += 3;
    if (parsed.currency) score += 2;
    if (DECIMAL_TOTAL.test(line)) score += 1;
    candidates.push({ value: parsed.value, score, index });
  });
  // Prefer total-like lines; keep reading order when scores are equal.
  candidates.sort((a, b) => b.score - a.score || a.index - b.index);

  const merchant =
    lines.find(
      (line) =>
        line.length >= 3 &&
        HAS_LETTER.test(line) &&
        !META_LINE.test(line) &&
        parseDate(line) == null &&
        !/^\d/.test(line) &&
        !parseAmount(line),
    ) ?? null;

  return {
    amount: candidates[0]?.value ?? null,
    currency,
    date,
    merchant,
    rawText,
  };
}
