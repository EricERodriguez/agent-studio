import type { AgentDefinition, WorkflowDefinition } from "../../domain/models";
import type { WorkflowRunStep } from "../../domain/messages";
import type { ChatBridgeService } from "../chatBridgeService";
import { WorkflowTerminalService } from "./workflowTerminalService";
import { runAgentTurn } from "./interactiveTurnRunner";
import { CodexAppServerService } from "./codexAppServerRunner";
import { resolveInteractionLanguage } from "../interactionLanguageService";

/**
 * Runs a workflow's reachable nodes as a real dependency graph, not a single linear DFS order in
 * one shared terminal: each node gets its own vscode.Terminal (via WorkflowTerminalService) and
 * dispatches as soon as its predecessors complete, so independent branches run in parallel.
 *
 * HandoffMode gating: an edge's `handoff.mode` (see src/domain/models.ts) controls the *target*
 * node's dispatch. `"automatic"` (or no `handoff` at all, for backward compatibility with
 * existing workflows) dispatches immediately once predecessors complete. `"human"` pauses the
 * node in `"waiting_approval"` and calls the injected `requestApproval` callback — the caller
 * (extension.ts) implements that by posting an `approvalRequest` message to the Agent Studio
 * webview and resolving once the user answers there, so the full predecessor output is reviewable
 * in a real scrollable panel instead of a truncated native `vscode.window.showWarningMessage`
 * modal (that was the first cut here and a real user tried it — the modal cut off content and
 * gave no way to attach instructions). There is no `"ai-review"` mode here by design: an AI
 * reviewer is just a regular node in the graph, not special engine logic that trusts a structured
 * decision an agent produced. See docs/swarmforge-integration/03-arquitectura-handoff-control.md.
 *
 * On any node failure (or a rejected human approval), no *new* nodes are dispatched afterwards,
 * but nodes already in flight are left to finish naturally rather than being torn down mid-turn.
 *
 * Turn execution is per-provider: `claude` uses `runAgentTurn` from `./interactiveTurnRunner` — a
 * real interactive CLI session per node (like SwarmForge's attached sessions), so the user can
 * give it feedback mid-task by typing into its terminal. `codex` uses
 * `CodexAppServerService`/`./codexAppServerRunner` instead — real testing (2026-08-09) showed the
 * terminal+sendText approach could not be made reliable for Codex specifically (confirmed by
 * Codex itself: no "ready for input" signal exists for its TUI), so Codex nodes talk to `codex
 * app-server` over JSON-RPC/stdio instead of a visible terminal — no terminal is created for
 * them. `turn/steer` (mid-task human feedback for Codex, the equivalent of typing into Claude's
 * terminal) is not wired up yet — see docs/swarmforge-integration/PROGRESS.md.
 */

export interface ApprovalRequestInput {
  nodeId: string;
  agentName: string;
  context: string;
}

export interface ApprovalDecision {
  decision: "approve" | "reject";
  instructions?: string;
}

export interface RunWorkflowGraphParams {
  workflow: WorkflowDefinition;
  agents: AgentDefinition[];
  cliCommand: string;
  objective: string;
  runDir: string;
  cwd: string;
  chatBridgeService: ChatBridgeService;
  onUpdate: (steps: WorkflowRunStep[]) => void;
  requestApproval: (request: ApprovalRequestInput) => Promise<ApprovalDecision>;
  /** Polled between dispatch cycles and while a turn is running; once true, no new nodes are
   * dispatched and in-flight turns stop waiting for their marker file — used by the Stop button. */
  shouldCancel: () => boolean;
}

export interface RunWorkflowGraphResult {
  status: "completed" | "failed";
  error?: string;
}

interface NodeRuntime {
  nodeId: string;
  agentId: string;
  agentName: string;
  status: WorkflowRunStep["status"];
  message?: string;
  output?: string;
}

function computeReachableOrder(
  workflow: WorkflowDefinition,
  entryId: string,
): string[] {
  const nodeIds = new Set(workflow.nodes.map((node) => node.id));
  const order: string[] = [];
  const visited = new Set<string>();
  const queue = [entryId];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId) || !nodeIds.has(nodeId)) {
      continue;
    }
    visited.add(nodeId);
    order.push(nodeId);
    for (const edge of workflow.edges) {
      if (edge.source === nodeId) {
        queue.push(edge.target);
      }
    }
  }
  return order;
}

function joinPredecessorOutput(
  preds: WorkflowDefinition["edges"],
  runtime: Map<string, NodeRuntime>,
): string | undefined {
  const combined = preds
    .map((edge) => runtime.get(edge.source)?.output)
    .filter((text): text is string => Boolean(text && text.trim()))
    .join("\n\n---\n\n");
  return combined.trim() ? combined : undefined;
}

