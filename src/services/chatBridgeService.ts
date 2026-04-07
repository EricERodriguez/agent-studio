import * as vscode from "vscode";
import type { AgentDefinition } from "../domain/models";

export class ChatBridgeService {
  async openAgentInChat(agent: AgentDefinition): Promise<void> {
    const prompt = [
      `Agent: ${agent.name}`,
      agent.description ? `Description: ${agent.description}` : "",
      agent.role ? `Role: ${agent.role}` : "",
      "",
      "Instructions:",
      agent.instructions,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await vscode.commands.executeCommand("workbench.action.chat.open");
      await vscode.env.clipboard.writeText(prompt);

      vscode.window.showInformationMessage(
        `Chat opened for ${agent.name}. Agent context has been copied to clipboard. Paste it into chat to continue.`,
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
