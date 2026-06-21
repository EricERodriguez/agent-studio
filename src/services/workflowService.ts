import * as path from "path";
import * as vscode from "vscode";
import type { AgentScope, WorkflowDefinition } from "../domain/models";
import {
  ensureDirectory,
  getGlobalWorkflowsRoot,
  getWorkspaceRoot,
} from "../infrastructure/fsUtils";

export class WorkflowService {
  private getWorkflowFolder(root: string): string {
    return path.join(root, ".vscode", "agent-studio", "workflows");
  }

  private async collectWorkflowFiles(dirPath: string): Promise<vscode.Uri[]> {
    try {
      const entries = await vscode.workspace.fs.readDirectory(
        vscode.Uri.file(dirPath),
      );
      return entries
        .filter(
          ([name, fileType]) =>
            fileType === vscode.FileType.File && /\.json$/i.test(name),
        )
        .map(([name]) => vscode.Uri.file(path.join(dirPath, name)));
    } catch {
      return [];
    }
  }

  async loadWorkflows(): Promise<WorkflowDefinition[]> {
    const root = getWorkspaceRoot();

    const repoUris = root
      ? await vscode.workspace.findFiles(
          ".vscode/agent-studio/workflows/*.json",
        )
      : [];

    const globalRoot = getGlobalWorkflowsRoot();
    const globalUris = globalRoot
      ? await this.collectWorkflowFiles(globalRoot)
      : [];

    const files = [...globalUris, ...repoUris];

    const workflowsById = new Map<string, WorkflowDefinition>();
    for (const uri of files) {
      try {
        const bytes = await vscode.workspace.fs.readFile(uri);
        const workflow = JSON.parse(
          Buffer.from(bytes).toString("utf8"),
        ) as WorkflowDefinition;

        workflow.sourcePath = uri.fsPath;
        workflow.sourceScope = this.inferScopeFromPath(uri.fsPath, root);

        const shadowed = workflowsById.get(workflow.id);
        if (
          shadowed &&
          shadowed.sourcePath &&
          shadowed.sourcePath !== workflow.sourcePath
        ) {
          workflow.shadowedWorkflow = {
            sourcePath: shadowed.sourcePath,
            sourceScope: shadowed.sourceScope || "global",
          };
          console.warn(
            `Agent Studio: workflow id "${workflow.id}" exists in multiple files; ${uri.fsPath} takes precedence over ${shadowed.sourcePath}.`,
          );
        }

        workflowsById.set(workflow.id, workflow);
      } catch (error) {
        console.warn(
          `Agent Studio failed to read workflow ${uri.fsPath}`,
          error,
        );
      }
    }

    return [...workflowsById.values()];
  }

  private inferScopeFromPath(
    workflowPath: string,
    workspaceRoot?: string,
  ): AgentScope {
    if (workspaceRoot && workflowPath.startsWith(workspaceRoot)) {
      return "repository";
    }

    return "global";
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
    const issues = this.validateWorkflow(workflow);
    if (issues.length > 0) {
      throw new Error(issues.join(" "));
    }

    const targetScope = workflow.sourceScope || "repository";
    const root = getWorkspaceRoot();
    if (targetScope === "repository" && !root) {
      throw new Error("No workspace opened.");
    }

    const globalRoot = getGlobalWorkflowsRoot();
    const folder =
      targetScope === "global"
        ? globalRoot
        : this.getWorkflowFolder(root as string);

    if (!folder) {
      throw new Error(
        "Global workflows folder is not available on this system.",
      );
    }

    await ensureDirectory(folder);

    const target = path.join(folder, `${workflow.id}.json`);
    const previousPath = workflow.sourcePath;

    const { sourcePath, sourceScope, shadowedWorkflow, ...rest } = workflow;
    await vscode.workspace.fs.writeFile(
      vscode.Uri.file(target),
      Buffer.from(JSON.stringify(rest, null, 2), "utf8"),
    );

    if (previousPath && previousPath !== target) {
      try {
        await vscode.workspace.fs.delete(vscode.Uri.file(previousPath), {
          useTrash: true,
        });
      } catch (error) {
        console.warn(
          `Agent Studio could not remove old workflow file ${previousPath}`,
          error,
        );
      }
    }
  }

  async deleteWorkflow(workflow: WorkflowDefinition): Promise<void> {
    if (!workflow.sourcePath) {
      throw new Error("Workflow source file not found.");
    }
    await vscode.workspace.fs.delete(vscode.Uri.file(workflow.sourcePath), {
      useTrash: true,
    });
  }
}
