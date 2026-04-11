import React from "react";
import { DashboardPage } from "./pages/DashboardPage";
import { LanguageProvider } from "./i18n";

export default function App(): React.JSX.Element {
  return (
    <LanguageProvider>
      <DashboardPage />
    </LanguageProvider>
  );
}
