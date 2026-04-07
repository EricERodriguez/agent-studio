import * as vscode from "vscode";
import type { AgentDefinition, WorkflowDefinition } from "../domain/models";

export interface CommandHandlers {
  openDashboard: () => void;
  createAgent: (templateName?: string) => Promise<void>;
  editAgent: (agentId?: string) => Promise<void>;
  deleteAgent: (agentId?: string) => Promise<void>;
  duplicateAgent: (agentId?: string) => Promise<void>;
  openInChat: (agentId?: string) => Promise<void>;
  createWorkflow: () => Promise<void>;
}

export function registerCommands(
  context: vscode.ExtensionContext,
  handlers: CommandHandlers,
): void {
  const defs: Array<[string, (...args: unknown[]) => unknown]> = [
    ["agentStudio.openDashboard", handlers.openDashboard],
    ["agentStudio.createAgent", handlers.createAgent],
    ["agentStudio.editAgent", handlers.editAgent],
    ["agentStudio.deleteAgent", handlers.deleteAgent],
    ["agentStudio.duplicateAgent", handlers.duplicateAgent],
    ["agentStudio.openInChat", handlers.openInChat],
    ["agentStudio.createWorkflow", handlers.createWorkflow],
  ];

  for (const [command, cb] of defs) {
    context.subscriptions.push(vscode.commands.registerCommand(command, cb));
  }
}

export async function pickAgent(
  agents: AgentDefinition[],
  placeHolder: string,
): Promise<AgentDefinition | undefined> {
  if (agents.length === 0) {
    vscode.window.showWarningMessage("No agents available.");
    return undefined;
  }

  const pick = await vscode.window.showQuickPick(
    agents.map((agent) => ({
      label: agent.name,
      description: agent.description,
      agent,
    })),
    { placeHolder },
  );

  return pick?.agent;
}

export async function createWorkflowSkeleton(
  existingAgents: AgentDefinition[],
): Promise<WorkflowDefinition | undefined> {
  if (existingAgents.length === 0) {
    vscode.window.showWarningMessage(
      "Create at least one agent before creating workflows.",
    );
    return undefined;
  }

  const name = await vscode.window.showInputBox({
    prompt: "Workflow name",
    value: "New Workflow",
    ignoreFocusOut: true,
  });

  if (!name) {
    return undefined;
  }

  const firstAgent = existingAgents[0];
  return {
    id: name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, ""),
    name,
    nodes: [
      {
        id: "entry",
        agentId: firstAgent.id,
        position: { x: 180, y: 120 },
        isEntry: true,
      },
    ],
    edges: [],
  };
}
