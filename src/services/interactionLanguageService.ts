import * as vscode from "vscode";
import type { InteractionLanguage } from "../domain/models";

function normalizeInteractionLanguage(value: unknown): InteractionLanguage {
  return value === "es" ? "es" : "en";
}

/** Workspace preference for agent responses. It is intentionally separate from the webview's
 * persisted UI locale, so an English dashboard can run Spanish-speaking agents and vice versa. */
export function getInteractionLanguage(): InteractionLanguage {
  return normalizeInteractionLanguage(
    vscode.workspace
      .getConfiguration("agentStudio")
      .get<unknown>("interactionLanguage", "en"),
  );
}

export function resolveInteractionLanguage(
  languageOverride?: InteractionLanguage,
): InteractionLanguage {
  return languageOverride ?? getInteractionLanguage();
}

export function interactionLanguageInstruction(language: InteractionLanguage): string {
  const name = language === "es" ? "Spanish" : "English";
  return [
    `Response language: Write user-facing explanations, questions, and final answers in ${name}.`,
    "Keep code, commands, paths, API names, quoted source text, and other literals unchanged unless the task explicitly asks to translate them.",
  ].join(" ");
}
