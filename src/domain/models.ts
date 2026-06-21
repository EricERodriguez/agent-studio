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
  handoffs: Array<{
    agent: string;
    label?: string;
    prompt?: string;
    send?: boolean;
  }>;
  tags: string[];
  capabilities: AgentCapabilities;
  sourcePath?: string;
  sourceScope?: AgentScope;
  /** AI providers this agent has been exported for (e.g. Claude, Codex, Antigravity). */
  providers?: AgentProvider[];
  /**
   * Set when another agent file with the same id was discovered and shadowed
   * by this one (e.g. a repository agent overriding a global agent).
   */
  shadowedAgent?: {
    sourcePath: string;
    sourceScope: AgentScope;
  };
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
