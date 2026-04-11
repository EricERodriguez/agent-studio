---
prev:
  text: Quick Start
  link: /quick-start
next:
  text: Creating Agents
  link: /creating-agents
---

# Core Concepts

Agent Studio is built on a few core ideas. Understanding these makes everything else intuitive.

## Agents

An **agent** is a specialized entity that performs tasks within constraints you define.

**Key properties:**

- **Identity**: Name, emoji, role, background
- **Instructions**: How the agent should behave (markdown)
- **Capabilities**: Which tools, skills, and MCP servers it can access
- **Handoffs**: Which other agents it can delegate to

**Agents are:**

- Stored as `.agent.md` files (human-readable, version-controlled)
- Discoverable by Agent Studio automatically
- Shareable with your team via git
- Composable with other agents through handoffs

**Examples:**

- `DataAnalyst`: Specializes in SQL, statistics, and visualizations
- `APIClient`: Handles REST APIs and data fetching
- `ReportWriter`: Creates formatted documents and summaries

## Workflows

A **workflow** is a sequence of agents executing tasks in order, passing results from one to the next.

**Key properties:**

- **Steps**: List of agents in execution order
- **Entry point**: Where the workflow starts receiving input
- **Exit point**: Where final results are collected
- **Trigger**: Manual, webhook, or scheduled (future)

**Workflows are:**

- Visual (drag-and-drop on a canvas)
- Executable from VS Code chat
- Version-controlled as `.json` files
- Testable and debuggable

**Example workflow:**

```
[User Input]
  ↓
[DataFetcher Agent] → retrieves data from API
  ↓ (output: raw data)
[DataCleaner Agent] → validates and transforms
  ↓ (output: clean dataset)
[Analyst Agent] → generates insights
  ↓ (output: report)
[ReportFormatter Agent] → beautifies for presentation
  ↓
[Final Report]
```

## Tools

A **tool** is a discrete, reusable function that agents can call.

**Examples:**

- `fetch_http`: Call an API endpoint
- `query_sql`: Execute a SQL query against a database
- `read_file`: Open and read a file from disk
- `send_email`: Send an email message
- `parse_json`: Parse JSON strings into structured data

**Tools are:**

- Registered in a directory your workspace points to
- Reusable across multiple agents
- Discovered and managed through the Capabilities Inspector
- Implemented in any language (JavaScript, Python, Go, etc.)

**Key rule**: Agents don't implement tools; they request tools they've been assigned.

## Skills

A **skill** is a collection of related instructions, templates, or knowledge an agent inherits.

**Examples:**

- `CompanyDataModel`: Documentation of your company's database schema and query patterns
- `BestPractices`: Style guidelines, error handling patterns, security rules
- `EmailTemplates`: Reusable email formats and structures

**Skills are:**

- Stored as `.md` files in a `.skills` directory
- Assigned to agents to give them context
- Shared across multiple agents
- Version-controlled like regular code

**How they work**: When you assign a Skill to an agent, its contents are automatically included in the agent's context when it runs.

## MCP Servers

An **MCP Server** (Model Context Protocol) is an external service providing resources, tools, or prompts to agents.

**Examples:**

- An API server exposing database queries as MCP resources
- A document service providing knowledge base access
- A custom business logic service with specialized tools

**MCP Servers are:**

- Connected via HTTP endpoints
- Auto-discovered and managed through the Capabilities Inspector
- Assignable to specific agents or shared globally
- Real-time (health checks, latency monitoring)

**Key difference from Tools**: MCP Servers are external services; Tools are functions agents call directly.

## Handoffs

A **handoff** is a delegation relationship between two agents.

**How it works:**

- Agent A has a task it can't complete alone
- Agent A asks Agent B to handle part of the task
- Agent B performs its part and returns results
- Agent A continues or concludes

**Handoff properties:**

- **Direction**: Which agent delegates to which
- **Constraints**:
  - Requires approval (human-in-the-loop)
  - Max retries (if delegation fails)
  - Timeout (how long to wait)

**Example:**

- `DataAnalyst` receives: "Analyze this dataset and create a presentation"
- It can analyze data itself
- It needs a visualization: handoff to `ChartBuilder`
- It needs a document: handoff to `PresentationWriter`
- It collects results and delivers the final presentation

## Capabilities

A **capability** is the union of tools, skills, and MCP servers an agent has access to.

**The Capabilities Inspector shows:**

- All available tools, skills, and MCP servers
- Which agents use each capability
- Gaps (tools that no agent can access)
- Overrides (tools assigned to too many agents)

**Why it matters**: Clarity. At a glance, you see exactly what infrastructure exists and who needs it.

## The Execution Flow

Here's how Agent Studio works from user action to completion:

```
┌─────────────────────────────────────────┐
│ You ask an agent a question in chat     │
└────────────────────┬────────────────────┘
                     ↓
┌─────────────────────────────────────────┐
│ Agent's context is built:               │
│ - Identity                              │
│ - Instructions                          │
│ - Assigned tools/skills/MCP servers    │
│ - Handoff relationships                │
└────────────────────┬────────────────────┘
                     ↓
┌─────────────────────────────────────────┐
│ LLM processes the request                │
│ (using agent's context and constraints) │
└────────────────────┬────────────────────┘
                     ↓
┌─────────────────────────────────────────┐
│ Agent may:                              │
│ - Call tools directly                   │
│ - Handoff to another agent              │
│ - Ask for clarification                 │
│ - Return a result                       │
└────────────────────┬────────────────────┘
                     ↓
┌─────────────────────────────────────────┐
│ Result appears in your chat              │
└─────────────────────────────────────────┘
```

## Design Principles

Agent Studio is built on these principles:

**Clarity Over Configuration**

- Visual before textual
- Discoverable before hidden
- Explicit before implicit

**Local-First**

- Your agents stay on your machine
- Version controlled like code
- No cloud dependency

**Composition**

- Build complex systems from simple agents
- Reuse tools, skills, and workflows
- Extend through handoffs and capabilities

**Standard Formats**

- `.agent.md`: Human-readable agent definitions
- MCP protocol: Standard external integrations
- `.json` for workflows: Portable, inspectable

---

**[← Quick Start](./quick-start.md)** | **[Creating Agents →](./creating-agents.md)**
