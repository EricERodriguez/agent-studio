export type ToolKind = "built-in" | "extension" | "mcp";
export type AgentScope = "repository" | "global";
export type AgentProvider = "claude" | "codex" | "antigravity";

export interface ToolRef {
  id: string;
  label: string;
  kind: ToolKind;
  description?: string;
}

export interface SkillRef {
  id: string;
  label: string;
  description?: string;
}

export interface MCPServerRef {
  id: string;
  label: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  autoRunMCP?: boolean;
}

export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  role?: string;
  instructions: string;
  context?: string;
  handoffs: Array<{
    agent: string;
    label?: string;
    prompt?: string;
    send?: boolean;
  }>;
  tags: string[];
  capabilities: {
    tools: ToolRef[];
    skills: SkillRef[];
    mcpServers: MCPServerRef[];
  };
  sourcePath?: string;
  sourceScope?: AgentScope;
  providers?: AgentProvider[];
  shadowedAgent?: {
    sourcePath: string;
    sourceScope: AgentScope;
  };
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  nodes: Array<{
    id: string;
    agentId: string;
    position: { x: number; y: number };
    isEntry?: boolean;
  }>;
  edges: Array<{ id: string; source: string; target: string; label?: string }>;
  sourcePath?: string;
  sourceScope?: AgentScope;
  shadowedWorkflow?: {
    sourcePath: string;
    sourceScope: AgentScope;
  };
}

export interface CapabilityGraph {
  tools: ToolRef[];
  skills: SkillRef[];
  mcpServers: MCPServerRef[];
  usage: {
    tools: Record<string, string[]>;
    skills: Record<string, string[]>;
    mcpServers: Record<string, string[]>;
  };
}

export type BuilderTab =
  | "Identity"
  | "Instructions"
  | "Context"
  | "Handoffs"
  | "Capabilities"
  | "Source Preview";

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
        tab?: BuilderTab;
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
