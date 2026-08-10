import type { InteractionLanguage } from "../domain/models";

/** Pure language helpers. Keeping this module free of the VS Code API makes the language policy
 * directly testable and keeps it separate from reading the workspace setting. */
export function normalizeInteractionLanguage(value: unknown): InteractionLanguage {
  return value === "es" ? "es" : "en";
}

export function resolveInteractionLanguageValue(
  languageOverride: InteractionLanguage | undefined,
  workspaceLanguage: InteractionLanguage,
): InteractionLanguage {
  return languageOverride ?? workspaceLanguage;
}

export function interactionLanguageInstruction(language: InteractionLanguage): string {
  const name = language === "es" ? "Spanish" : "English";
  return [
    `Response language: Write user-facing explanations, questions, and final answers in ${name}.`,
    "Keep code, commands, paths, API names, quoted source text, and other literals unchanged unless the task explicitly asks to translate them.",
  ].join(" ");
}
