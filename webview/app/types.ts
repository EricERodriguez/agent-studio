export type ToolKind = "built-in" | "extension" | "mcp";

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
}

export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  role?: string;
  instructions: string;
  context?: string;
  handoffs: string[];
  tags: string[];
  capabilities: {
    tools: ToolRef[];
    skills: SkillRef[];
    mcpServers: MCPServerRef[];
  };
  sourcePath?: string;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  nodes: Array<{ id: string; agentId: string; position: { x: number; y: number }; isEntry?: boolean }>;
  edges: Array<{ id: string; source: string; target: string; label?: string }>;
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

export type BuilderTab = "Identity" | "Instructions" | "Context" | "Handoffs" | "Capabilities" | "Source Preview";

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
