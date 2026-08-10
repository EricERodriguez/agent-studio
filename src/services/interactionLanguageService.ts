import * as vscode from "vscode";
import type { InteractionLanguage } from "../domain/models";
import {
  interactionLanguageInstruction,
  normalizeInteractionLanguage,
  resolveInteractionLanguageValue,
} from "./interactionLanguage";

export { interactionLanguageInstruction } from "./interactionLanguage";

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
  return resolveInteractionLanguageValue(languageOverride, getInteractionLanguage());
}
