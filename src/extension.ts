import * as vscode from "vscode";
import { registerCommands, pickAgent, createWorkflowSkeleton } from "./commands/registerCommands";
import { AgentRegistryService } from "./services/agentRegistryService";
import { CapabilityService } from "./services/capabilityService";
import { ChatBridgeService } from "./services/chatBridgeService";
import { SampleDataService } from "./services/sampleDataService";
import { WorkflowService } from "./services/workflowService";
import {
  AgentsTreeProvider,
  CapabilitiesTreeProvider,
  TemplatesTreeProvider,
  WorkflowsTreeProvider
} from "./views/treeProviders";
import { DashboardPanel } from "./views/dashboardPanel";
import type { AgentDefinition, WorkflowDefinition } from "./domain/models";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const agentRegistryService = new AgentRegistryService();
  const workflowService = new WorkflowService();
  const capabilityService = new CapabilityService();
  const chatBridgeService = new ChatBridgeService();
  const sampleDataService = new SampleDataService(agentRegistryService, workflowService);

  let agents: AgentDefinition[] = [];
  let workflows: WorkflowDefinition[] = [];

  const agentsTreeProvider = new AgentsTreeProvider();
  const workflowsTreeProvider = new WorkflowsTreeProvider();
  const capabilitiesTreeProvider = new CapabilitiesTreeProvider();
  const templatesTreeProvider = new TemplatesTreeProvider();

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("agentStudio.agentsView", agentsTreeProvider),
    vscode.window.registerTreeDataProvider("agentStudio.workflowsView", workflowsTreeProvider),
    vscode.window.registerTreeDataProvider("agentStudio.capabilitiesView", capabilitiesTreeProvider),
    vscode.window.registerTreeDataProvider("agentStudio.templatesView", templatesTreeProvider)
  );

  const dashboard = new DashboardPanel(context.extensionUri, {
    onRefresh: async () => {
      await refreshState();
    },
    onSaveAgent: async (agent) => {
      await agentRegistryService.saveAgent(agent);
      await refreshState();
      dashboard.postInfo(`Saved agent ${agent.name}`);
    },
    onDeleteAgent: async (agentId) => {
      const agent = agents.find((candidate) => candidate.id === agentId);
      if (!agent) {
        return;
      }
      await agentRegistryService.deleteAgent(agent);
      await refreshState();
      dashboard.postInfo(`Deleted ${agent.name}`);
    },
    onOpenRawAgent: async (agentId) => {
      const agent = agents.find((candidate) => candidate.id === agentId);
      if (!agent?.sourcePath) {
        return;
      }
      const doc = await vscode.workspace.openTextDocument(agent.sourcePath);
      await vscode.window.showTextDocument(doc, { preview: false });
    },
    onOpenInChat: async (agentId) => {
      const agent = agents.find((candidate) => candidate.id === agentId);
      if (!agent) {
        return;
      }
      await chatBridgeService.openAgentInChat(agent);
    },
    onSaveWorkflow: async (workflow) => {
      await workflowService.saveWorkflow(workflow);
      await refreshState();
      dashboard.postInfo(`Saved workflow ${workflow.name}`);
    },
    onCreateAgent: async () => {
      await createAgent();
    },
    onEditAgent: async (agentId) => {
      await editAgent(agentId);
    }
  });

  const refreshState = async (): Promise<void> => {
    agents = await agentRegistryService.discoverAgents();
    workflows = await workflowService.loadWorkflows();
    const capabilityGraph = await capabilityService.buildCapabilityGraph(agents);

    agentsTreeProvider.setAgents(agents);
    workflowsTreeProvider.setWorkflows(workflows);
    capabilitiesTreeProvider.setCapabilityGraph(capabilityGraph);
    dashboard.postState(agents, workflows, capabilityGraph);
  };

  const createAgent = async (templateName?: string): Promise<void> => {
    const name =
      (await vscode.window.showInputBox({
        prompt: "Agent name",
        value: templateName || "New Agent",
        ignoreFocusOut: true
      })) || "";

    if (!name.trim()) {
      return;
    }

    await agentRegistryService.saveAgent({
      id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      name,
      description: "",
      instructions: "Describe how this agent should think and act.",
      handoffs: [],
      tags: [],
      capabilities: {
        tools: [],
        skills: [],
        mcpServers: []
      }
    });

    await refreshState();
    dashboard.show();
  };

  const editAgent = async (agentId?: string): Promise<void> => {
    dashboard.show();
    if (!agentId) {
      const picked = await pickAgent(agents, "Select an agent to edit");
      if (!picked) {
        return;
      }
      dashboard.postInfo(`Editing ${picked.name} in Agent Builder.`);
      return;
    }

    const picked = agents.find((agent) => agent.id === agentId);
    if (picked) {
      dashboard.postInfo(`Editing ${picked.name} in Agent Builder.`);
    }
  };

  const deleteAgent = async (agentId?: string): Promise<void> => {
    const target = agentId
      ? agents.find((agent) => agent.id === agentId)
      : await pickAgent(agents, "Select an agent to delete");

    if (!target) {
      return;
    }

    const confirmed = await vscode.window.showWarningMessage(`Delete ${target.name}?`, { modal: true }, "Delete");
    if (confirmed !== "Delete") {
      return;
    }

    await agentRegistryService.deleteAgent(target);
    await refreshState();
  };

  const duplicateAgent = async (agentId?: string): Promise<void> => {
    const target = agentId
      ? agents.find((agent) => agent.id === agentId)
      : await pickAgent(agents, "Select an agent to duplicate");

    if (!target) {
      return;
    }

    await agentRegistryService.duplicateAgent(target);
    await refreshState();
  };

  const openInChat = async (agentId?: string): Promise<void> => {
    const target = agentId
      ? agents.find((agent) => agent.id === agentId)
      : await pickAgent(agents, "Select an agent to open in chat");

    if (!target) {
      return;
    }

    await chatBridgeService.openAgentInChat(target);
  };

  const createWorkflow = async (): Promise<void> => {
    const skeleton = await createWorkflowSkeleton(agents);
    if (!skeleton) {
      return;
    }
    await workflowService.saveWorkflow(skeleton);
    await refreshState();
    dashboard.show();
  };

  registerCommands(context, {
    openDashboard: () => {
      dashboard.show();
      void refreshState();
    },
    createAgent,
    editAgent,
    deleteAgent,
    duplicateAgent,
    openInChat,
    createWorkflow
  });

  await refreshState();
  await sampleDataService.seedIfNeeded(agents, workflows);
  await refreshState();
}

export function deactivate(): void {
  // no-op
}
