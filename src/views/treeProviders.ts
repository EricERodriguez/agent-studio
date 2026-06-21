import * as vscode from "vscode";
import type {
  AgentDefinition,
  CapabilityGraph,
  WorkflowDefinition,
} from "../domain/models";

class BaseItem extends vscode.TreeItem {
  constructor(
    label: string,
    collapsibleState = vscode.TreeItemCollapsibleState.None,
  ) {
    super(label, collapsibleState);
  }
}

type AgentIssueKind =
  | "broken-handoffs"
  | "no-instructions"
  | "orphan"
  | "no-workflow-coverage"
  | "no-tools"
  | "missing-skills"
  | "missing-mcp";

interface AgentIssue {
  kind: AgentIssueKind;
  label: string;
}

function createStatusIcon(primaryIssue?: AgentIssueKind): vscode.ThemeIcon {
  if (!primaryIssue) {
    return new vscode.ThemeIcon(
      "check",
      new vscode.ThemeColor("testing.iconPassed"),
    );
  }

  const iconByIssue: Record<AgentIssueKind, { id: string; color: string }> = {
    "broken-handoffs": { id: "error", color: "problemsErrorIcon.foreground" },
    "no-instructions": {
      id: "warning",
      color: "problemsWarningIcon.foreground",
    },
    orphan: { id: "issues", color: "problemsWarningIcon.foreground" },
    "no-workflow-coverage": {
      id: "debug-disconnect",
      color: "charts.orange",
    },
    "no-tools": { id: "tools", color: "charts.yellow" },
    "missing-skills": { id: "lightbulb", color: "charts.blue" },
    "missing-mcp": { id: "plug", color: "charts.purple" },
  };

  const selected = iconByIssue[primaryIssue];
  return new vscode.ThemeIcon(
    selected.id,
    new vscode.ThemeColor(selected.color),
  );
}

function summarizeAgentStatus(
  agent: AgentDefinition,
  allAgents: AgentDefinition[],
  workflows: WorkflowDefinition[],
): {
  statusText: string;
  tooltip: string;
  hasIssue: boolean;
  primaryIssue?: AgentIssueKind;
} {
  const issues: AgentIssue[] = [];
  const workflowCoverage = workflows.filter((workflow) =>
    workflow.nodes.some((node) => node.agentId === agent.id),
  ).length;
  const inboundHandoffs = allAgents.filter((candidate) =>
    candidate.handoffs.map((h) => h.agent).includes(agent.id),
  ).length;

  if (agent.capabilities.tools.length === 0) {
    issues.push({ kind: "no-tools", label: "no tools" });
  }
  if (!agent.instructions.trim()) {
    issues.push({ kind: "no-instructions", label: "no instructions" });
  }
  if (agent.capabilities.skills.length === 0) {
    issues.push({ kind: "missing-skills", label: "missing skills" });
  }
  if (agent.capabilities.mcpServers.length === 0) {
    issues.push({ kind: "missing-mcp", label: "missing mcp" });
  }
  const brokenHandoffs = agent.handoffs.filter(
    (handoff) =>
      !allAgents.some(
        (candidate) =>
          candidate.id === handoff.agent && candidate.id !== agent.id,
      ),
  );
  if (brokenHandoffs.length > 0) {
    issues.push({ kind: "broken-handoffs", label: "broken handoffs" });
  }
  if (workflowCoverage === 0) {
    issues.push({
      kind: "no-workflow-coverage",
      label: "no workflow coverage",
    });
  }
  if (
    workflowCoverage === 0 &&
    inboundHandoffs === 0 &&
    agent.handoffs.length === 0
  ) {
    issues.push({ kind: "orphan", label: "orphan" });
  }

  const priority: AgentIssueKind[] = [
    "broken-handoffs",
    "no-instructions",
    "orphan",
    "no-workflow-coverage",
    "no-tools",
    "missing-skills",
    "missing-mcp",
  ];
  const primaryIssue = priority.find((kind) =>
    issues.some((issue) => issue.kind === kind),
  );

  const statusText =
    issues.length > 0
      ? issues
          .slice(0, 2)
          .map((issue) => issue.label)
          .join(" · ")
      : "ready";
  const tooltip = [
    `${agent.name}`,
    `Scope: ${agent.sourceScope || "repository"}`,
    `Role: ${agent.role || "n/a"}`,
    `Tools: ${agent.capabilities.tools.length}`,
    `Skills: ${agent.capabilities.skills.length}`,
    `MCP: ${agent.capabilities.mcpServers.length}`,
    `Workflow coverage: ${workflowCoverage}`,
    `Inbound handoffs: ${inboundHandoffs}`,
    `Outbound handoffs: ${agent.handoffs.length}`,
    `Status: ${issues.length > 0 ? issues.map((issue) => issue.label).join(" · ") : "ready"}`,
    "Click to open this agent directly in Agent Builder.",
  ].join("\n");

  return {
    statusText,
    tooltip,
    hasIssue: issues.length > 0,
    primaryIssue,
  };
}

