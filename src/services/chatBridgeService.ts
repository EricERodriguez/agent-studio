import * as vscode from "vscode";
import type { AgentDefinition } from "../domain/models";

export class ChatBridgeService {
  buildPrompt(agent: AgentDefinition): string {
    return [
      `Agent: ${agent.name}`,
      agent.description ? `Description: ${agent.description}` : "",
      agent.role ? `Role: ${agent.role}` : "",
      "",
      "Instructions:",
      agent.instructions,
    ]
      .filter(Boolean)
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
