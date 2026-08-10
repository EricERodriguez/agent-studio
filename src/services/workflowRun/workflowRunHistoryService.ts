import * as fs from "fs/promises";
import * as path from "path";
import type { WorkflowDefinition } from "../../domain/models";
import type { WorkflowRunState, WorkflowRunStep } from "../../domain/messages";

/**
 * Durable, inspection-only history for CLI workflow runs.
 *
 * This service deliberately persists state, never a live process contract. In particular it does
 * not record PIDs or app-server connection details, and recovery never calls a CLI or creates a
 * terminal. See docs/swarmforge-integration/06-estado-recuperacion.md.
 */
const MANIFEST_VERSION = 1;

export interface WorkflowRunManifest {
  version: typeof MANIFEST_VERSION;
  runId: string;
  workflowId: string;
  workflowName: string;
  workflowSnapshot: Pick<
    WorkflowDefinition,
    "id" | "name" | "description" | "nodes" | "edges"
  >;
  objective: string;
  state: WorkflowRunState;
}

export interface WorkflowRunRecoveryResult {
  runs: WorkflowRunState[];
  warnings: string[];
}

const runStatuses = new Set<WorkflowRunState["status"]>([
  "running",
  "completed",
  "failed",
  "interrupted",
]);
const stepStatuses = new Set<WorkflowRunStep["status"]>([
  "pending",
  "queued",
  "running",
  "waiting_approval",
  "completed",
  "failed",
  "skipped",
  "interrupted",
]);
const modes = new Set<WorkflowRunState["mode"]>([
  "chat",
  "plan",
  "cli-claude",
  "cli-codex",
]);

function snapshotWorkflow(
  workflow: WorkflowDefinition,
): WorkflowRunManifest["workflowSnapshot"] {
  const { id, name, description, nodes, edges } = workflow;
  return { id, name, description, nodes, edges };
}

function isWorkflowRunState(value: unknown): value is WorkflowRunState {
  if (!value || typeof value !== "object") {
    return false;
  }
  const state = value as Partial<WorkflowRunState>;
  return (
    typeof state.workflowId === "string" &&
    modes.has(state.mode as WorkflowRunState["mode"]) &&
    runStatuses.has(state.status as WorkflowRunState["status"]) &&
    Array.isArray(state.steps) &&
    state.steps.every(
      (step) =>
        step &&
        typeof step.nodeId === "string" &&
        typeof step.agentId === "string" &&
        typeof step.agentName === "string" &&
        stepStatuses.has(step.status),
    ) &&
    typeof state.startedAt === "number" &&
    typeof state.runId === "string"
  );
}

function parseManifest(value: unknown): WorkflowRunManifest | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const manifest = value as Partial<WorkflowRunManifest>;
  if (
    manifest.version !== MANIFEST_VERSION ||
    typeof manifest.runId !== "string" ||
    typeof manifest.workflowId !== "string" ||
    typeof manifest.workflowName !== "string" ||
    typeof manifest.objective !== "string" ||
    !manifest.workflowSnapshot ||
    !isWorkflowRunState(manifest.state)
  ) {
    return undefined;
  }
  return manifest as WorkflowRunManifest;
}

function recoveredState(state: WorkflowRunState): WorkflowRunState | undefined {
  const hasActiveStep = state.steps.some(
    (step) =>
      step.status === "queued" ||
      step.status === "running" ||
      step.status === "waiting_approval",
  );
  if (state.status !== "running" && !hasActiveStep) {
    return undefined;
  }

  return {
    ...state,
    status: "interrupted",
    finishedAt: Date.now(),
    error: "Workflow interrupted when VS Code closed.",
    steps: state.steps.map((step) => {
      if (
        step.status === "queued" ||
        step.status === "running" ||
        step.status === "waiting_approval"
      ) {
        return {
          ...step,
          status: "interrupted",
          message: "Interrupted when VS Code closed.",
        };
      }
      if (step.status === "pending") {
        return {
          ...step,
          status: "skipped",
          message: "Skipped because the workflow was interrupted when VS Code closed.",
        };
      }
      return step;
    }),
  };
}

export class WorkflowRunHistoryService {
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly runsDirectory: string) {}

  private manifestPath(runId: string): string {
    return path.join(this.runsDirectory, runId, "manifest.json");
  }

  async persist(
    state: WorkflowRunState,
    workflow: WorkflowDefinition,
    objective: string,
  ): Promise<void> {
    if (!state.runId) {
      throw new Error("Cannot persist a workflow run without a runId.");
    }
    const manifest: WorkflowRunManifest = {
      version: MANIFEST_VERSION,
      runId: state.runId,
      workflowId: workflow.id,
      workflowName: workflow.name,
      workflowSnapshot: snapshotWorkflow(workflow),
      objective,
      state,
    };
    await this.enqueueWrite(() => this.writeManifest(manifest));
  }

  async recover(): Promise<WorkflowRunRecoveryResult> {
    let entries: import("fs").Dirent[];
    try {
      entries = await fs.readdir(this.runsDirectory, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return { runs: [], warnings: [] };
      }
      return {
        runs: [],
        warnings: [`Could not read saved workflow runs: ${this.messageFor(error)}`],
      };
    }

    const runs: WorkflowRunState[] = [];
    const warnings: string[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const manifestPath = this.manifestPath(entry.name);
      let manifest: WorkflowRunManifest | undefined;
      try {
        manifest = parseManifest(JSON.parse(await fs.readFile(manifestPath, "utf8")));
      } catch {
        // Treated below just like an invalid shape. Do not expose raw contents from a corrupt file.
      }
      if (!manifest) {
        warnings.push(`Ignored invalid workflow-run manifest: ${manifestPath}`);
        continue;
      }

      const interrupted = recoveredState(manifest.state);
      if (interrupted) {
        const interruptedManifest: WorkflowRunManifest = {
          ...manifest,
          state: interrupted,
        };
        manifest = interruptedManifest;
        try {
          await this.enqueueWrite(() => this.writeManifest(interruptedManifest));
        } catch (error) {
          warnings.push(
            `Could not mark recovered run ${manifest.runId} as interrupted: ${this.messageFor(error)}`,
          );
        }
      }
      runs.push({ ...manifest.state, recovered: true });
    }

    runs.sort((a, b) => b.startedAt - a.startedAt);
    return { runs, warnings };
  }

  private async writeManifest(manifest: WorkflowRunManifest): Promise<void> {
    const manifestPath = this.manifestPath(manifest.runId);
    const directory = path.dirname(manifestPath);
    await fs.mkdir(directory, { recursive: true });
    const temporaryPath = path.join(
      directory,
      `.manifest-${process.pid}-${Date.now()}.tmp`,
    );
    try {
      await fs.writeFile(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
      await fs.rename(temporaryPath, manifestPath);
    } finally {
      await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
    }
  }

  private enqueueWrite(write: () => Promise<void>): Promise<void> {
    const queued = this.writeQueue.then(write, write);
    this.writeQueue = queued.catch(() => undefined);
    return queued;
  }

  private messageFor(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
