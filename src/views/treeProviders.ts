import * as vscode from "vscode";
import type { AgentDefinition, CapabilityGraph, WorkflowDefinition } from "../domain/models";

class BaseItem extends vscode.TreeItem {
  constructor(label: string, collapsibleState = vscode.TreeItemCollapsibleState.None) {
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
        item.description = agent.role;
        item.contextValue = "agentStudio.agent";
        item.command = { command: "agentStudio.editAgent", title: "Edit Agent", arguments: [agent.id] };
        return item;
      })
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
        item.description = `${workflow.nodes.length} nodes`;
        item.command = { command: "agentStudio.openDashboard", title: "Open Dashboard" };
        return item;
      })
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
        new BaseItem("MCP Servers", vscode.TreeItemCollapsibleState.Collapsed)
      ]);
    }

    if (element.label === "Tools") {
      return Promise.resolve(this.capabilityGraph.tools.map((tool) => new BaseItem(tool.label)));
    }
    if (element.label === "Skills") {
      return Promise.resolve(this.capabilityGraph.skills.map((skill) => new BaseItem(skill.label)));
    }
    if (element.label === "MCP Servers") {
      return Promise.resolve(this.capabilityGraph.mcpServers.map((mcp) => new BaseItem(mcp.label)));
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
    planner.command = { command: "agentStudio.createAgent", title: "Create Agent", arguments: ["Planner"] };
    implementer.command = { command: "agentStudio.createAgent", title: "Create Agent", arguments: ["Backend Implementer"] };
    reviewer.command = { command: "agentStudio.createAgent", title: "Create Agent", arguments: ["Reviewer"] };

    return Promise.resolve([planner, implementer, reviewer]);
  }
}
