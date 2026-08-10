import type { AgentDefinition, HandoffMode, WorkflowDefinition } from "../domain/models";

/**
 * Fase 3 — native re-creation of SwarmForge's two/four/six-pack idea: a small catalog of
 * ready-to-run role chains, built as ordinary Agent Studio agents + workflow (not something
 * "imported and run with SwarmForge"). Role descriptions below are written from scratch based on
 * what each role name publicly implies, not copied from SwarmForge's own `.prompt` files (see
 * docs/swarmforge-integration/00 and 01-plan-revisado.md, Fase 0/3).
 *
 * SwarmForge's packs loop indefinitely between roles (e.g. coder <-> cleaner) until a human ends
 * the session. `workflowRunManager.ts` schedules a strict DAG — every node runs at most once per
 * run, there is no re-entry once a node is `completed` — so these templates are single-pass
 * chains instead of loops. That is a deliberate simplification to fit the engine already built
 * in this session, not an oversight.
 */

export type WorkflowTemplateId = "two-pack" | "four-pack" | "six-pack";

export interface WorkflowTemplateOption {
  id: WorkflowTemplateId;
  label: string;
  description: string;
}

export const WORKFLOW_TEMPLATE_OPTIONS: WorkflowTemplateOption[] = [
  {
    id: "two-pack",
    label: "Two-Pack",
    description: "Coder -> Cleaner. A quick single pass for small, well-scoped changes.",
  },
  {
    id: "four-pack",
    label: "Four-Pack",
    description:
      "Specifier -> Coder -> Refactorer -> Architect. A human approves the spec before coding starts.",
  },
  {
    id: "six-pack",
    label: "Six-Pack",
    description:
      "Specifier -> Coder -> Cleaner -> Architect -> Hardener -> QA. A human gate before final QA.",
  },
];

type RoleId = "specifier" | "coder" | "cleaner" | "refactorer" | "architect" | "hardener" | "qa";

interface RoleDefinition {
  id: RoleId;
  name: string;
  description: string;
  role: string;
  instructions: string;
  tags: string[];
}

const ROLES: Record<RoleId, RoleDefinition> = {
  specifier: {
    id: "specifier",
    name: "Specifier",
    description: "Turns a rough objective into a precise, unambiguous spec before any code is written.",
    role: "specification",
    instructions:
      "Read the objective and the current codebase. Write a short, concrete spec: what changes, " +
      "what stays the same, acceptance criteria, and open questions. Do not write implementation code.",
    tags: ["planning", "spec"],
  },
  coder: {
    id: "coder",
    name: "Coder",
    description: "Implements the agreed spec or objective.",
    role: "implementation",
    instructions:
      "Implement the requested change end to end. Follow the existing code style and conventions. " +
      "Keep the diff focused on what was asked.",
    tags: ["implementation"],
  },
  cleaner: {
    id: "cleaner",
    name: "Cleaner",
    description: "Removes dead code and redundant abstractions left behind by an implementation pass.",
    role: "cleanup",
    instructions:
      "Review the changes just made. Remove dead code, unused imports, and redundant abstractions. " +
      "Fix formatting and naming issues. Do not change behavior.",
    tags: ["cleanup", "quality"],
  },
  refactorer: {
    id: "refactorer",
    name: "Refactorer",
    description: "Restructures an implementation for clarity and maintainability without changing behavior.",
    role: "refactor",
    instructions:
      "Improve the structure of the recent changes: extract what deserves its own function or " +
      "module, simplify control flow, and reduce duplication. Preserve existing behavior exactly.",
    tags: ["refactor", "quality"],
  },
  architect: {
    id: "architect",
    name: "Architect",
    description: "Reviews structural and design decisions and flags architectural risk.",
    role: "architecture",
    instructions:
      "Review the current design and recent changes for architectural risk: coupling, layering " +
      "violations, and patterns that will not scale. Suggest concrete alternatives, do not just criticize.",
    tags: ["architecture", "review"],
  },
  hardener: {
    id: "hardener",
    name: "Hardener",
    description: "Adds error handling, edge-case coverage, and security hardening.",
    role: "hardening",
    instructions:
      "Review the recent changes for missing error handling, unhandled edge cases, and security " +
      "issues (input validation, injection, unsafe defaults). Fix what you find.",
    tags: ["security", "quality"],
  },
  qa: {
    id: "qa",
    name: "QA",
    description: "Writes and runs tests, and validates the work against its acceptance criteria.",
    role: "qa",
    instructions:
      "Write or update tests for the recent changes and run the test suite. Validate the result " +
      "against the original objective's acceptance criteria. Report clearly what passed and what did not.",
    tags: ["testing", "qa"],
  },
};

