import * as vscode from "vscode";
import {
  registerCommands,
  pickAgent,
  createWorkflowSkeleton,
} from "./commands/registerCommands";
import { AgentRegistryService } from "./services/agentRegistryService";
import { CapabilityService } from "./services/capabilityService";
import { ChatBridgeService } from "./services/chatBridgeService";
import { SampleDataService } from "./services/sampleDataService";
import { WorkflowService } from "./services/workflowService";
import {
  AgentsTreeProvider,
  CapabilitiesTreeProvider,
  TemplatesTreeProvider,
  WorkflowsTreeProvider,
} from "./views/treeProviders";
import { DashboardPanel } from "./views/dashboardPanel";
import type { AgentDefinition, WorkflowDefinition } from "./domain/models";
import type { WorkflowRunState } from "./domain/messages";

export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  const quoteArg = (value: string): string =>
    /[\s"']/g.test(value) ? `"${value.replace(/(["\\$`])/g, "\\$1")}"` : value;

  const ensureWorkspaceOpen = async (): Promise<boolean> => {
    if ((vscode.workspace.workspaceFolders?.length || 0) > 0) {
      return true;
    }

    const action = await vscode.window.showErrorMessage(
      "Agent Studio needs an opened folder to create or save files.",
      "Open Extension Folder",
    );

    if (action === "Open Extension Folder") {
      await vscode.commands.executeCommand(
        "vscode.openFolder",
        vscode.Uri.file(context.extensionPath),
        false,
      );
    }

    return false;
  };

  const agentRegistryService = new AgentRegistryService();
  const workflowService = new WorkflowService();
  const capabilityService = new CapabilityService();
  const chatBridgeService = new ChatBridgeService();
  const sampleDataService = new SampleDataService(
    agentRegistryService,
    workflowService,
  );

  let agents: AgentDefinition[] = [];
  let workflows: WorkflowDefinition[] = [];

  const agentsTreeProvider = new AgentsTreeProvider();
  const workflowsTreeProvider = new WorkflowsTreeProvider();
  const capabilitiesTreeProvider = new CapabilitiesTreeProvider();
  const templatesTreeProvider = new TemplatesTreeProvider();

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(
      "agentStudio.agentsView",
      agentsTreeProvider,
    ),
    vscode.window.registerTreeDataProvider(
      "agentStudio.workflowsView",
      workflowsTreeProvider,
    ),
    vscode.window.registerTreeDataProvider(
      "agentStudio.capabilitiesView",
      capabilitiesTreeProvider,
    ),
    vscode.window.registerTreeDataProvider(
      "agentStudio.templatesView",
      templatesTreeProvider,
    ),
  );

  const dashboard = new DashboardPanel(context.extensionUri, {
    onRefresh: async () => {
      await refreshState();
    },
    onSaveAgent: async (agent) => {
      if (!(await ensureWorkspaceOpen())) {
        dashboard.postError("Open a folder/workspace first to save agents.");
        return;
      }

      try {
        await agentRegistryService.saveAgent(agent);
        await refreshState();
        dashboard.postInfo(`Saved agent ${agent.name}`);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to save agent.";
        dashboard.postError(message);
      }
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
      if (!(await ensureWorkspaceOpen())) {
        dashboard.postError("Open a folder/workspace first to save workflows.");
        return;
      }

      try {
        await workflowService.saveWorkflow(workflow);
        await refreshState();
        dashboard.postInfo(`Saved workflow ${workflow.name}`);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to save workflow.";
        dashboard.postError(message);
      }
    },
    onRunWorkflow: async (workflowId, mode) => {
      await runWorkflow(workflowId, mode);
    },
    onCreateAgent: async () => {
      await createAgent();
    },
    onEditAgent: async (agentId) => {
      await editAgent(agentId);
    },
  });

  const refreshState = async (): Promise<void> => {
    agents = await agentRegistryService.discoverAgents();
    workflows = await workflowService.loadWorkflows();
    const capabilityGraph =
      await capabilityService.buildCapabilityGraph(agents);

    agentsTreeProvider.setAgents(agents);
    workflowsTreeProvider.setWorkflows(workflows);
    capabilitiesTreeProvider.setCapabilityGraph(capabilityGraph);
    dashboard.postState(agents, workflows, capabilityGraph);
  };

  const runWorkflow = async (
    workflowId: string,
    mode: "chat" | "plan",
  ): Promise<void> => {
    const workflow = workflows.find((candidate) => candidate.id === workflowId);
    if (!workflow) {
      dashboard.postError("Workflow not found.");
      return;
    }

    const validationErrors = workflowService.validateWorkflow(workflow);
    if (validationErrors.length > 0) {
      dashboard.postError(validationErrors.join(" "));
      return;
    }

    const nodeById = new Map(workflow.nodes.map((node) => [node.id, node]));
    const entry = workflow.nodes.find((node) => node.isEntry);
    if (!entry) {
      dashboard.postError("Workflow has no entry node.");
      return;
    }

    const orderedNodeIds: string[] = [];
    const visited = new Set<string>();

    const walkFrom = (nodeId: string): void => {
      if (visited.has(nodeId) || !nodeById.has(nodeId)) {
        return;
      }
      visited.add(nodeId);
      orderedNodeIds.push(nodeId);

      const next = workflow.edges
        .filter((edge) => edge.source === nodeId)
        .map((edge) => edge.target);
      for (const target of next) {
        walkFrom(target);
      }
    };

    walkFrom(entry.id);

    const steps: WorkflowRunState["steps"] = orderedNodeIds.map((nodeId) => {
      const node = nodeById.get(nodeId)!;
      const agent = agents.find((candidate) => candidate.id === node.agentId);
      return {
        nodeId,
        agentId: node.agentId,
        agentName: agent?.name ?? node.agentId,
        status: "pending",
      };
    });

    if (steps.length === 0) {
      dashboard.postError("Workflow has no reachable steps from entry node.");
      return;
    }

    const baseState: WorkflowRunState = {
      workflowId,
      mode,
      status: "running",
      currentStepIndex: 0,
      steps,
      startedAt: Date.now(),
    };

    const publish = (state: WorkflowRunState): void => {
      dashboard.postWorkflowRunUpdate(state);
    };

    publish(baseState);

    if (mode === "plan") {
      const planLines = [
        `Execution plan for workflow: ${workflow.name}`,
        "",
        ...steps.map(
          (step, index) =>
            `${index + 1}. ${step.agentName} (${step.agentId}) [node: ${step.nodeId}]`,
        ),
      ];
      const planText = planLines.join("\n");
      publish({
        ...baseState,
        status: "completed",
        currentStepIndex: undefined,
        steps: steps.map((step) => ({
          ...step,
          status: "completed",
          message: "Included in execution plan",
        })),
        finishedAt: Date.now(),
        planText,
      });
      dashboard.postInfo(`Workflow plan generated: ${workflow.name}`);
      return;
    }

    const stepStates: WorkflowRunState["steps"] = steps.map((step) => ({
      ...step,
    }));

    for (let index = 0; index < stepStates.length; index += 1) {
      const step = stepStates[index];
      step.status = "running";
      step.message = "Opening agent in chat";
      publish({
        ...baseState,
        status: "running",
        currentStepIndex: index,
        steps: [...stepStates],
      });

      const agent = agents.find((candidate) => candidate.id === step.agentId);
      if (!agent) {
        step.status = "failed";
        step.message = "Agent not found";
        for (let j = index + 1; j < stepStates.length; j += 1) {
          stepStates[j].status = "skipped";
          stepStates[j].message = "Skipped after failure";
        }
        publish({
          ...baseState,
          status: "failed",
          currentStepIndex: index,
          steps: [...stepStates],
          finishedAt: Date.now(),
          error: `Missing agent: ${step.agentId}`,
        });
        dashboard.postError(`Workflow failed. Missing agent: ${step.agentId}`);
        return;
      }

      try {
        await chatBridgeService.openAgentInChat(agent);
        step.status = "completed";
        step.message = "Agent invoked in chat";
      } catch (error) {
        step.status = "failed";
        step.message =
          error instanceof Error ? error.message : "Failed to open chat";
        for (let j = index + 1; j < stepStates.length; j += 1) {
          stepStates[j].status = "skipped";
          stepStates[j].message = "Skipped after failure";
        }
        publish({
          ...baseState,
          status: "failed",
          currentStepIndex: index,
          steps: [...stepStates],
          finishedAt: Date.now(),
          error: step.message,
        });
        dashboard.postError(`Workflow failed at step ${index + 1}.`);
        return;
      }

      publish({
        ...baseState,
        status: "running",
        currentStepIndex: index,
        steps: [...stepStates],
      });
    }

    publish({
      ...baseState,
      status: "completed",
      currentStepIndex: undefined,
      steps: [...stepStates],
      finishedAt: Date.now(),
    });
    dashboard.postInfo(`Workflow executed: ${workflow.name}`);
  };

  const createAgent = async (templateName?: string): Promise<void> => {
    if (!(await ensureWorkspaceOpen())) {
      return;
    }

    const name =
      (await vscode.window.showInputBox({
        prompt: "Agent name",
        value: templateName || "New Agent",
        ignoreFocusOut: true,
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
        mcpServers: [],
      },
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
      dashboard.focusAgentEditor(picked.id, "Identity");
      dashboard.postInfo(`Editing ${picked.name} in Agent Builder.`);
      return;
    }

    const picked = agents.find((agent) => agent.id === agentId);
    if (picked) {
      dashboard.focusAgentEditor(picked.id, "Identity");
      dashboard.postInfo(`Editing ${picked.name} in Agent Builder.`);
    }
  };

  const focusCapability = async (
    kind: "tool" | "skill" | "mcp",
    id?: string,
  ): Promise<void> => {
    if (!id) {
      return;
    }
    dashboard.show();
    dashboard.focusCapability(kind, id);
  };

  const showToolsGuide = async (): Promise<void> => {
    const guide = [
      "# Agent Studio - Tools Guide",
      "",
      "## What is a Tool?",
      "A tool is an action an agent can execute, such as `read_file`, `run_in_terminal`, or any MCP tool.",
      "",
      "## How to add tools to an agent",
      "1. Open Agent Studio dashboard.",
      "2. Select your agent.",
      "3. Go to the **Capabilities** tab.",
      "4. In **Add or update a Tool**, fill Tool ID, label, and kind.",
      "5. Click **Add Tool** and then **Save**.",
      "",
      "## Tool ID format",
      "- Built-in example: `run_in_terminal`",
      "- Extension example: `someExtension.someCommand`",
      "- MCP example: `mcp_server.tool_name`",
      "",
      "## Tips",
      "- Use consistent naming for labels.",
      "- Keep tool lists short and task-focused per agent.",
      "- Refresh dashboard after changing files manually.",
    ].join("\n");

    const doc = await vscode.workspace.openTextDocument({
      language: "markdown",
      content: guide,
    });
    await vscode.window.showTextDocument(doc, { preview: false });
  };

  const deleteAgent = async (agentId?: string): Promise<void> => {
    const target = agentId
      ? agents.find((agent) => agent.id === agentId)
      : await pickAgent(agents, "Select an agent to delete");

    if (!target) {
      return;
    }

    const confirmed = await vscode.window.showWarningMessage(
      `Delete ${target.name}?`,
      { modal: true },
      "Delete",
    );
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
    if (!(await ensureWorkspaceOpen())) {
      return;
    }

    const skeleton = await createWorkflowSkeleton(agents);
    if (!skeleton) {
      return;
    }
    await workflowService.saveWorkflow(skeleton);
    await refreshState();
    dashboard.show();
  };

  const startMcpServer = async (mcpId?: string): Promise<void> => {
    const available = await capabilityService.discoverMcpServers(agents);
    if (available.length === 0) {
      void vscode.window.showWarningMessage(
        "No MCP servers found. Add servers to mcp.json first.",
      );
      return;
    }

    const selected = mcpId
      ? available.find((mcp) => mcp.id === mcpId)
      : (
          await vscode.window.showQuickPick(
            available.map((mcp) => ({
              label: mcp.label,
              description: mcp.command,
              detail: [mcp.command, ...(mcp.args || [])]
                .filter(Boolean)
                .join(" "),
              mcp,
            })),
            { placeHolder: "Select MCP server to start" },
          )
        )?.mcp;

    if (!selected) {
      return;
    }

    if (!selected.command) {
      void vscode.window.showErrorMessage(
        `MCP server '${selected.label}' has no command configured.`,
      );
      return;
    }

    const terminal = vscode.window.createTerminal({
      name: `MCP: ${selected.label}`,
      cwd:
        vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ||
        context.extensionPath,
      env: selected.env,
    });

    const shellCommand = [selected.command, ...(selected.args || [])]
      .map((arg) => quoteArg(arg))
      .join(" ");

    terminal.show();
    terminal.sendText(shellCommand, true);
    void vscode.window.showInformationMessage(
      `Starting MCP server '${selected.label}' in terminal '${terminal.name}'.`,
    );
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
    createWorkflow,
    startMcpServer,
    focusCapability,
    showToolsGuide,
  });

  await refreshState();
  await sampleDataService.seedIfNeeded(agents, workflows);
  await refreshState();
}

export function deactivate(): void {
  // no-op
}
