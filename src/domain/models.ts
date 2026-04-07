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

export interface AgentCapabilities {
  tools: ToolRef[];
  skills: SkillRef[];
  mcpServers: MCPServerRef[];
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
  capabilities: AgentCapabilities;
  sourcePath?: string;
}

export interface WorkflowNode {
  id: string;
  agentId: string;
  position: {
    x: number;
    y: number;
  };
  isEntry?: boolean;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
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