export class AgentsTreeProvider implements vscode.TreeDataProvider<BaseItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  constructor(
    private agents: AgentDefinition[] = [],
    private workflows: WorkflowDefinition[] = [],
  ) {}

  setData(agents: AgentDefinition[], workflows: WorkflowDefinition[]): void {
    this.agents = agents;
    this.workflows = workflows;
    this.onDidChangeTreeDataEmitter.fire();
  }

  getTreeItem(element: BaseItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: BaseItem): Thenable<BaseItem[]> {
    if (element) {
      return Promise.resolve([]);
    }

    return Promise.resolve(
      this.agents.map((agent) => {
        const status = summarizeAgentStatus(agent, this.agents, this.workflows);
        const item = new BaseItem(agent.name);
        const scopeBadge =
          agent.sourceScope === "global" ? "$(globe) global" : "$(repo) repo";
        item.description = [
          scopeBadge,
          agent.role || "no role",
          status.statusText,
        ].join(" · ");
        item.tooltip = agent.shadowedAgent
          ? `${status.tooltip}\n\nWarning: this agent id also exists as a ${agent.shadowedAgent.sourceScope} agent at ${agent.shadowedAgent.sourcePath}, which is shadowed and ignored.`
          : status.tooltip;
        item.iconPath = agent.shadowedAgent
          ? new vscode.ThemeIcon(
              "warning",
              new vscode.ThemeColor("problemsWarningIcon.foreground"),
            )
          : createStatusIcon(status.primaryIssue);
        item.contextValue = "agentStudio.agent";
        item.command = {
          command: "agentStudio.editAgent",
          title: "Edit Agent",
          arguments: [agent.id],
        };
        return item;
      }),
    );
  }
}

