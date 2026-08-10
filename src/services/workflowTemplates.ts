import type { AgentDefinition, HandoffMode, WorkflowDefinition } from "../domain/models";

/**
 * Fase 3 — native re-creation of SwarmForge's two/four/six-pack idea: a small catalog of
 * ready-to-run role chains, built as ordinary Agent Studio agents + workflow (not something
 * "imported and run with SwarmForge"). The instructions below were written from scratch after
 * reading SwarmForge's real `swarmforge/roles/<role>.prompt` files (fetched from the `two-pack`,
 * `four-pack`, and `six-pack` branches of github.com/unclebob/swarm-forge on 2026-08-10) to
 * understand each role's actual scope, boundaries, and handoff behavior in depth — not a guess
 * from the role name alone. The wording itself is original: no sentence is copied from those
 * files, and SwarmForge-specific mechanics (tmux, git worktrees, the file-based handoff daemon,
 * its exact tool names like `gherkin-parser`/`ir-dry-checker`) were deliberately left out, since
 * they don't apply to Agent Studio's model (a single objective per run, handoff via graph edges,
 * optional human approval already built into the engine). See docs/swarmforge-integration/00 and
 * 01-plan-revisado.md, Fase 0/3, for the "no literal copy" boundary this follows.
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
    description: "Turns a rough objective into a precise, testable spec and a QA checklist before any code is written.",
    role: "specification",
    instructions:
      "Turn the given objective into a precise, testable specification before any code is written. " +
      "Write concrete acceptance criteria as scenarios (given/when/then is fine) covering the happy " +
      "path and the edge cases that actually matter, plus a short end-to-end QA checklist that " +
      "verifies the finished feature through its real interface (CLI, UI, or public API) rather than " +
      "by inspecting implementation details. Call out anything ambiguous as an open question instead " +
      "of guessing. Do not write implementation code or prescribe internal design — that belongs to " +
      "Coder and Architect. Keep the spec small and stable: prefer one clear scenario over five " +
      "overlapping ones.",
    tags: ["planning", "spec"],
  },
  coder: {
    id: "coder",
    name: "Coder",
    description: "Implements the approved spec or objective slice by slice, test-first.",
    role: "implementation",
    instructions:
      "Implement the approved specification or objective end to end, one focused slice at a time. " +
      "Use test-driven development: write a failing unit test that expresses the next piece of " +
      "observable behavior, then write only enough code to make it pass, then move on. Keep the code " +
      "testable — push side effects (filesystem, network, time, randomness) behind small boundaries " +
      "you can substitute in tests. Do not attempt broad cleanup, architectural restructuring, or " +
      "hardening outside the slice you are implementing; that is owned by the roles downstream. Once " +
      "the tests for the slice pass, hand off with a clear summary of what changed and what remains.",
    tags: ["implementation"],
  },
  cleaner: {
    id: "cleaner",
    name: "Cleaner",
    description: "Structure-preserving cleanup after an implementation pass — names, duplication, dead code.",
    role: "cleanup",
    instructions:
      "Clean up after an implementation pass without changing behavior. Improve names, split " +
      "functions or files that mix unrelated responsibilities, remove dead code and duplicated " +
      "logic, and tidy up test setup and assertions so the tests read clearly. Reduce complexity in " +
      "the functions you touch. Stay local: do not change module boundaries, dependency direction, " +
      "or introduce new behavior — that is Architect's call, not yours. Re-run the test suite after " +
      "every change to confirm behavior stayed the same before handing off.",
    tags: ["cleanup", "quality"],
  },
  refactorer: {
    id: "refactorer",
    name: "Refactorer",
    description: "Structure-preserving cleanup plus coverage: strengthens tests while tidying the implementation.",
    role: "refactor",
    instructions:
      "Perform structure-preserving cleanup and strengthen test coverage after the coder's " +
      "implementation, without changing observable behavior. Improve names, reduce duplication, " +
      "clarify boundaries, and move logic that is hard to test out of glue code into testable " +
      "modules. Look for coverage gaps and, where it adds real value, add tests for edge cases " +
      "example-based tests tend to miss (empty/huge input, boundary values, round-trips). Flag files " +
      "that have grown too large or tangled to review safely, and split them if you can do so " +
      "without changing behavior. Do not introduce new features, and always re-run the test suite " +
      "before handing off.",
    tags: ["refactor", "quality"],
  },
  architect: {
    id: "architect",
    name: "Architect",
    description: "Reviews the shape of the system — boundaries, dependency direction, coupling — not local style.",
    role: "architecture",
    instructions:
      "Review the current structure of the codebase and the recent changes for architectural risk, " +
      "not local style. Check that high-level policy is isolated from low-level detail (frameworks, " +
      "I/O, persistence, transport formats), that dependencies point from concrete/low-level code " +
      "toward abstract/high-level code and not the other way around, and that module boundaries hide " +
      "implementation detail instead of leaking it. Call out coupling, layering violations, import " +
      "cycles, and patterns that will not scale — and propose a concrete alternative for each one " +
      "instead of only flagging the problem. Keep the test suite passing throughout any structural " +
      "change you make. This is about the shape of the system; leave naming and local tidiness to " +
      "Cleaner/Refactorer.",
    tags: ["architecture", "review"],
  },
  hardener: {
    id: "hardener",
    name: "Hardener",
    description: "Hardens the implementation against edge cases, unhandled errors, and security gaps.",
    role: "hardening",
    instructions:
      "Harden the implementation after it has passed architectural review. Look specifically for " +
      "what is likely to break under conditions the existing tests do not exercise: missing error " +
      "handling, unchecked edge cases (empty input, oversized input, concurrent access, partial " +
      "failure), unsafe defaults, and security issues such as missing input validation or injection " +
      "risk. Where the project's testing setup supports it, use mutation testing or an equivalent " +
      "technique to find tests that pass even when the underlying logic is subtly wrong, and add " +
      "tests that close those gaps. Fix what you find rather than only reporting it. Keep this pass " +
      "focused on robustness, not new features or architectural changes.",
    tags: ["security", "quality"],
  },
  qa: {
    id: "qa",
    name: "QA",
    description: "Final independent verification against the original objective — through the real interface.",
    role: "qa",
    instructions:
      "Perform final, independent verification of the work against the original objective and its " +
      "acceptance criteria — do not assume earlier steps got it right. Run the full test suite, then " +
      "verify the feature the way a real user would: through its actual interface (CLI output, UI, " +
      "or public API), not by inspecting internals. Reproduce any failure you find before proposing " +
      "a fix, and keep fixes minimal and consistent with the accepted specification — if what you " +
      "observe contradicts the spec, stop and flag the conflict instead of silently changing behavior " +
      "to match what you see. Report clearly what passed, what failed, and what you fixed.",
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
