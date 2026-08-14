import * as path from "path";
import type { WorkflowDefinition } from "../domain/models";

/**
 * The portable, repository-shaped representation of an Agent Studio library.
 * These paths intentionally match regular repository discovery, so opening a
 * resource repository in VS Code makes its agents and workflows editable
 * immediately without an extra configuration step.
 */
export const RESOURCE_REPOSITORY_PATHS = {
  agents: path.join(".github", "agents"),
  workflows: path.join(".vscode", "agent-studio", "workflows"),
} as const;

export function isSafeResourceId(id: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/.test(id);
}

export interface ResourceRepositoryLayout {
  root: string;
  agentsDir: string;
  workflowsDir: string;
  readmePath: string;
  manifestPath: string;
}

export function resourceRepositoryLayout(root: string): ResourceRepositoryLayout {
  return {
    root,
    agentsDir: path.join(root, RESOURCE_REPOSITORY_PATHS.agents),
    workflowsDir: path.join(root, RESOURCE_REPOSITORY_PATHS.workflows),
    readmePath: path.join(root, "README.md"),
    manifestPath: path.join(root, "agent-studio.bundle.json"),
  };
}

export function resourceRepositoryManifest(
  agentCount: number,
  workflowCount: number,
): string {
  return JSON.stringify(
    {
      schemaVersion: 1,
      kind: "agent-studio-resource-repository",
      mode: "merge",
      exportedAgents: agentCount,
      exportedWorkflows: workflowCount,
    },
    null,
    2,
  ) + "\n";
}

/** Removes local discovery metadata before a workflow is shared or persisted. */
export function serializeWorkflowDefinition(
  workflow: WorkflowDefinition,
): Omit<WorkflowDefinition, "sourcePath" | "sourceScope" | "shadowedWorkflow"> {
  const { sourcePath, sourceScope, shadowedWorkflow, ...definition } = workflow;
  return definition;
}

export function resourceRepositoryReadme(
  agentCount: number,
  workflowCount: number,
): string {
  return `# Agent Studio resources

This repository is a portable Agent Studio library. It contains ${agentCount} agent definition${agentCount === 1 ? "" : "s"} and ${workflowCount} workflow${workflowCount === 1 ? "" : "s"}.

## Layout

- \`.github/agents/\` — editable \`.agent.md\` definitions.
- \`.vscode/agent-studio/workflows/\` — editable workflow graph JSON files.

Open this repository in VS Code with Agent Studio to add, select, edit, run, import, or export either resource type. Workflows reference agents by id, so keep related changes together in this repository.
`;
}
