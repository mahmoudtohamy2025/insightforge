import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import enTranslations from "@/locales/en.json";

export type Language = "en" | "ar" | "fr" | "es" | "de";
export type Direction = "ltr" | "rtl";

interface I18nContextType {
  language: Language;
  direction: Direction;
  t: (key: string) => string;
  setLanguage: (lang: Language) => void;
}

const I18nContext = createContext<I18nContextType | null>(null);

// Start with EN loaded synchronously (default language), others loaded lazily on demand
const translationCache: Record<Language, Record<string, string>> = {
  en: enTranslations as Record<string, string>,
  ar: {} as Record<string, string>,
  fr: {} as Record<string, string>,
  es: {} as Record<string, string>,
  de: {} as Record<string, string>,
};

async function loadLanguage(lang: Language): Promise<Record<string, string>> {
  if (Object.keys(translationCache[lang]).length > 0) return translationCache[lang];
  const loaders: Record<string, () => Promise<{ default: Record<string, string> }>> = {
    ar: () => import("@/locales/ar.json"),
    fr: () => import("@/locales/fr.json"),
    es: () => import("@/locales/es.json"),
    de: () => import("@/locales/de.json"),
  };
  const loader = loaders[lang];
  if (loader) {
    const mod = await loader();
    translationCache[lang] = mod.default as Record<string, string>;
    return translationCache[lang];
  }
  return translationCache.en;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem("insightforge-lang");
    return (saved as Language) || "en";
  });
  const [translations, setTranslations] = useState<Record<string, string>>(translationCache.en);

  const direction: Direction = language === "ar" ? "rtl" : "ltr";

  // Load translations when language changes
  useEffect(() => {
    loadLanguage(language).then((t) => setTranslations(t));
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("insightforge-lang", lang);
  }, []);

  const t = useCallback(
    (key: string): string => {
      return translations[key] || translationCache.en[key] || key;
    },
    [translations]
  );

  useEffect(() => {
    document.documentElement.setAttribute("dir", direction);
    document.documentElement.setAttribute("lang", language);
  }, [direction, language]);

  return (
    <I18nContext.Provider value={{ language, direction, t, setLanguage }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used within I18nProvider");
  return context;
}

