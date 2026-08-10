import React from "react";
import { vscode } from "./hooks/useVsCodeApi";

export type Language = "en" | "es";

interface LanguageContextValue {
  /** Dashboard locale only; it must not decide what language agents use. */
  uiLanguage: Language;
  setUiLanguage: (language: Language) => void;
  tx: (english: string, spanish: string) => string;
}

const LanguageContext = React.createContext<LanguageContextValue | undefined>(
  undefined,
);

function normalizeLanguage(value: unknown): Language {
  return value === "es" ? "es" : "en";
}

export function getStoredUiLanguage(): Language {
  const state =
    (vscode?.getState() as { uiLanguage?: unknown; language?: unknown } | undefined) || {};
  // `language` was the pre-Fase-2 key. Preserve it as a one-time backwards-compatible read.
  return normalizeLanguage(state.uiLanguage ?? state.language);
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
  const [uiLanguage, setUiLanguageState] = React.useState<Language>(() =>
    getStoredUiLanguage(),
  );

  const setUiLanguage = React.useCallback((nextLanguage: Language) => {
    setUiLanguageState(nextLanguage);
    const currentState =
      (vscode?.getState() as Record<string, unknown> | undefined) || {};
    vscode?.setState({
      ...currentState,
      uiLanguage: nextLanguage,
    });
  }, []);

  const value = React.useMemo<LanguageContextValue>(
    () => ({
      uiLanguage,
      setUiLanguage,
      tx: (english: string, spanish: string) =>
        translateForLanguage(uiLanguage, english, spanish),
    }),
    [uiLanguage, setUiLanguage],
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
