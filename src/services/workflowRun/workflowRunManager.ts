import * as vscode from "vscode";
import type { AgentDefinition, WorkflowDefinition } from "../../domain/models";
import type { WorkflowRunStep } from "../../domain/messages";
import type { ChatBridgeService } from "../chatBridgeService";
import { WorkflowTerminalService } from "./workflowTerminalService";
import { runAgentTurn } from "./oneShotTurnRunner";

/**
 * Runs a workflow's reachable nodes as a real dependency graph, not a single linear DFS order in
 * one shared terminal: each node gets its own vscode.Terminal (via WorkflowTerminalService) and
 * dispatches as soon as its predecessors complete, so independent branches run in parallel.
 *
 * HandoffMode gating: an edge's `handoff.mode` (see src/domain/models.ts) controls the *target*
 * node's dispatch. `"automatic"` (or no `handoff` at all, for backward compatibility with
 * existing workflows) dispatches immediately once predecessors complete. `"human"` pauses the
 * node in `"waiting_approval"` and shows a modal approval prompt — there is no `"ai-review"` mode
 * here by design: an AI reviewer is just a regular node in the graph, not special engine logic
 * that trusts a structured decision an agent produced. See
 * docs/swarmforge-integration/03-arquitectura-handoff-control.md.
 *
 * On any node failure (or a rejected human approval), no *new* nodes are dispatched afterwards,
 * but nodes already in flight are left to finish naturally rather than being torn down mid-turn.
 */

export interface RunWorkflowGraphParams {
  workflow: WorkflowDefinition;
  agents: AgentDefinition[];
  cliCommand: string;
  objective: string;
  runDir: string;
  cwd: string;
  chatBridgeService: ChatBridgeService;
  onUpdate: (steps: WorkflowRunStep[]) => void;
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
  const { workflow, agents, cliCommand, objective, runDir, cwd, chatBridgeService, onUpdate } =
    params;

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
    if (aborted) {
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

    if (requiresApproval) {
      node.status = "waiting_approval";
      publish();
      const predecessorOutput = joinPredecessorOutput(preds, runtime) ?? "";
      const preview = predecessorOutput.slice(0, 500);
      const suffix = predecessorOutput.length > 500 ? "\n…" : "";
      const choice = await vscode.window.showWarningMessage(
        `Approve handoff to "${node.agentName}"?\n\n${preview}${suffix}`,
        { modal: true },
        "Approve",
        "Reject",
      );
      if (choice !== "Approve") {
        node.status = "failed";
        node.message = "Handoff rejected by user";
        aborted = true;
        abortError = `Step "${node.agentName}" was rejected.`;
        publish();
        return;
      }
    }

    node.status = "running";
    node.message = `Sending to ${cliCommand} CLI`;
    publish();

    const terminalName = `Agent Studio: ${workflow.name} · ${node.agentName} (${cliCommand})`;
    const terminal = terminals.getOrCreateTerminal(nodeId, terminalName, cwd);

    const turn = await runAgentTurn({
      terminal,
      executable: cliCommand,
      prompt: chatBridgeService.buildTurnPrompt(agent, objective, joinPredecessorOutput(preds, runtime)),
      runDir,
      stepId: nodeId,
    });

    if (!turn.success) {
      node.status = "failed";
      node.message = turn.timedOut
        ? `${cliCommand} CLI did not report completion in time`
        : `${cliCommand} CLI exited with code ${turn.exitCode}`;
      aborted = true;
      abortError = `Step "${node.agentName}" failed: ${node.message}`;
      publish();
      return;
    }

    node.status = "completed";
    node.message = `${cliCommand} CLI exited 0`;
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

  const anyFailed = order.some((nodeId) => runtime.get(nodeId)!.status === "failed");
  return anyFailed
    ? { status: "failed", error: abortError ?? "Workflow failed." }
    : { status: "completed" };
}