export class WorkspaceHealthTreeProvider implements vscode.TreeDataProvider<BaseItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  private agents: AgentDefinition[] = [];
  private workflows: WorkflowDefinition[] = [];
  private capabilityGraph: CapabilityGraph = {
    tools: [],
    skills: [],
    mcpServers: [],
    usage: { tools: {}, skills: {}, mcpServers: {} },
  };

  setData(
    agents: AgentDefinition[],
    workflows: WorkflowDefinition[],
    capabilityGraph: CapabilityGraph,
  ): void {
    this.agents = agents;
    this.workflows = workflows;
    this.capabilityGraph = capabilityGraph;
    this.onDidChangeTreeDataEmitter.fire();
  }

  getTreeItem(element: BaseItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: BaseItem): Thenable<BaseItem[]> {
    if (!element) {
      return Promise.resolve([
        new BaseItem("Summary", vscode.TreeItemCollapsibleState.Expanded),
        new BaseItem("Agents", vscode.TreeItemCollapsibleState.Collapsed),
        new BaseItem("Workflows", vscode.TreeItemCollapsibleState.Collapsed),
        new BaseItem("Capabilities", vscode.TreeItemCollapsibleState.Collapsed),
      ]);
    }

    const workflowCoverageByAgent = new Map<string, number>();
    for (const agent of this.agents) {
      workflowCoverageByAgent.set(
        agent.id,
        this.workflows.filter((workflow) =>
          workflow.nodes.some((node) => node.agentId === agent.id),
        ).length,
      );
    }

    const orphanAgents = this.agents.filter((agent) => {
      const inboundHandoffs = this.agents.filter((candidate) =>
        candidate.handoffs.map((h) => h.agent).includes(agent.id),
      ).length;
      const coverage = workflowCoverageByAgent.get(agent.id) || 0;
      return (
        coverage === 0 && inboundHandoffs === 0 && agent.handoffs.length === 0
      );
    }).length;

    const workflowsWithoutEntry = this.workflows.filter(
      (workflow) => !workflow.nodes.some((node) => node.isEntry),
    ).length;

    const unusedTools = this.capabilityGraph.tools.filter(
      (tool) => (this.capabilityGraph.usage.tools[tool.id] || []).length === 0,
    ).length;
    const unusedSkills = this.capabilityGraph.skills.filter(
      (skill) =>
        (this.capabilityGraph.usage.skills[skill.id] || []).length === 0,
    ).length;
    const unusedMcp = this.capabilityGraph.mcpServers.filter(
      (mcp) =>
        (this.capabilityGraph.usage.mcpServers[mcp.id] || []).length === 0,
    ).length;

    const missingInstructions = this.agents.filter(
      (agent) => !agent.instructions.trim(),
    ).length;
    const missingTools = this.agents.filter(
      (agent) => agent.capabilities.tools.length === 0,
    ).length;
    const missingSkills = this.agents.filter(
      (agent) => agent.capabilities.skills.length === 0,
    ).length;
    const missingMcp = this.agents.filter(
      (agent) => agent.capabilities.mcpServers.length === 0,
    ).length;

    const metricItem = (
      label: string,
      value: number,
      tooltip: string,
    ): BaseItem => {
      const item = new BaseItem(`${label}: ${value}`);
      item.description = value === 0 ? "ok" : "attention";
      item.tooltip = tooltip;
      item.iconPath = new vscode.ThemeIcon(
        value === 0 ? "check" : "warning",
        new vscode.ThemeColor(
          value === 0 ? "testing.iconPassed" : "problemsWarningIcon.foreground",
        ),
      );
      return item;
    };

    if (element.label === "Summary") {
      return Promise.resolve([
        metricItem(
          "Orphan agents",
          orphanAgents,
          "Agents with no workflow coverage and no inbound/outbound handoffs.",
        ),
        metricItem(
          "Workflows without entry",
          workflowsWithoutEntry,
          "Workflows that have no step marked as entry point.",
        ),
        metricItem(
          "Unused capabilities",
          unusedTools + unusedSkills + unusedMcp,
          "Total capabilities not referenced by any agent.",
        ),
      ]);
    }

    if (element.label === "Agents") {
      return Promise.resolve([
        metricItem(
          "Missing instructions",
          missingInstructions,
          "Agents without instruction content.",
        ),
        metricItem("Missing tools", missingTools, "Agents with zero tools."),
        metricItem("Missing skills", missingSkills, "Agents with zero skills."),
        metricItem("Missing MCP", missingMcp, "Agents with zero MCP servers."),
      ]);
    }

    if (element.label === "Workflows") {
      const emptyWorkflows = this.workflows.filter(
        (workflow) => workflow.nodes.length === 0,
      ).length;
      return Promise.resolve([
        metricItem(
          "Workflows without entry",
          workflowsWithoutEntry,
          "Workflows that have no entry step.",
        ),
        metricItem(
          "Empty workflows",
          emptyWorkflows,
          "Workflows that currently have zero nodes.",
        ),
      ]);
    }

    if (element.label === "Capabilities") {
      return Promise.resolve([
        metricItem(
          "Unused tools",
          unusedTools,
          "Tools discovered but not used by any agent.",
        ),
        metricItem(
          "Unused skills",
          unusedSkills,
          "Skills discovered but not used by any agent.",
        ),
        metricItem(
          "Unused MCP servers",
          unusedMcp,
          "MCP servers discovered but not used by any agent.",
        ),
      ]);
    }

    return Promise.resolve([]);
  }
}

export class OnboardingTreeProvider implements vscode.TreeDataProvider<BaseItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  getTreeItem(element: BaseItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: BaseItem): Thenable<BaseItem[]> {
    if (element) {
      return Promise.resolve([]);
    }

    const openDashboard = new BaseItem("1. Open the dashboard");
    openDashboard.description = "main workspace";
    openDashboard.tooltip =
      "Start here to manage agents, workflows, filters, graphs, and inspection panels in one place.";
    openDashboard.command = {
      command: "agentStudio.openDashboard",
      title: "Open Dashboard",
    };

    const createAgent = new BaseItem("2. Create your first agent");
    createAgent.description = "identity + prompt";
    createAgent.tooltip =
      "Create an agent, then define its name, role, instructions, context, and capabilities in Agent Builder.";
    createAgent.command = {
      command: "agentStudio.createAgent",
      title: "Create Agent",
    };

    const toolsGuide = new BaseItem("3. Learn tools and capabilities");
    toolsGuide.description = "tools, skills, mcp";
    toolsGuide.tooltip =
      "Open the built-in guide to understand tools, skills, MCP servers, and how they are assigned to agents.";
    toolsGuide.command = {
      command: "agentStudio.showToolsGuide",
      title: "Show Tools Guide",
    };

    const createWorkflow = new BaseItem("4. Build a workflow");
    createWorkflow.description = "connect agents";
    createWorkflow.tooltip =
      "Create a workflow, add agent steps, mark an entry point, and wire edges between steps.";
    createWorkflow.command = {
      command: "agentStudio.createWorkflow",
      title: "Create Workflow",
    };

