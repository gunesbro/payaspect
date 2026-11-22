import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  AVAILABLE_LOCALES,
  createTranslator,
  DEFAULT_LOCALE,
  type Locale,
  type Translator,
} from "@payaspect/core";
import * as SecureStore from "expo-secure-store";

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translator;
}

const I18nContext = createContext<I18nContextValue | null>(null);
const LOCALE_KEY = "payaspect.locale";

interface I18nProviderProps {
  children: ReactNode;
  initialLocale?: Locale;
}

function isLocale(value: string | null): value is Locale {
  return value != null && AVAILABLE_LOCALES.some((locale) => locale === value);
}

export function I18nProvider({
  children,
  initialLocale = DEFAULT_LOCALE,
}: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    let active = true;
    void SecureStore.getItemAsync(LOCALE_KEY)
      .then((stored) => {
        if (active && isLocale(stored)) setLocaleState(stored);
      })
      .catch(() => {
        // Storage may be unavailable; keep the default for this session.
      });
    return () => {
      active = false;
    };
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    void SecureStore.setItemAsync(LOCALE_KEY, next).catch(() => {
      // Persistence is best-effort; the selection still applies immediately.
    });
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale, t: createTranslator(locale) }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error("useI18n must be used inside I18nProvider");
  }
  return value;
}
