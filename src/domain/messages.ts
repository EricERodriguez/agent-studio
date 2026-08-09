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
  | { type: "importWorkflows" };

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
    | "skipped";
  message?: string;
}

export interface WorkflowRunState {
  workflowId: string;
  mode: "chat" | "plan" | "cli-claude" | "cli-codex";
  status: "running" | "completed" | "failed";
  currentStepIndex?: number;
  steps: WorkflowRunStep[];
  startedAt: number;
  finishedAt?: number;
  planText?: string;
  error?: string;
}

export type ExtensionToWebviewMessage =
  | {
      type: "state";
      payload: {
        agents: AgentDefinition[];
        workflows: WorkflowDefinition[];
        capabilityGraph: CapabilityGraph;
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
    };