    const refresh = new BaseItem("5. Refresh after manual edits");
    refresh.description = "reload registry";
    refresh.tooltip =
      "If you changed files by hand, refresh Agent Studio to rediscover agents, workflows, tools, skills, and MCP servers.";
    refresh.command = {
      command: "agentStudio.refreshStudio",
      title: "Refresh Studio",
    };

    return Promise.resolve([
      openDashboard,
      createAgent,
      toolsGuide,
      createWorkflow,
      refresh,
    ]);
  }
}

export class WorkflowsTreeProvider implements vscode.TreeDataProvider<BaseItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  constructor(private workflows: WorkflowDefinition[] = []) {}

  setWorkflows(workflows: WorkflowDefinition[]): void {
    this.workflows = workflows;
    this.onDidChangeTreeDataEmitter.fire();
  }

  getTreeItem(element: BaseItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: BaseItem): Thenable<BaseItem[]> {
    if (element) {
      return Promise.resolve([]);
    }

    return Promise.resolve(
      this.workflows.map((workflow) => {
        const scopeBadge =
          workflow.sourceScope === "global" ? "$(globe) global" : "$(repo) repo";
        const item = new BaseItem(workflow.name);
        item.description = `${scopeBadge} · ${workflow.nodes.length} nodes · ${workflow.edges.length} edges`;
        item.tooltip = workflow.shadowedWorkflow
          ? `${workflow.name}\nScope: ${workflow.sourceScope || "repository"}\nNodes: ${workflow.nodes.length}\nEdges: ${workflow.edges.length}\nClick to open this workflow in the dashboard editor.\n\nWarning: this workflow id also exists as a ${workflow.shadowedWorkflow.sourceScope} workflow at ${workflow.shadowedWorkflow.sourcePath}, which is shadowed and ignored.`
          : `${workflow.name}\nScope: ${workflow.sourceScope || "repository"}\nNodes: ${workflow.nodes.length}\nEdges: ${workflow.edges.length}\nClick to open this workflow in the dashboard editor.`;
        item.iconPath = workflow.shadowedWorkflow
          ? new vscode.ThemeIcon(
              "warning",
              new vscode.ThemeColor("problemsWarningIcon.foreground"),
            )
          : undefined;
        item.contextValue = "agentStudio.workflow";
        item.command = {
          command: "agentStudio.focusWorkflow",
          title: "Focus Workflow",
          arguments: [workflow.id],
        };
        return item;
      }),
    );
  }
}

