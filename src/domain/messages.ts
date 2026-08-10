import type {
  AgentDefinition,
  AgentProvider,
  CapabilityGraph,
  WorkflowDefinition,
} from "./models";

export type WebviewToExtensionMessage =
  | { type: "ready" }
  | { type: "refresh" }
  | { type: "saveAgent"; payload: AgentDefinition }
  | { type: "deleteAgent"; payload: { agentId: string } }
  | { type: "openRawAgent"; payload: { agentId: string } }
  | { type: "openInChat"; payload: { agentId: string } }
  | { type: "saveWorkflow"; payload: WorkflowDefinition }
  | { type: "deleteWorkflow"; payload: { workflowId: string } }
  | { type: "renameWorkflow"; payload: { workflowId: string } }
  | { type: "openRawWorkflow"; payload: { workflowId: string } }
  | {
      type: "runWorkflow";
      payload: {
        workflowId: string;
        mode: "chat" | "plan" | "cli-claude" | "cli-codex";
      };
    }
  | { type: "createAgent" }
  | { type: "editAgent"; payload: { agentId: string } }
  | {
      type: "exportAgent";
      payload: { agentId: string; providers: AgentProvider[] };
    }
  | { type: "exportAllAgents" }
  | { type: "createRepoStructure" }
  | { type: "importAgents" }
  | { type: "createWorkflow" }
  | { type: "exportAllWorkflows" }
  | { type: "importWorkflows" }
  | {
      type: "approvalResponse";
      payload: {
        requestId: string;
        decision: "approve" | "reject";
        instructions?: string;
      };
    }
  | { type: "cancelWorkflow"; payload: { runId: string } }
  | {
      type: "objectiveResponse";
      payload: { requestId: string; objective?: string };
    }
  | {
      type: "preflightWarningResponse";
      payload: { requestId: string; continue: boolean };
    };

/** Asks the user, via a rich webview panel instead of vscode.window.showInputBox (too cramped
 * for a real task description — a real user hit this), what a CLI-mode run should do. */
export interface WorkflowObjectiveRequest {
  requestId: string;
  workflowName: string;
}

/** A non-blocking dashboard replacement for VS Code's native preflight modal. */
export interface WorkflowPreflightWarningRequest {
  requestId: string;
  workflowName: string;
  warnings: string[];
}

/** A workflow node is paused waiting for the user to approve or reject the handoff into it. */
export interface WorkflowApprovalRequest {
  requestId: string;
  workflowId: string;
  nodeId: string;
  agentName: string;
  /** Full, untruncated output of the predecessor(s) that led to this handoff. */
  context: string;
}

export interface WorkflowRunStep {
  nodeId: string;
  agentId: string;
  agentName: string;
  status:
    | "pending"
    | "queued"
    | "running"
    | "waiting_approval"
    | "completed"
    | "failed"
    | "skipped"
    /** The Extension Host stopped while this step had been dispatched. It is preserved only for
     * inspection; it is never automatically retried or reattached to a process. */
    | "interrupted";
  message?: string;
  /** Final provider output when it is available. Persisted with CLI runs for later inspection. */
  output?: string;
  /** Files intentionally written by the runner for this step; never process/PID handles. */
  evidence?: {
    promptFilePath?: string;
    markerFilePath?: string;
  };
}

export interface WorkflowRunState {
  workflowId: string;
  mode: "chat" | "plan" | "cli-claude" | "cli-codex";
  status: "running" | "completed" | "failed" | "interrupted";
  currentStepIndex?: number;
  steps: WorkflowRunStep[];
  startedAt: number;
  finishedAt?: number;
  /** CLI objective retained with a durable run so the recovered state is understandable. */
  objective?: string;
  planText?: string;
  error?: string;
  /** Set for CLI-mode runs — lets the UI send a `cancelWorkflow` message back for this run. */
  runId?: string;
  /** Present for a recovered CLI run. It is evidence only, never a resume token. */
  recovered?: boolean;
}

export type ExtensionToWebviewMessage =
  | {
      type: "state";
      payload: {
        agents: AgentDefinition[];
        workflows: WorkflowDefinition[];
        capabilityGraph: CapabilityGraph;
        /** Durable CLI runs recovered for inspection, plus current CLI runs while this host lives. */
        workflowRuns: WorkflowRunState[];
      };
    }
  | {
      type: "info";
      payload: { message: string };
    }
  | {
      type: "error";
      payload: { message: string };
    }
  | {
      type: "workflowRunUpdate";
      payload: WorkflowRunState;
    }
  | {
      type: "focusAgentEditor";
      payload: {
        agentId: string;
        tab?:
          | "Identity"
          | "Instructions"
          | "Context"
          | "Handoffs"
          | "Capabilities"
          | "Source Preview";
      };
    }
  | {
      type: "focusCapability";
      payload: {
        kind: "tool" | "skill" | "mcp";
        id: string;
      };
    }
  | {
      type: "focusWorkflow";
      payload: {
        workflowId: string;
      };
    }
  | {
      type: "approvalRequest";
      payload: WorkflowApprovalRequest;
    }
  | {
      type: "objectiveRequest";
      payload: WorkflowObjectiveRequest;
    }
  | {
      type: "preflightWarningRequest";
      payload: WorkflowPreflightWarningRequest;
    };
