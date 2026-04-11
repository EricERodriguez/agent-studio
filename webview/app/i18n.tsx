import React from "react";
import { vscode } from "./hooks/useVsCodeApi";

export type Language = "en" | "es";

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  tx: (english: string, spanish: string) => string;
}

const LanguageContext = React.createContext<LanguageContextValue | undefined>(
  undefined,
);

function normalizeLanguage(value: unknown): Language {
  return value === "es" ? "es" : "en";
}

export function getStoredLanguage(): Language {
  const state =
    (vscode?.getState() as { language?: unknown } | undefined) || {};
  return normalizeLanguage(state.language);
}

export function translateForLanguage(
  language: Language,
  english: string,
  spanish: string,
): string {
  return language === "es" ? spanish : english;
}

export function LanguageProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [language, setLanguageState] = React.useState<Language>(() =>
    getStoredLanguage(),
  );

  const setLanguage = React.useCallback((nextLanguage: Language) => {
    setLanguageState(nextLanguage);
    const currentState =
      (vscode?.getState() as Record<string, unknown> | undefined) || {};
    vscode?.setState({
      ...currentState,
      language: nextLanguage,
    });
  }, []);

  const value = React.useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      tx: (english: string, spanish: string) =>
        translateForLanguage(language, english, spanish),
    }),
    [language, setLanguage],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useI18n(): LanguageContextValue {
  const context = React.useContext(LanguageContext);
  if (!context) {
    throw new Error("useI18n must be used within LanguageProvider");
  }
  return context;
}
