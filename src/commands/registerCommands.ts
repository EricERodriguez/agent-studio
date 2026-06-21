import * as vscode from "vscode";
import type { AgentDefinition, WorkflowDefinition } from "../domain/models";

export interface CommandHandlers {
  openDashboard: () => void;
  refreshStudio: () => Promise<void>;
  quickPickAgents: () => Promise<void>;
  quickPickWorkflows: () => Promise<void>;
  quickPickCapabilities: () => Promise<void>;
  createAgent: (templateName?: string) => Promise<void>;
  editAgent: (agentId?: string) => Promise<void>;
  deleteAgent: (agentId?: string) => Promise<void>;
  duplicateAgent: (agentId?: string) => Promise<void>;
  exportAgent: (agentId?: string) => Promise<void>;
  openInChat: (agentId?: string) => Promise<void>;
  createWorkflow: () => Promise<void>;
  startMcpServer: (mcpId?: string) => Promise<void>;
  focusCapability: (
    kind: "tool" | "skill" | "mcp",
    id?: string,
  ) => Promise<void>;
  focusWorkflow: (workflowId?: string) => Promise<void>;
  showToolsGuide: () => Promise<void>;
}

export function registerCommands(
  context: vscode.ExtensionContext,
  handlers: CommandHandlers,
): void {
  const defs: Array<[string, (...args: unknown[]) => unknown]> = [
    ["agentStudio.openDashboard", () => handlers.openDashboard()],
    ["agentStudio.refreshStudio", () => handlers.refreshStudio()],
    ["agentStudio.quickPickAgents", () => handlers.quickPickAgents()],
    ["agentStudio.quickPickWorkflows", () => handlers.quickPickWorkflows()],
    [
      "agentStudio.quickPickCapabilities",
      () => handlers.quickPickCapabilities(),
    ],
    [
      "agentStudio.createAgent",
      (templateName) =>
        handlers.createAgent(templateName as string | undefined),
    ],
    [
      "agentStudio.editAgent",
      (agentId) => handlers.editAgent(agentId as string | undefined),
    ],
    [
      "agentStudio.deleteAgent",
      (agentId) => handlers.deleteAgent(agentId as string | undefined),
    ],
    [
      "agentStudio.duplicateAgent",
      (agentId) => handlers.duplicateAgent(agentId as string | undefined),
    ],
    [
      "agentStudio.exportAgent",
      (agentId) => handlers.exportAgent(agentId as string | undefined),
    ],
    [
      "agentStudio.openInChat",
      (agentId) => handlers.openInChat(agentId as string | undefined),
    ],
    ["agentStudio.createWorkflow", () => handlers.createWorkflow()],
    [
      "agentStudio.startMcpServer",
      (mcpId) => handlers.startMcpServer(mcpId as string | undefined),
    ],
    [
      "agentStudio.focusCapability",
      (kind, id) =>
        handlers.focusCapability(
          kind as "tool" | "skill" | "mcp",
          id as string | undefined,
        ),
    ],
    [
      "agentStudio.focusWorkflow",
      (workflowId) => handlers.focusWorkflow(workflowId as string | undefined),
    ],
    ["agentStudio.showToolsGuide", () => handlers.showToolsGuide()],
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
