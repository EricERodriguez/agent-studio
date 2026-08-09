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

export type HandoffMode = "automatic" | "human";

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  /** How the target node's turn gets dispatched once the source node completes.
   * Missing/undefined means "automatic" (today's default behavior). "human" pauses the target
   * node until the user approves from a prompt — see src/services/workflowRun/workflowRunManager.ts.
   * There is deliberately no "ai-review" mode: an AI reviewer is modeled as a regular node in the
   * graph (an edge into it, edges out of it), not as special engine logic that trusts a
   * structured decision an agent produces — see docs/swarmforge-integration/03-arquitectura-handoff-control.md. */
  handoff?: {
    mode: HandoffMode;
  };
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
