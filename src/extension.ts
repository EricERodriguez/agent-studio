import * as vscode from "vscode";
import * as path from "path";
import {
  registerCommands,
  pickAgent,
  createWorkflowSkeleton,
} from "./commands/registerCommands";
import { AgentRegistryService } from "./services/agentRegistryService";
import { AgentMarkdownService } from "./services/agentMarkdownService";
import {
  AGENT_PROVIDER_LABELS,
  AgentExportService,
} from "./services/agentExportService";
import { collectFilesByPattern, ensureDirectory } from "./infrastructure/fsUtils";
import { CapabilityService } from "./services/capabilityService";
import { ChatBridgeService } from "./services/chatBridgeService";
import { SampleDataService } from "./services/sampleDataService";
import { WorkflowService } from "./services/workflowService";
import { runShellIntegrationPrototype } from "./services/workflowRun/shellIntegrationPrototype";
import {
  runWorkflowGraph,
  type ApprovalDecision,
} from "./services/workflowRun/workflowRunManager";
import {
  AgentsTreeProvider,
  CapabilitiesTreeProvider,
  OnboardingTreeProvider,
  QuickActionsTreeProvider,
  TemplatesTreeProvider,
  WorkspaceHealthTreeProvider,
  WorkflowsTreeProvider,
} from "./views/treeProviders";
import { DashboardPanel } from "./views/dashboardPanel";
import type {
  AgentDefinition,
  AgentProvider,
  WorkflowDefinition,
} from "./domain/models";
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
  const agentMarkdownService = new AgentMarkdownService();
  const agentExportService = new AgentExportService();
  const workflowService = new WorkflowService();
  const capabilityService = new CapabilityService();
  const chatBridgeService = new ChatBridgeService();
  const sampleDataService = new SampleDataService(
    agentRegistryService,
    workflowService,
  );

  let agents: AgentDefinition[] = [];
  let workflows: WorkflowDefinition[] = [];
  const pendingApprovals = new Map<string, (decision: ApprovalDecision) => void>();
  const activeRuns = new Map<string, { cancel: () => void }>();

  const agentsTreeProvider = new AgentsTreeProvider();
  const workflowsTreeProvider = new WorkflowsTreeProvider();
  const capabilitiesTreeProvider = new CapabilitiesTreeProvider();
  const onboardingTreeProvider = new OnboardingTreeProvider();
  const quickActionsTreeProvider = new QuickActionsTreeProvider();
  const workspaceHealthTreeProvider = new WorkspaceHealthTreeProvider();
  const templatesTreeProvider = new TemplatesTreeProvider();

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(
      "agentStudio.onboardingView",
      onboardingTreeProvider,
    ),
    vscode.window.registerTreeDataProvider(
      "agentStudio.quickActionsView",
      quickActionsTreeProvider,
    ),
    vscode.window.registerTreeDataProvider(
      "agentStudio.healthView",
      workspaceHealthTreeProvider,
    ),
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
      if (
        (agent.sourceScope || "repository") === "repository" &&
        !(await ensureWorkspaceOpen())
      ) {
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
      // Delegate to the central deleteAgent handler to ensure user confirmation
      await deleteAgent(agentId);
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
      if (
        (workflow.sourceScope || "repository") === "repository" &&
        !(await ensureWorkspaceOpen())
      ) {
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
    onDeleteWorkflow: async (workflowId) => {
      await deleteWorkflow(workflowId);
    },
    onRenameWorkflow: async (workflowId) => {
      const workflow = workflows.find((candidate) => candidate.id === workflowId);
      if (!workflow) {
        return;
      }
      const newName = await vscode.window.showInputBox({
        prompt: "New workflow name",
        value: workflow.name,
        ignoreFocusOut: true,
      });
      if (!newName || newName === workflow.name) {
        return;
      }
      try {
        await workflowService.saveWorkflow({ ...workflow, name: newName });
        await refreshState();
        dashboard.postInfo(`Renamed workflow to ${newName}`);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to rename workflow.";
        dashboard.postError(message);
      }
    },
    onOpenRawWorkflow: async (workflowId) => {
      const workflow = workflows.find((candidate) => candidate.id === workflowId);
      if (!workflow?.sourcePath) {
        dashboard.postError(
          "This workflow has not been saved to disk yet — click Save Workflow first.",
        );
        return;
      }
      const doc = await vscode.workspace.openTextDocument(workflow.sourcePath);
      await vscode.window.showTextDocument(doc, { preview: false });
    },
    onApprovalResponse: (requestId, decision, instructions) => {
      const resolve = pendingApprovals.get(requestId);
      if (!resolve) {
        return;
      }
      pendingApprovals.delete(requestId);
      resolve({ decision, instructions });
    },
    onCancelWorkflow: (runId) => {
      activeRuns.get(runId)?.cancel();
    },
    onCreateAgent: async () => {
      await createAgent();
    },
    onCreateWorkflow: async () => {
      await createWorkflow();
    },
    onEditAgent: async (agentId) => {
      await editAgent(agentId);
    },
    onExportAgent: async (agentId, providers) => {
      if (!(await ensureWorkspaceOpen())) {
        dashboard.postError("Open a folder/workspace first to export agents.");
        return;
      }

      const target = agents.find((candidate) => candidate.id === agentId);
      if (!target) {
        dashboard.postError("Agent not found.");
        return;
      }

      try {
        await exportAgentToProviders(target, providers);
        await refreshState();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to export agent.";
        dashboard.postError(message);
      }
    },
    onExportAllAgents: async () => {
      if (agents.length === 0) {
        dashboard.postError("No agents to export.");
        return;
      }

      const picked = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectFiles: false,
        canSelectMany: false,
        openLabel: "Export here",
        title: "Choose a folder to export all agents into",
      });
      if (!picked || picked.length === 0) {
        return;
      }

      const destDir = picked[0].fsPath;
      try {
        await ensureDirectory(destDir);
        for (const agent of agents) {
          const filePath = path.join(destDir, `${agent.id}.agent.md`);
          const content = agentMarkdownService.generate(agent);
          await vscode.workspace.fs.writeFile(
            vscode.Uri.file(filePath),
            Buffer.from(content, "utf8"),
          );
        }
        dashboard.postInfo(
          `Exported ${agents.length} agent${agents.length === 1 ? "" : "s"} to ${destDir}.`,
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to export agents.";
        dashboard.postError(message);
      }
    },
    onCreateRepoStructure: async () => {
      if (agents.length === 0) {
        dashboard.postError("No agents to include in the repo structure.");
        return;
      }

      const picked = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectFiles: false,
        canSelectMany: false,
        openLabel: "Create here",
        title: "Choose a destination folder for the new agents repo",
      });
      if (!picked || picked.length === 0) {
        return;
      }

      const destDir = picked[0].fsPath;
      try {
        const agentsDir = path.join(destDir, ".github", "agents");
        await ensureDirectory(agentsDir);
        for (const agent of agents) {
          const filePath = path.join(agentsDir, `${agent.id}.agent.md`);
          const content = agentMarkdownService.generate(agent);
          await vscode.workspace.fs.writeFile(
            vscode.Uri.file(filePath),
            Buffer.from(content, "utf8"),
          );
        }
        const readme =
          `# Agents\n\n` +
          `This folder was generated by Agent Studio. It contains ${agents.length} agent definition${agents.length === 1 ? "" : "s"} under \`.github/agents/\`.\n\n` +
          `Open this folder in VS Code with the Agent Studio extension installed to edit, run, or add more agents.\n`;
        await vscode.workspace.fs.writeFile(
          vscode.Uri.file(path.join(destDir, "README.md")),
          Buffer.from(readme, "utf8"),
        );
        dashboard.postInfo(
          `Created repo structure with ${agents.length} agent${agents.length === 1 ? "" : "s"} at ${destDir}.`,
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to create repo structure.";
        dashboard.postError(message);
      }
    },
    onImportAgents: async () => {
      const picked = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectFiles: false,
        canSelectMany: false,
        openLabel: "Import from here",
        title: "Choose a folder to import agents from",
      });
      if (!picked || picked.length === 0) {
        return;
      }

      const scopeChoice = await vscode.window.showQuickPick(
        [
          { label: "Repository", value: "repository" as const },
          { label: "Global", value: "global" as const },
        ],
        { title: "Import agents as repository or global agents?" },
      );
      if (!scopeChoice) {
        return;
      }

      if (
        scopeChoice.value === "repository" &&
        !(await ensureWorkspaceOpen())
      ) {
        dashboard.postError(
          "Open a folder/workspace first to import repository agents.",
        );
        return;
      }

      const sourceDir = picked[0].fsPath;
      try {
        const found = await collectFilesByPattern(sourceDir, /\.agent\.md$/i);
        if (found.length === 0) {
          dashboard.postInfo("No .agent.md files found in that folder.");
          return;
        }

        let imported = 0;
        let skipped = 0;
        for (const fileUri of found) {
          const buffer = await vscode.workspace.fs.readFile(fileUri);
          const parsed = agentMarkdownService.parse(
            Buffer.from(buffer).toString("utf8"),
          );
          if (agents.some((existing) => existing.id === parsed.id)) {
            skipped += 1;
            continue;
          }
          parsed.sourceScope = scopeChoice.value;
          await agentRegistryService.saveAgent(parsed);
          imported += 1;
        }

        await refreshState();
        dashboard.postInfo(
          `Imported ${imported} agent${imported === 1 ? "" : "s"}` +
            (skipped > 0
              ? `, skipped ${skipped} (id already exists).`
              : "."),
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to import agents.";
        dashboard.postError(message);
      }
    },
    onExportAllWorkflows: async () => {
      if (workflows.length === 0) {
        dashboard.postError("No workflows to export.");
        return;
      }

      const picked = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectFiles: false,
        canSelectMany: false,
        openLabel: "Export here",
        title: "Choose a folder to export all workflows into",
      });
      if (!picked || picked.length === 0) {
        return;
      }

      const destDir = picked[0].fsPath;
      try {
        await ensureDirectory(destDir);
        for (const workflow of workflows) {
          const { sourcePath, sourceScope, shadowedWorkflow, ...rest } =
            workflow;
          const filePath = path.join(destDir, `${workflow.id}.json`);
          await vscode.workspace.fs.writeFile(
            vscode.Uri.file(filePath),
            Buffer.from(JSON.stringify(rest, null, 2), "utf8"),
          );
        }
        dashboard.postInfo(
          `Exported ${workflows.length} workflow${workflows.length === 1 ? "" : "s"} to ${destDir}.`,
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to export workflows.";
        dashboard.postError(message);
      }
    },
    onImportWorkflows: async () => {
      const picked = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectFiles: false,
        canSelectMany: false,
        openLabel: "Import from here",
        title: "Choose a folder to import workflows from",
      });
      if (!picked || picked.length === 0) {
        return;
      }

      const scopeChoice = await vscode.window.showQuickPick(
        [
          { label: "Repository", value: "repository" as const },
          { label: "Global", value: "global" as const },
        ],
        { title: "Import workflows as repository or global workflows?" },
      );
      if (!scopeChoice) {
        return;
      }

      if (
        scopeChoice.value === "repository" &&
        !(await ensureWorkspaceOpen())
      ) {
        dashboard.postError(
          "Open a folder/workspace first to import repository workflows.",
        );
        return;
      }

      const sourceDir = picked[0].fsPath;
      try {
        const found = await collectFilesByPattern(sourceDir, /\.json$/i);
        if (found.length === 0) {
          dashboard.postInfo("No .json workflow files found in that folder.");
          return;
        }

        let imported = 0;
        let skipped = 0;
        let invalid = 0;
        for (const fileUri of found) {
          const buffer = await vscode.workspace.fs.readFile(fileUri);
          let parsed: WorkflowDefinition;
          try {
            parsed = JSON.parse(
              Buffer.from(buffer).toString("utf8"),
            ) as WorkflowDefinition;
          } catch {
            invalid += 1;
            continue;
          }

          if (workflowService.validateWorkflow(parsed).length > 0) {
            invalid += 1;
            continue;
          }

          if (workflows.some((existing) => existing.id === parsed.id)) {
            skipped += 1;
            continue;
          }

          parsed.sourceScope = scopeChoice.value;
          await workflowService.saveWorkflow(parsed);
          imported += 1;
        }

        await refreshState();
        const notes = [
          skipped > 0 ? `skipped ${skipped} (id already exists)` : "",
          invalid > 0 ? `skipped ${invalid} (invalid workflow file)` : "",
        ].filter(Boolean);
        dashboard.postInfo(
          `Imported ${imported} workflow${imported === 1 ? "" : "s"}` +
            (notes.length > 0 ? `, ${notes.join(", ")}.` : "."),
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to import workflows.";
        dashboard.postError(message);
      }
    },
  });

  const refreshState = async (): Promise<void> => {
    agents = await agentRegistryService.discoverAgents();
    workflows = await workflowService.loadWorkflows();
    const capabilityGraph =
      await capabilityService.buildCapabilityGraph(agents);

    agentsTreeProvider.setData(agents, workflows);
    workflowsTreeProvider.setWorkflows(workflows);
    capabilitiesTreeProvider.setCapabilityGraph(capabilityGraph);
    workspaceHealthTreeProvider.setData(agents, workflows, capabilityGraph);
    dashboard.postState(agents, workflows, capabilityGraph);
  };

  const quickPickAgents = async (): Promise<void> => {
    if (agents.length === 0) {
      void vscode.window.showWarningMessage("No agents available.");
      return;
    }

    const pick = await vscode.window.showQuickPick(
      agents.map((agent) => ({
        label: agent.name,
        description: agent.role || agent.id,
        detail: agent.description,
        id: agent.id,
      })),
      { placeHolder: "Search and open an agent" },
    );

    if (!pick) {
      return;
    }

    dashboard.show();
    dashboard.focusAgentEditor(pick.id, "Identity");
  };

  const quickPickWorkflows = async (): Promise<void> => {
    if (workflows.length === 0) {
      void vscode.window.showWarningMessage("No workflows available.");
      return;
    }

    const pick = await vscode.window.showQuickPick(
      workflows.map((workflow) => ({
        label: workflow.name,
        description: `${workflow.nodes.length} nodes · ${workflow.edges.length} edges`,
        detail: workflow.description,
        id: workflow.id,
      })),
      { placeHolder: "Search and focus a workflow" },
    );

    if (!pick) {
      return;
    }

    dashboard.show();
    dashboard.focusWorkflow(pick.id);
  };

  const quickPickCapabilities = async (): Promise<void> => {
    const capabilityGraph =
      await capabilityService.buildCapabilityGraph(agents);

    type CapabilityQuickPickItem = vscode.QuickPickItem & {
      capabilityKind: "tool" | "skill" | "mcp";
      capabilityId: string;
    };

    const options: CapabilityQuickPickItem[] = [
      ...capabilityGraph.tools.map((tool) => ({
        label: tool.label,
        description: `Tool · ${tool.kind}`,
        detail: tool.id,
        capabilityKind: "tool" as const,
        capabilityId: tool.id,
      })),
      ...capabilityGraph.skills.map((skill) => ({
        label: skill.label,
        description: "Skill",
        detail: skill.id,
        capabilityKind: "skill" as const,
        capabilityId: skill.id,
      })),
      ...capabilityGraph.mcpServers.map((server) => ({
        label: server.label,
        description: "MCP Server",
        detail: server.id,
        capabilityKind: "mcp" as const,
        capabilityId: server.id,
      })),
    ];

    if (options.length === 0) {
      void vscode.window.showWarningMessage("No capabilities available.");
      return;
    }

    const pick = await vscode.window.showQuickPick(options, {
      placeHolder: "Search and focus a capability",
    });

    if (!pick) {
      return;
    }

    dashboard.show();
    dashboard.focusCapability(pick.capabilityKind, pick.capabilityId);
  };

  const runWorkflow = async (
    workflowId: string,
    mode: "chat" | "plan" | "cli-claude" | "cli-codex",
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

    if (mode === "cli-claude" || mode === "cli-codex") {
      const cliCommand = mode === "cli-claude" ? "claude" : "codex";
      const objective = await vscode.window.showInputBox({
        prompt: `What should the "${workflow.name}" workflow do?`,
        placeHolder: "Describe the task or user story for this run",
        ignoreFocusOut: true,
      });
      if (!objective) {
        dashboard.postInfo("Workflow run cancelled.");
        return;
      }

      const cwd =
        vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || context.extensionPath;
      const runId = `${workflow.id}-${Date.now()}`;
      const runDir = path.join(cwd, ".agent-studio", "runs", runId);

      const baseState: WorkflowRunState = {
        workflowId,
        mode,
        status: "running",
        steps: [],
        startedAt: Date.now(),
        runId,
      };
      dashboard.postWorkflowRunUpdate(baseState);

      let cancelled = false;
      activeRuns.set(runId, { cancel: () => (cancelled = true) });

      let lastSteps: WorkflowRunState["steps"] = [];
      const result = await runWorkflowGraph({
        workflow,
        agents,
        cliCommand,
        objective,
        runDir,
        cwd,
        chatBridgeService,
        onUpdate: (steps) => {
          lastSteps = steps;
          dashboard.postWorkflowRunUpdate({ ...baseState, status: "running", steps });
        },
        requestApproval: (request) =>
          new Promise<ApprovalDecision>((resolve) => {
            const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            pendingApprovals.set(requestId, resolve);
            dashboard.postApprovalRequest({
              requestId,
              workflowId: workflow.id,
              nodeId: request.nodeId,
              agentName: request.agentName,
              context: request.context,
            });
          }),
        shouldCancel: () => cancelled,
      });
      activeRuns.delete(runId);

      dashboard.postWorkflowRunUpdate({
        ...baseState,
        status: result.status,
        finishedAt: Date.now(),
        error: result.error,
        steps: lastSteps,
      });
      if (result.status === "failed") {
        dashboard.postError(`Workflow failed. ${result.error ?? ""}`.trim());
      } else {
        dashboard.postInfo(`Workflow executed: ${workflow.name}`);
      }
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
        step.message = "Agent invoked in chat";
        step.status = "completed";
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

  const pickProviders = async (
    preselected: AgentProvider[] = [],
  ): Promise<AgentProvider[] | undefined> => {
    const ALL_PROVIDERS: AgentProvider[] = ["claude", "codex", "antigravity"];
    const allLabel = "✨ All AIs (Claude, Codex & Antigravity)";

    const items = [
      ...ALL_PROVIDERS.map((value) => ({
        label: AGENT_PROVIDER_LABELS[value],
        value,
        picked: preselected.includes(value),
      })),
      {
        label: allLabel,
        value: "all" as const,
        picked: false,
      },
    ];

    const picks = await vscode.window.showQuickPick(items, {
      canPickMany: true,
      ignoreFocusOut: true,
      placeHolder:
        "Generate this agent for which AI tool(s)? (Esc to skip — you can export later)",
    });

    if (!picks) {
      return undefined;
    }

    if (picks.some((pick) => pick.value === "all")) {
      return ALL_PROVIDERS;
    }

    return picks.map((pick) => pick.value as AgentProvider);
  };

  const exportAgentToProviders = async (
    agent: AgentDefinition,
    providers: AgentProvider[],
  ): Promise<void> => {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root || providers.length === 0) {
      return;
    }

    const { written, skipped } = await agentExportService.exportAgent(
      agent,
      providers,
      root,
    );

    await agentRegistryService.saveAgent({
      ...agent,
      providers: [...new Set([...(agent.providers || []), ...providers])],
    });

    const fileList = written
      .map((w) => `${AGENT_PROVIDER_LABELS[w.provider]} → ${w.path}`)
      .join("\n");
    if (written.length > 0) {
      dashboard.postInfo(
        `Exported "${agent.name}" for ${written.map((w) => AGENT_PROVIDER_LABELS[w.provider]).join(", ")}.`,
      );
    }
    for (const skip of skipped) {
      dashboard.postInfo(
        `Skipped ${AGENT_PROVIDER_LABELS[skip.provider]} export for "${agent.name}": ${skip.reason}`,
      );
    }
    console.info(`Agent Studio export:\n${fileList}`);
  };

  const exportAgent = async (agentId?: string): Promise<void> => {
    if (!(await ensureWorkspaceOpen())) {
      return;
    }

    const target = agentId
      ? agents.find((agent) => agent.id === agentId)
      : await pickAgent(agents, "Select an agent to export");

    if (!target) {
      return;
    }

    const providers = await pickProviders(target.providers || []);
    if (!providers || providers.length === 0) {
      return;
    }

    await exportAgentToProviders(target, providers);
    await refreshState();
  };

  const createAgent = async (templateName?: string): Promise<void> => {
    if (!(await ensureWorkspaceOpen())) {
      return;
    }

    const scopePick = await vscode.window.showQuickPick(
      [
        {
          label: "Repository",
          description: "Save this agent inside the current repository",
          value: "repository",
        },
        {
          label: "Global",
          description: "Make this agent available in any repository",
          value: "global",
        },
      ],
      {
        placeHolder: "Where should this agent be stored?",
        ignoreFocusOut: true,
      },
    );

    if (!scopePick) {
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

    const providers = await pickProviders();

    const saved = await agentRegistryService.saveAgent({
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
      sourceScope: scopePick.value as "repository" | "global",
    });

    if (providers && providers.length > 0) {
      await exportAgentToProviders(saved, providers);
    }

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

  const focusWorkflow = async (workflowId?: string): Promise<void> => {
    dashboard.show();
    if (!workflowId) {
      return;
    }
    const selected = workflows.find((workflow) => workflow.id === workflowId);
    if (!selected) {
      return;
    }
    dashboard.focusWorkflow(selected.id);
    dashboard.postInfo(`Editing workflow ${selected.name}.`);
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

  const debugShellIntegrationPrototype = async (): Promise<void> => {
    await runShellIntegrationPrototype();
  };

  const refreshStudio = async (): Promise<void> => {
    await refreshState();
    dashboard.postInfo("Agent Studio refreshed.");
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

  const deleteWorkflow = async (workflowId?: string): Promise<void> => {
    const target = workflowId
      ? workflows.find((w) => w.id === workflowId)
      : undefined;

    if (!target) {
      return;
    }

    const confirmed = await vscode.window.showWarningMessage(
      `Delete workflow ${target.name}?`,
      { modal: true },
      "Delete",
    );
    if (confirmed !== "Delete") {
      return;
    }

    await workflowService.deleteWorkflow(target);
    await refreshState();
    dashboard.postInfo(`Deleted workflow ${target.name}`);
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
    const scopePick = await vscode.window.showQuickPick(
      [
        {
          label: "Repository",
          description: "Save this workflow inside the current repository",
          value: "repository" as const,
        },
        {
          label: "Global",
          description: "Make this workflow available in any repository",
          value: "global" as const,
        },
      ],
      {
        placeHolder: "Where should this workflow be stored?",
        ignoreFocusOut: true,
      },
    );

    if (!scopePick) {
      return;
    }

    if (scopePick.value === "repository" && !(await ensureWorkspaceOpen())) {
      return;
    }

    const skeleton = await createWorkflowSkeleton(agents);
    if (!skeleton) {
      return;
    }
    skeleton.sourceScope = scopePick.value;
    await workflowService.saveWorkflow(skeleton);
    await refreshState();
    dashboard.show();
    dashboard.focusWorkflow(skeleton.id);
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
    refreshStudio,
    quickPickAgents,
    quickPickWorkflows,
    quickPickCapabilities,
    createAgent,
    editAgent,
    deleteAgent,
    duplicateAgent,
    exportAgent,
    openInChat,
    createWorkflow,
    startMcpServer,
    focusCapability,
    focusWorkflow,
    showToolsGuide,
    debugShellIntegrationPrototype,
  });

  await refreshState();
  const shouldSeed = vscode.workspace
    .getConfiguration("agentStudio")
    .get<boolean>("seedSampleData", false);
  if (shouldSeed) {
    await sampleDataService.seedIfNeeded(agents, workflows);
    await refreshState();
  }
}

export function deactivate(): void {
  // no-op
}
