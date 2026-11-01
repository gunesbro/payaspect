import type { Classification } from "../domain/types";
import { SYSTEM_CATEGORY_KEYS } from "../domain/categories";
import type { Classifier, ClassificationInput } from "./classifier";

/**
 * Rule/keyword-based fallback classifier.
 * Runs fully offline with zero model download and tiny footprint.
 * Used as the default until an embedding model is bundled, and as an
 * always-available fallback if a model fails to load.
 *
 * Keywords cover TR + EN. Each match votes for a category key.
 */
const KEYWORDS: Record<string, { tr: string[]; en: string[] }> = {
  housing: { tr: ["kira", "aidat", "konut"], en: ["rent", "mortgage", "housing"] },
  groceries: {
    tr: ["market", "migros", "bim", "a101", "şok", "pazar", "kasap", "bakkal"],
    en: ["groceries", "supermarket", "market", "butcher"],
  },
  dining: {
    tr: ["restoran", "kafe", "lokanta", "yemek", "kahve", "cafe", "burger"],
    en: ["restaurant", "cafe", "coffee", "dining", "pizza", "burger"],
  },
  transport: {
    tr: ["benzin", "yakıt", "otobüs", "metro", "taksi", "otopark", "araç"],
    en: ["fuel", "gas", "bus", "metro", "taxi", "parking", "uber"],
  },
  digital_subscriptions: {
    tr: ["netflix", "spotify", "abonelik", "üyelik", "icloud", "youtube"],
    en: ["netflix", "spotify", "subscription", "membership", "icloud", "youtube"],
  },
  health: {
    tr: ["eczane", "doktor", "hastane", "muayene", "ilaç", "diş"],
    en: ["pharmacy", "doctor", "hospital", "clinic", "medicine", "dental"],
  },
  clothing_personal_care: {
    tr: ["giyim", "kıyafet", "kuaför", "berber", "kozmetik", "zara"],
    en: ["clothing", "apparel", "salon", "barber", "cosmetics", "zara"],
  },
  education: {
    tr: ["okul", "kurs", "kitap", "taksit", "ders"],
    en: ["school", "course", "tuition", "book", "class"],
  },
  entertainment_hobby: {
    tr: ["sinema", "konser", "oyun", "tatil", "seyahat", "bilet"],
    en: ["cinema", "concert", "game", "travel", "ticket", "hotel"],
  },
  debt_credit: {
    tr: ["kredi", "borç", "asgari", "kredi kartı"],
    en: ["loan", "debt", "credit", "minimum payment"],
  },
  savings_investment: {
    tr: ["tasarruf", "yatırım", "fon", "hisse", "altın", "kripto"],
    en: ["savings", "investment", "fund", "stock", "gold", "crypto"],
  },
  insurance_tax: {
    tr: ["sigorta", "vergi", "mtv", "kasko", "trafik"],
    en: ["insurance", "tax", "premium"],
  },
  other: { tr: [], en: [] },
};

function haystack(input: ClassificationInput): string {
  return [input.merchant, input.note, input.ocrText]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export class KeywordClassifier implements Classifier {
  async classify(input: ClassificationInput): Promise<Classification> {
    const text = haystack(input);
    const scores = new Map<string, number>();

    for (const key of SYSTEM_CATEGORY_KEYS) {
      if (key === "other") continue;
      const kw = KEYWORDS[key];
      let hits = 0;
      if (kw) {
        for (const word of [...kw.tr, ...kw.en]) {
          if (word && text.includes(word)) hits += 1;
        }
      }
      if (hits > 0) scores.set(key, hits);
    }

    if (scores.size === 0) {
      return {
        categoryKey: "other",
        categoryId: "sys_other",
        confidence: 0.3,
        scores: [{ categoryKey: "other", score: 1 }],
      };
    }

    const ranked = [...scores.entries()]
      .map(([categoryKey, score]) => ({ categoryKey, score }))
      .sort((a, b) => b.score - a.score);

    const total = ranked.reduce((s, r) => s + r.score, 0);
    const top = ranked[0]!;
    const confidence = total > 0 ? Math.min(0.95, top.score / total) : 0.3;

    return {
      categoryKey: top.categoryKey,
      categoryId: `sys_${top.categoryKey}`,
      confidence,
      scores: ranked,
    };
  }

  async dispose(): Promise<void> {
    // No native resources to release.
  }
}