export class CapabilitiesTreeProvider implements vscode.TreeDataProvider<BaseItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  constructor(private capabilityGraph?: CapabilityGraph) {}

  setCapabilityGraph(capabilityGraph: CapabilityGraph): void {
    this.capabilityGraph = capabilityGraph;
    this.onDidChangeTreeDataEmitter.fire();
  }

  getTreeItem(element: BaseItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: BaseItem): Thenable<BaseItem[]> {
    if (!this.capabilityGraph) {
      return Promise.resolve([]);
    }

    if (!element) {
      return Promise.resolve([
        Object.assign(
          new BaseItem("Tools", vscode.TreeItemCollapsibleState.Collapsed),
          {
            tooltip:
              "Tools are executable actions available to agents. Expand to inspect tools and jump to filtered results in the dashboard.",
          },
        ),
        Object.assign(
          new BaseItem("Skills", vscode.TreeItemCollapsibleState.Collapsed),
          {
            tooltip:
              "Skills are reusable guidance packs. Expand to see which skills exist and who uses them.",
          },
        ),
        Object.assign(
          new BaseItem(
            "MCP Servers",
            vscode.TreeItemCollapsibleState.Collapsed,
          ),
          {
            tooltip:
              "MCP servers expose extra tools. Expand to inspect them, focus matching agents, or start a server.",
          },
        ),
      ]);
    }

    if (element.label === "Tools") {
      const helpItem = new BaseItem(
        "How to add tools",
        vscode.TreeItemCollapsibleState.None,
      );
      helpItem.description = "Quick setup guide";
      helpItem.contextValue = "agentStudio.toolsHelp";
      helpItem.tooltip =
        "Open a short guide explaining what tools are, how to add them, and common naming patterns.";
      helpItem.command = {
        command: "agentStudio.showToolsGuide",
        title: "Show Tools Guide",
      };

      return Promise.resolve([
        helpItem,
        ...this.capabilityGraph.tools.map((tool) => {
          const item = new BaseItem(tool.label);
          const usage = this.capabilityGraph?.usage.tools[tool.id]?.length || 0;
          item.description = `${tool.kind} · ${usage} agents`;
          item.tooltip = `${tool.label}\nID: ${tool.id}\nKind: ${tool.kind}\nUsed by ${usage} agents\nClick to highlight matching agents in the dashboard.`;
          item.contextValue = "agentStudio.tool";
          item.command = {
            command: "agentStudio.focusCapability",
            title: "Focus Tool",
            arguments: ["tool", tool.id],
          };
          return item;
        }),
      ]);
    }
    if (element.label === "Skills") {
      return Promise.resolve(
        this.capabilityGraph.skills.map((skill) => {
          const item = new BaseItem(skill.label);
          const usage =
            this.capabilityGraph?.usage.skills[skill.id]?.length || 0;
          item.description = `${usage} agents`;
          item.tooltip = `${skill.label}\nID: ${skill.id}\nUsed by ${usage} agents\nClick to focus this skill in the dashboard.`;
          item.contextValue = "agentStudio.skill";
          item.command = {
            command: "agentStudio.focusCapability",
            title: "Focus Skill",
            arguments: ["skill", skill.id],
          };
          return item;
        }),
      );
    }
    if (element.label === "MCP Servers") {
      return Promise.resolve(
        this.capabilityGraph.mcpServers.map((mcp) => {
          const item = new BaseItem(mcp.label);
          const usage =
            this.capabilityGraph?.usage.mcpServers[mcp.id]?.length || 0;
          item.description = `${usage} agents`;
          item.tooltip = `${mcp.label}\nID: ${mcp.id}\nUsed by ${usage} agents\nClick to focus this MCP server in the dashboard. Use the context menu to start it.`;
          item.contextValue = "agentStudio.mcpServer";
          item.command = {
            command: "agentStudio.focusCapability",
            title: "Focus MCP Server",
            arguments: ["mcp", mcp.id],
          };
          return item;
        }),
      );
    }
    return Promise.resolve([]);
  }
}

export class QuickActionsTreeProvider implements vscode.TreeDataProvider<BaseItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  getTreeItem(element: BaseItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: BaseItem): Thenable<BaseItem[]> {
    if (element) {
      return Promise.resolve([]);
    }

    const openDashboard = new BaseItem("Open Dashboard");
    openDashboard.description = "visual editor";
    openDashboard.tooltip =
      "Open the main Agent Studio dashboard to edit agents, workflows, graphs, and capabilities.";
    openDashboard.command = {
      command: "agentStudio.openDashboard",
      title: "Open Dashboard",
    };

    const createAgent = new BaseItem("Create Agent");
    createAgent.description = "new agent";
    createAgent.tooltip =
      "Create a new agent and open it in the dashboard for editing.";
    createAgent.command = {
      command: "agentStudio.createAgent",
      title: "Create Agent",
    };

    const createWorkflow = new BaseItem("Create Workflow");
    createWorkflow.description = "new flow";
    createWorkflow.tooltip =
      "Create a new workflow skeleton and continue editing it in the dashboard.";
    createWorkflow.command = {
      command: "agentStudio.createWorkflow",
      title: "Create Workflow",
    };

    const refresh = new BaseItem("Refresh Studio");
    refresh.description = "reload data";
    refresh.tooltip =
      "Reload agents, workflows, and capabilities from disk without leaving the sidebar.";
    refresh.command = {
      command: "agentStudio.refreshStudio",
      title: "Refresh Studio",
    };

    return Promise.resolve([
      openDashboard,
      createAgent,
      createWorkflow,
      refresh,
    ]);
  }
}

export class TemplatesTreeProvider implements vscode.TreeDataProvider<BaseItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  getTreeItem(element: BaseItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: BaseItem): Thenable<BaseItem[]> {
    if (element) {
      return Promise.resolve([]);
    }

    const planner = new BaseItem("Planner Template");
    const implementer = new BaseItem("Implementer Template");
    const reviewer = new BaseItem("Reviewer Template");
    planner.command = {
      command: "agentStudio.createAgent",
      title: "Create Agent",
      arguments: ["Planner"],
    };
    implementer.command = {
      command: "agentStudio.createAgent",
      title: "Create Agent",
      arguments: ["Backend Implementer"],
    };
    reviewer.command = {
      command: "agentStudio.createAgent",
      title: "Create Agent",
      arguments: ["Reviewer"],
    };

    return Promise.resolve([planner, implementer, reviewer]);
  }
}
