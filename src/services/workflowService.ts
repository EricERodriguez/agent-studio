import * as path from "path";
import * as vscode from "vscode";
import type { WorkflowDefinition } from "../domain/models";
import { ensureDirectory, getWorkspaceRoot } from "../infrastructure/fsUtils";

export class WorkflowService {
  private getWorkflowFolder(root: string): string {
    return path.join(root, ".vscode", "agent-studio", "workflows");
  }

  async loadWorkflows(): Promise<WorkflowDefinition[]> {
    const root = getWorkspaceRoot();
    if (!root) {
      return [];
    }

    const workflowUris = await vscode.workspace.findFiles(".vscode/agent-studio/workflows/*.json");
    const workflows: WorkflowDefinition[] = [];

    for (const uri of workflowUris) {
      try {
        const bytes = await vscode.workspace.fs.readFile(uri);
        const workflow = JSON.parse(Buffer.from(bytes).toString("utf8")) as WorkflowDefinition;
        workflows.push(workflow);
      } catch (error) {
        console.warn(`Agent Studio failed to read workflow ${uri.fsPath}`, error);
      }
    }

    return workflows;
  }

  validateWorkflow(workflow: WorkflowDefinition): string[] {
    const errors: string[] = [];
    if (!workflow.name.trim()) {
      errors.push("Workflow name is required.");
    }

    const nodeIds = new Set(workflow.nodes.map((n) => n.id));
    const entryCount = workflow.nodes.filter((n) => n.isEntry).length;
    if (entryCount !== 1) {
      errors.push("Workflow must include exactly one entry node.");
    }

    for (const edge of workflow.edges) {
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
        errors.push(`Edge ${edge.id} has broken node references.`);
      }
    }

    return errors;
  }

  async saveWorkflow(workflow: WorkflowDefinition): Promise<void> {
    const root = getWorkspaceRoot();
    if (!root) {
      throw new Error("No workspace opened.");
    }

    const issues = this.validateWorkflow(workflow);
    if (issues.length > 0) {
      throw new Error(issues.join(" "));
    }

    const folder = this.getWorkflowFolder(root);
    await ensureDirectory(folder);

    const target = path.join(folder, `${workflow.id}.json`);
    await vscode.workspace.fs.writeFile(vscode.Uri.file(target), Buffer.from(JSON.stringify(workflow, null, 2), "utf8"));
  }
}
