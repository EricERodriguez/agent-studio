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

export class AgentsTreeProvider implements vscode.TreeDataProvider<BaseItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  constructor(private agents: AgentDefinition[] = []) {}

  setAgents(agents: AgentDefinition[]): void {
    this.agents = agents;
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
        const item = new BaseItem(agent.name);
        item.description = agent.role || "no role";
        item.tooltip = `${agent.name}\nTools: ${agent.capabilities.tools.length} · Skills: ${agent.capabilities.skills.length} · MCP: ${agent.capabilities.mcpServers.length}`;
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
        item.tooltip = `${workflow.name}\nNodes: ${workflow.nodes.length}\nEdges: ${workflow.edges.length}`;
        item.command = {
          command: "agentStudio.openDashboard",
          title: "Open Dashboard",
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
        new BaseItem("Tools", vscode.TreeItemCollapsibleState.Collapsed),
        new BaseItem("Skills", vscode.TreeItemCollapsibleState.Collapsed),
        new BaseItem("MCP Servers", vscode.TreeItemCollapsibleState.Collapsed),
      ]);
    }

    if (element.label === "Tools") {
      const helpItem = new BaseItem(
        "How to add tools",
        vscode.TreeItemCollapsibleState.None,
      );
      helpItem.description = "Quick setup guide";
      helpItem.contextValue = "agentStudio.toolsHelp";
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
