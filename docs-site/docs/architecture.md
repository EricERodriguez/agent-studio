---
prev:
  text: Creating Agents
  link: /creating-agents
---

# Architecture

Understand how Agent Studio works under the hood.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│         VS Code Editor & Workspace                  │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│    Agent Studio Extension (TypeScript)              │
│  ┌───────────────────────────────────────────────┐  │
│  │ Extension Host (Main)                         │  │
│  │ ├─ Command Registration                       │  │
│  │ ├─ Workspace Monitoring (.agent.md discovery) │  │
│  │ ├─ Settings Management                        │  │
│  │ └─ VS Code API Integration                    │  │
│  └───────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────┐  │
│  │ Services Layer                                │  │
│  │ ├─ AgentRegistryService (discover/parse)      │  │
│  │ ├─ WorkflowService (orchestration)            │  │
│  │ ├─ CapabilityService (tools/skills/MCP)       │  │
│  │ ├─ ChatBridgeService (chat integration)       │  │
│  │ └─ AgentMarkdownService (edit agents)         │  │
│  └───────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────┐  │
│  │ Webview (React + Tailwind)                    │  │
│  │ ├─ Dashboard Application                      │  │
│  │ ├─ Agent Builder UI                           │  │
│  │ ├─ Workflow Canvas                            │  │
│  │ ├─ Capabilities Inspector                     │  │
│  │ └─ Graph Visualization (Canvas/WebGL)         │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│    External Integrations                            │
│  ├─ MCP Servers (HTTP endpoints)                    │
│  ├─ Custom Tools (node_modules, executables)        │
│  ├─ Skills Directories (.md files)                  │
│  └─ VS Code Chat API                                │
└─────────────────────────────────────────────────────┘
```

## Data Model

### Agent (.agent.md)

```typescript
interface Agent {
  name: string; // "DataAnalyst"
  emoji: string; // "📊"
  role: string; // Job title / specialty
  instructions: string; // Markdown behavior description
  capabilities: {
    tools: string[];
    skills: string[];
    mcpServers: string[];
  };
  handoffs: {
    [agentName: string]: {
      requiresApproval: boolean;
      maxRetries?: number;
      timeout?: number;
    };
  };
  metadata: {
    created: ISO8601;
    modified: ISO8601;
    tags?: string[];
  };
}
```

Stored as Markdown with structured headers:

```markdown
# Agent: DataAnalyst

One-line description.

## Identity

- Role: ...
- Focus: ...

## Instructions

Markdown content describing behavior.

## Capabilities

- Tool names
- Skill names
- MCP server names

## Handoffs

- Agent X (approval: yes/no, timeout: 60s, retries: 3)
```

### Workflow (.workflow.json)

```typescript
interface Workflow {
  name: string;
  description?: string;
  steps: WorkflowStep[];
  entryPoint: string; // agent name
  exitPoint: string; // agent name
  trigger: "manual" | "webhook" | "schedule";
  metadata: { created: ISO8601; modified: ISO8601 };
}

