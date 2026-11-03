/**
 * Date parsing for TR + EN receipt/bank text.
 * Pure functions; deterministic given input. No network.
 */

const MONTHS_EN: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

const MONTHS_TR: Record<string, number> = {
  oca: 0, sub: 1, mar: 2, nis: 3, may: 4, haz: 5,
  tem: 6, agu: 7, eyl: 8, eki: 9, kas: 10, ara: 11,
};

/**
 * Parse the first recognizable date in text to epoch ms.
 * Supports: YYYY-MM-DD, DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY,
 * and "DD Mon YYYY" (TR/EN abbreviations). Day-first when ambiguous.
 */
export function parseDate(text: string): number | null {
  if (!text) return null;

  const ymd = text.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (ymd) return buildDate(+ymd[1]!, +ymd[2]! - 1, +ymd[3]!);

  const dmy = text.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/);
  if (dmy) {
    let year = +dmy[3]!;
    if (year < 100) year += 2000;
    return buildDate(year, +dmy[2]! - 1, +dmy[1]!);
  }

  const named = text.match(
    /\b(\d{1,2})\s+([A-Za-zçğıöşüÇĞİÖŞÜ]{3,})\.?\s+(\d{2,4})\b/i,
  );
  if (named) {
    const token = named[2]!.toLowerCase().slice(0, 3);
    const month = MONTHS_EN[token] ?? MONTHS_TR[token];
    if (month !== undefined) {
      let year = +named[3]!;
      if (year < 100) year += 2000;
      return buildDate(year, month, +named[1]!);
    }
  }

  return null;
}

function buildDate(year: number, monthIndex: number, day: number): number | null {
  if (monthIndex < 0 || monthIndex > 11 || day < 1 || day > 31) return null;
  const d = new Date(year, monthIndex, day);
  if (Number.isNaN(d.getTime())) return null;
  // Reject impossible dates that JS would silently normalize (e.g. Feb 31 -> Mar 2).
  if (d.getFullYear() !== year || d.getMonth() !== monthIndex || d.getDate() !== day) {
    return null;
  }
  return d.getTime();
}