export async function runWorkflowGraph(
  params: RunWorkflowGraphParams,
): Promise<RunWorkflowGraphResult> {
  const {
    workflow,
    agents,
    cliCommand,
    objective,
    runDir,
    cwd,
    chatBridgeService,
    onUpdate,
    requestApproval,
    shouldCancel,
  } = params;

  const nodeById = new Map(workflow.nodes.map((node) => [node.id, node]));
  const entry = workflow.nodes.find((node) => node.isEntry);
  if (!entry) {
    return { status: "failed", error: "Workflow has no entry node." };
  }

  const order = computeReachableOrder(workflow, entry.id);
  if (order.length === 0) {
    return { status: "failed", error: "Workflow has no reachable steps from entry node." };
  }

  const predecessorsOf = (nodeId: string) =>
    workflow.edges.filter((edge) => edge.target === nodeId && order.includes(edge.source));

  const runtime = new Map<string, NodeRuntime>();
  for (const nodeId of order) {
    const node = nodeById.get(nodeId)!;
    const agent = agents.find((candidate) => candidate.id === node.agentId);
    runtime.set(nodeId, {
      nodeId,
      agentId: node.agentId,
      agentName: agent?.name ?? node.agentId,
      status: "pending",
    });
  }

  const publish = (): void => {
    onUpdate(
      order.map((nodeId) => {
        const node = runtime.get(nodeId)!;
        return {
          nodeId: node.nodeId,
          agentId: node.agentId,
          agentName: node.agentName,
          status: node.status,
          message: node.message,
        };
      }),
    );
  };
  publish();

  const terminals = new WorkflowTerminalService();
  const codexSessions = new CodexAppServerService();
  const inFlight = new Map<string, Promise<void>>();
  let aborted = false;
  let abortError: string | undefined;

  const markSkippedIfStuck = (): void => {
    for (const nodeId of order) {
      const node = runtime.get(nodeId)!;
      if (node.status !== "pending") {
        continue;
      }
      const preds = predecessorsOf(nodeId);
      const hasDeadPredecessor = preds.some((edge) => {
        const status = runtime.get(edge.source)!.status;
        return status === "failed" || status === "skipped";
      });
      if (hasDeadPredecessor) {
        node.status = "skipped";
        node.message = "Skipped — a predecessor did not complete";
      }
    }
  };

  const computeReady = (): string[] => {
    if (aborted || shouldCancel()) {
      return [];
    }
    return order.filter((nodeId) => {
      const node = runtime.get(nodeId)!;
      if (node.status !== "pending") {
        return false;
      }
      const preds = predecessorsOf(nodeId);
      return preds.every((edge) => runtime.get(edge.source)!.status === "completed");
    });
  };

  const runNode = async (nodeId: string): Promise<void> => {
    const node = runtime.get(nodeId)!;
    const agent = agents.find((candidate) => candidate.id === node.agentId);

    if (!agent) {
      node.status = "failed";
      node.message = "Agent not found";
      aborted = true;
      abortError = `Missing agent: ${node.agentId}`;
      publish();
      return;
    }

    const preds = predecessorsOf(nodeId);
    const requiresApproval = preds.some((edge) => edge.handoff?.mode === "human");
    let approvalInstructions: string | undefined;

    if (requiresApproval) {
      node.status = "waiting_approval";
      publish();
      const context = joinPredecessorOutput(preds, runtime) ?? "";
      const approval = await requestApproval({
        nodeId,
        agentName: node.agentName,
        context,
      });
      if (approval.decision !== "approve") {
        node.status = "failed";
        node.message = "Handoff rejected by user";
        aborted = true;
        abortError = `Step "${node.agentName}" was rejected.`;
        publish();
        return;
      }
      approvalInstructions = approval.instructions?.trim() || undefined;
    }

    node.status = "running";
    node.message =
      cliCommand === "codex" ? "Working via codex app-server" : `Working in ${cliCommand} CLI`;
    publish();

    const predecessorOutput = joinPredecessorOutput(preds, runtime);
    const contextForPrompt = approvalInstructions
      ? [
          predecessorOutput,
          `[Instrucciones del usuario al aprobar este handoff]:\n${approvalInstructions}`,
        ]
          .filter(Boolean)
          .join("\n\n---\n\n")
      : predecessorOutput;
    const prompt = chatBridgeService.buildTurnPrompt(
      agent,
      objective,
      contextForPrompt,
      resolveInteractionLanguage(nodeById.get(nodeId)?.languageOverride),
    );

    const turn =
      cliCommand === "codex"
        ? await codexSessions.runTurn(nodeId, cwd, prompt, 10 * 60 * 1000, shouldCancel)
        : await runAgentTurn({
            terminal: terminals.getOrCreateTerminal(
              nodeId,
              `Agent Studio: ${workflow.name} · ${node.agentName} (${cliCommand})`,
              cwd,
            ),
            executable: cliCommand,
            prompt,
            runDir,
            stepId: nodeId,
            shouldCancel,
          });

    if (!turn.success) {
      node.status = "failed";
      node.message = turn.cancelled
        ? "Cancelled by user"
        : turn.timedOut
          ? `${cliCommand} did not signal completion within the timeout`
          : `${cliCommand} failed${turn.output ? `: ${turn.output}` : ""}`;
      aborted = true;
      abortError = turn.cancelled
        ? "Workflow cancelled by user."
        : `Step "${node.agentName}" failed: ${node.message}`;
      publish();
      return;
    }

    node.status = "completed";
    node.message = `${cliCommand} signaled completion`;
    node.output = turn.output;
    publish();
  };

  while (true) {
    markSkippedIfStuck();
    const ready = computeReady();
    for (const nodeId of ready) {
      runtime.get(nodeId)!.status = "queued";
    }
    if (ready.length > 0) {
      publish();
      for (const nodeId of ready) {
        const task = runNode(nodeId);
        inFlight.set(nodeId, task.finally(() => inFlight.delete(nodeId)));
      }
    }

    if (inFlight.size === 0) {
      break;
    }
    await Promise.race([...inFlight.values()]);
  }

  markSkippedIfStuck();
  publish();
  codexSessions.disposeAll();

  const anyFailed = order.some((nodeId) => runtime.get(nodeId)!.status === "failed");
  return anyFailed
    ? { status: "failed", error: abortError ?? "Workflow failed." }
    : { status: "completed" };
}