interface TemplateEdgeSpec {
  fromIndex: number;
  toIndex: number;
  handoff?: HandoffMode;
}

interface TemplateSpec {
  steps: RoleId[];
  edges: TemplateEdgeSpec[];
  defaultName: string;
}

const TEMPLATES: Record<WorkflowTemplateId, TemplateSpec> = {
  "two-pack": {
    steps: ["coder", "cleaner"],
    edges: [{ fromIndex: 0, toIndex: 1 }],
    defaultName: "Two-Pack Workflow",
  },
  "four-pack": {
    steps: ["specifier", "coder", "refactorer", "architect"],
    edges: [
      { fromIndex: 0, toIndex: 1, handoff: "human" },
      { fromIndex: 1, toIndex: 2 },
      { fromIndex: 2, toIndex: 3 },
    ],
    defaultName: "Four-Pack Workflow",
  },
  "six-pack": {
    steps: ["specifier", "coder", "cleaner", "architect", "hardener", "qa"],
    edges: [
      { fromIndex: 0, toIndex: 1 },
      { fromIndex: 1, toIndex: 2 },
      { fromIndex: 2, toIndex: 3 },
      { fromIndex: 3, toIndex: 4 },
      { fromIndex: 4, toIndex: 5, handoff: "human" },
    ],
    defaultName: "Six-Pack Workflow",
  },
};

export function defaultTemplateName(templateId: WorkflowTemplateId): string {
  return TEMPLATES[templateId].defaultName;
}

export interface BuiltTemplate {
  /** Only the roles missing from the caller's existing agent list — existing agents with a
   * matching id are reused as-is (never overwritten), so hand-edited role prompts survive
   * across template runs. */
  agentsToCreate: AgentDefinition[];
  workflow: WorkflowDefinition;
}

function toWorkflowId(name: string, isTaken: (id: string) => boolean): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "workflow";
  if (!isTaken(base)) {
    return base;
  }
  let suffix = 2;
  while (isTaken(`${base}-${suffix}`)) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
}

export function buildWorkflowFromTemplate(
  templateId: WorkflowTemplateId,
  workflowName: string,
  existingAgents: AgentDefinition[],
  isWorkflowIdTaken: (id: string) => boolean,
): BuiltTemplate {
  const spec = TEMPLATES[templateId];
  const existingIds = new Set(existingAgents.map((agent) => agent.id));
  const agentsToCreate: AgentDefinition[] = [];

  const nodes = spec.steps.map((roleId, index) => {
    const roleDef = ROLES[roleId];
    if (!existingIds.has(roleDef.id)) {
      agentsToCreate.push({
        id: roleDef.id,
        name: roleDef.name,
        description: roleDef.description,
        role: roleDef.role,
        instructions: roleDef.instructions,
        handoffs: [],
        tags: roleDef.tags,
        capabilities: { tools: [], skills: [], mcpServers: [] },
      });
      existingIds.add(roleDef.id);
    }
    return {
      id: `n${index + 1}`,
      agentId: roleDef.id,
      position: { x: 140 + index * 260, y: 140 },
      isEntry: index === 0,
    };
  });

  const edges = spec.edges.map((edge, index) => ({
    id: `e${index + 1}`,
    source: nodes[edge.fromIndex].id,
    target: nodes[edge.toIndex].id,
    label: "handoff",
    ...(edge.handoff ? { handoff: { mode: edge.handoff } } : {}),
  }));

  return {
    agentsToCreate,
    workflow: {
      id: toWorkflowId(workflowName, isWorkflowIdTaken),
      name: workflowName,
      nodes,
      edges,
    },
  };
}