interface WorkflowStep {
  id: string;
  agentName: string;
  position: { x: number; y: number };
  inputs?: Record<string, string>; // from previous step
  constraints?: {
    timeout?: number;
    retries?: number;
  };
}
```

### Tool Registry

```typescript
interface Tool {
  name: string;
  description: string;
  category: string; // "api", "database", "transform", etc.
  endpoint?: string; // HTTP URL or file path
  parameters?: Record<string, unknown>;
  metadata: { created: ISO8601; usage: number };
}
```

## Extension Components

### AgentRegistryService

**Purpose**: Discover, parse, and cache `.agent.md` files.

**Operations:**

- Scan workspace for `*.agent.md` files
- Parse markdown with custom front-matter parsing
- Build in-memory registry
- Listen to file changes and refresh

**Cache strategy:**

- Lazy load agents on first access
- Invalidate on file change
- Debounce rapid changes

### WorkflowService

**Purpose**: Parse, validate, and execute workflows.

**Operations:**

- Read `.workflow.json` files
- Validate step relationships
- Build execution graph
- Trigger VS Code chat integration for execution

**Execution:**

- Sequential agent execution
- Pass output of step N as input to step N+1
- Error handling and retry logic

### CapabilityService

**Purpose**: Discover tools, skills, and MCP servers; manage relationships.

**Operations:**

- Scan tool directories
- Index available tools
- Connect to MCP servers
- Track agent ↔ capability relationships

**Gap detection:**

- Orphaned tools (no agents use them)
- Over-assigned tools (too many agents depend on them)
- Missing capabilities (agent requests tool not available)

### ChatBridgeService

**Purpose**: Integrate with VS Code chat API.

**Operations:**

- When user selects agent in chat, prepare context
- Gather agent identity + instructions + capabilities
- Send to LLM as system context
- Handle handoff requests from chat

## Webview Architecture

Built with **React + Tailwind + TypeScript**.

### Component Tree

```
App.tsx
├── Dashboard Page
│   ├── Agent Builder
│   │   ├── Identity Editor
│   │   ├── Instructions Editor
│   │   ├── Capabilities Picker
│   │   └── Handoffs Manager
│   ├── Workflow Builder
│   │   ├── Canvas
│   │   ├── Agent Step Cards
│   │   └── Connection Editor
│   ├── Capabilities Inspector
│   │   ├── Tools List
│   │   ├── Skills List
│   │   └── MCP Registry
│   └── Dashboard Overview
│       ├── Quick Stats
│       ├── Recent Activity
│       └── Quick Actions
└── Graph Canvas
    ├── WebGL Rendering
    └── Interactive Controls
```

### State Management (Zustand)

```typescript
interface StudioStore {
  // Agents
  agents: Agent[];
  activeAgent: Agent | null;
  selectedAgent: string | null;

  // Workflows
  workflows: Workflow[];
  activeWorkflow: Workflow | null;

  // UI
  currentTab: "agents" | "workflows" | "capabilities";
  sidebarOpen: boolean;
  darkMode: boolean;

  // Async operations
  isLoading: boolean;
  error: string | null;
}
```

### Communication: Webview ↔ Extension

**Message protocol** (VS Code Webview API):

```typescript
// Webview → Extension
postMessage({
  type: 'agent:create',
  payload: { name: 'NewAgent', role: '...' }
})

// Extension → Webview
messageEvent -> {
  type: 'agent:created',
  payload: { agent: {...} }
}
```

Common messages:

- `agent:create`, `agent:update`, `agent:delete`
- `workflow:create`, `workflow:run`
- `capabilities:refresh`
- `chat:openAgent`

## Configuration Flow

1. **On Activation**: Extension reads VS Code settings
   - `agentStudio.agentDirectories`
   - `agentStudio.toolDirectories`
   - `agentStudio.skillDirectories`
   - `agentStudio.mcpServers`

2. **Registry Building**: Scan configured directories
   - Index all `.agent.md` files
   - Load tool registrations
   - Attempt MCP server connections

3. **Webview Initialization**: Send initial state to React app
   - Agent list
   - Tools and skills
   - MCP servers status

## Performance Optimizations

### Agent Discovery

- Lazy load: Don't parse files until needed
- Cache: Reuse parsed agents between requests
- Debounce: Wait 500ms after file change before re-parsing (batches rapid edits)

### Graph Rendering

- Canvas-based (not DOM): WebGL for 200+ agents
- Virtualization: Only render visible nodes
- Incremental: Update only changed relationships

### State Sync

- Debounced writes: Batch UI changes before persisting
- Selective sync: Only send changed fields to extension
- Optimistic updates: Show changes in UI immediately

---

**[← Creating Agents](./creating-agents.md)** | **[Contributing →](./contributing.md)**
