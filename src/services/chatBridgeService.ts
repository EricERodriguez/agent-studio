import * as vscode from "vscode";
import type { AgentDefinition, InteractionLanguage } from "../domain/models";
import {
  getInteractionLanguage,
  interactionLanguageInstruction,
} from "./interactionLanguageService";

export class ChatBridgeService {
  buildPrompt(
    agent: AgentDefinition,
    interactionLanguage = getInteractionLanguage(),
  ): string {
    return [
      `Agent: ${agent.name}`,
      agent.description ? `Description: ${agent.description}` : "",
      agent.role ? `Role: ${agent.role}` : "",
      "",
      "Instructions:",
      agent.instructions,
      "",
      interactionLanguageInstruction(interactionLanguage),
    ]
      .filter(Boolean)
      .join("\n");
  }

  /** Prompt for one CLI-mode workflow turn: the agent definition, the run's overall objective,
   * and (for every step after the first) the previous step's output, so agents build on each
   * other's work instead of each starting with no task. */
  buildTurnPrompt(
    agent: AgentDefinition,
    objective: string,
    previousStepOutput?: string,
    interactionLanguage?: InteractionLanguage,
  ): string {
    return [
      this.buildPrompt(agent, interactionLanguage),
      "",
      "Task:",
      objective,
      previousStepOutput ? `\nPrevious agent's output:\n${previousStepOutput}` : "",
    ]
      .filter((line) => line !== "")
      .join("\n");
  }

  async openAgentInChat(agent: AgentDefinition): Promise<void> {
    const prompt = this.buildPrompt(agent);

    try {
      await vscode.commands.executeCommand("workbench.action.chat.open");
      await vscode.env.clipboard.writeText(prompt);
      await vscode.commands.executeCommand(
        "editor.action.clipboardPasteAction",
      );

      vscode.window.showInformationMessage(
        `Chat opened for ${agent.name}. Agent context was copied and paste was attempted automatically.`,
      );
    } catch {
      const doc = await vscode.workspace.openTextDocument({
        language: "markdown",
        content: `# ${agent.name} Chat Context\n\n\`\`\`\n${prompt}\n\`\`\``,
      });
      await vscode.window.showTextDocument(doc, { preview: false });
      vscode.window.showWarningMessage(
        "Unable to open chat directly. Opened agent context in an editor instead.",
      );
    }
  }
}
