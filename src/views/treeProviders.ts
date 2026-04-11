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

function createStatusIcon(hasCriticalIssue: boolean): vscode.ThemeIcon {
  return hasCriticalIssue
    ? new vscode.ThemeIcon(
        "warning",
        new vscode.ThemeColor("problemsWarningIcon.foreground"),
      )
    : new vscode.ThemeIcon(
        "check",
        new vscode.ThemeColor("testing.iconPassed"),
      );
}

function summarizeAgentStatus(
  agent: AgentDefinition,
  allAgents: AgentDefinition[],
  workflows: WorkflowDefinition[],
): { statusText: string; tooltip: string; hasIssue: boolean } {
  const issues: string[] = [];
  const workflowCoverage = workflows.filter((workflow) =>
    workflow.nodes.some((node) => node.agentId === agent.id),
  ).length;
  const inboundHandoffs = allAgents.filter((candidate) =>
    candidate.handoffs.includes(agent.id),
  ).length;

  if (agent.capabilities.tools.length === 0) {
    issues.push("no tools");
  }
  if (!agent.instructions.trim()) {
    issues.push("no instructions");
  }
  if (agent.capabilities.skills.length === 0) {
    issues.push("missing skills");
  }
  if (agent.capabilities.mcpServers.length === 0) {
    issues.push("missing mcp");
  }
  const brokenHandoffs = agent.handoffs.filter(
    (handoffId) =>
      !allAgents.some(
        (candidate) => candidate.id === handoffId && candidate.id !== agent.id,
      ),
  );
  if (brokenHandoffs.length > 0) {
    issues.push("broken handoffs");
  }
  if (workflowCoverage === 0) {
    issues.push("no workflow coverage");
  }
  if (
    workflowCoverage === 0 &&
    inboundHandoffs === 0 &&
    agent.handoffs.length === 0
  ) {
    issues.push("orphan");
  }

  const statusText =
    issues.length > 0 ? issues.slice(0, 3).join(" · ") : "ready";
  const tooltip = [
    `${agent.name}`,
    `Role: ${agent.role || "n/a"}`,
    `Tools: ${agent.capabilities.tools.length}`,
    `Skills: ${agent.capabilities.skills.length}`,
    `MCP: ${agent.capabilities.mcpServers.length}`,
    `Workflow coverage: ${workflowCoverage}`,
    `Inbound handoffs: ${inboundHandoffs}`,
    `Outbound handoffs: ${agent.handoffs.length}`,
    `Status: ${issues.length > 0 ? issues.join(" · ") : "ready"}`,
    "Click to open this agent directly in Agent Builder.",
  ].join("\n");

  return { statusText, tooltip, hasIssue: issues.length > 0 };
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
        item.description = [agent.role || "no role", status.statusText].join(
          " · ",
        );
        item.tooltip = status.tooltip;
        item.iconPath = createStatusIcon(status.hasIssue);
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
        const item = new BaseItem(workflow.name);
        item.description = `${workflow.nodes.length} nodes · ${workflow.edges.length} edges`;
        item.tooltip = `${workflow.name}\nNodes: ${workflow.nodes.length}\nEdges: ${workflow.edges.length}\nClick to open this workflow in the dashboard editor.`;
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
