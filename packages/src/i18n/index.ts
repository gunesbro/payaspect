import en from "./locales/en.ts";
import tr from "./locales/tr.ts";

export type Locale = "en" | "tr";

export const DEFAULT_LOCALE: Locale = "en";

const DICTIONARIES: Record<Locale, Record<string, string>> = { en, tr };

/**
 * Create a translator for the given locale.
 * Missing keys fall back to the default locale, then to the key itself.
 * New languages only require adding a JSON file to the DICTIONARIES map.
 */
export function createTranslator(locale: Locale) {
  const dict = DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
  const fallback = DICTIONARIES[DEFAULT_LOCALE];

  return function t(key: string, params?: Record<string, string | number>): string {
    let value = dict[key] ?? fallback[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        value = value.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      }
    }
    return value;
  };
}

export type Translator = ReturnType<typeof createTranslator>;

/** Available locales (UI can render a language picker from this). */
export const AVAILABLE_LOCALES: ReadonlyArray<Locale> = ["en", "tr"];
