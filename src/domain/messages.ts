import type {
  AgentDefinition,
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
  | { type: "createAgent" }
  | { type: "editAgent"; payload: { agentId: string } };

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
    };
