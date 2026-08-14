# Features

Agent Studio is built on a foundation of **visual clarity, real-time feedback, and production readiness**. Here's what makes it different.

## Agent Builder

Design your agents with a dedicated editor, not raw YAML.

**What you get:**

- **Identity tab**: Define agent name, role, emoji, and background context
- **Instructions tab**: Write agent behavior rules with live markdown preview in the sidebar
- **Capabilities tab**: Search and select Tools, Skills, and MCP servers your agent can use
- **Handoffs tab**: Drag-and-drop delegation relationships to other agents in the workspace
- **Context tab**: Manage shared information this agent inherits from Skills and MCP servers

Every edit is immediately reflected in the `.agent.md` file, so your agent definitions stay version-controlled and auditable.

## Handoff Graphs

Understand agent relationships at a glance.

**Visualization features:**

- **Interactive canvas**: Zoom, pan, and explore agent networks
- **Minimap**: Always see where you are in large graphs
- **Relationship types**: Distinguish delegation flows vs. capability bridges
- **Real-time updates**: Add or remove agents; graph recalculates instantly
- **Export ready**: Copy graph as SVG or JSON for docs and presentations

Spot circular dependencies, identify bottlenecks, and design scalable agent systems before they break.

## Capabilities Layer

See which tools, skills, and MCP servers are used—and by whom.

**Inspector features:**

- **Tools list**: All registered tools with use count and agent assignments
- **Skills directory**: Browse Skills with descriptions and linked agents
- **MCP registry**: View all MCP servers and their connection status
- **Filter by agent**: Select an agent, see its exact capability set
- **Gap detection**: Identify capabilities no agent can access (orphaned tools)

This layer prevents "what does agent X actually have access to?" confusion.

## Workflow Orchestration

Create multi-agent workflows visually, then either paste them into VS Code chat or run them with Agent Studio's own execution engine.

**Build workflows by:**

1. Creating a new workflow in the sidebar, starting from a blank canvas or a Two/Four/Six-Pack template
2. Adding agents as sequential steps or parallel branches
3. Marking the entry point
4. Connecting output of one agent to input of the next, with each edge set to automatic or human handoff
5. Saving, then running from the dashboard in Chat, Plan, Claude CLI, or Codex CLI mode

No Python, no JSON templating. Just visual, declarative agent choreography.

### Native Execution Engine (Run Workflow)

Beyond pasting prompts into chat, **Run Workflow** runs each agent in its own real CLI session, with a live-updating graph.

**What you get:**

- **Real CLI sessions per agent**: each workflow step runs in an actual `claude` or `codex` session — not text handed to VS Code chat. Claude runs in an integrated terminal; Codex runs headless via `codex app-server` (JSON-RPC), with progress shown in the Run status panel instead of a terminal.
- **Real parallelism**: nodes with no dependency on each other in the workflow graph run at the same time, each in its own session, instead of one after another. Claude terminals for sibling nodes open side-by-side as real VS Code splits, not as separate tabs.
- **Automatic or human handoffs per edge**: toggle any connection between "⚡ Auto" (runs immediately) and "👤 Human" (pauses for approval) right from the graph editor.
- **Approval panel**: when a run hits a human edge, a panel inside the dashboard shows the previous step's full, unclipped output, an optional instructions box, and Approve/Reject buttons. Approved instructions get added to the next step's prompt; rejecting fails the run.
- **Live status on the graph**: nodes change color and animate as they move through `pending → queued → running → waiting_approval → completed` (or `failed`/`skipped`), with a reduced-motion-friendly pulse on running nodes.
- **Stop button**: cancel an in-progress run; running nodes finish their current turn instead of being killed, and no new nodes get dispatched.
- **Preflight safety checks**: before a run starts, Agent Studio confirms the selected CLI is installed and starts correctly, blocking the run with a clear error if not. A workspace is considered Git-backed when its root or a direct child project is a repository, which avoids false warnings for folders that group several projects. It does not check for uncommitted changes, by design.
- **Workflow starter templates**: create a new workflow from a Two-Pack (`coder → cleaner`), Four-Pack (`specifier → coder → refactorer → architect`, human gate before coding), or Six-Pack (`specifier → coder → cleaner → architect → hardener → qa`, human gate before final review) — inspired by SwarmForge's packs, but implemented as linear, single-pass DAG chains rather than indefinite loops. Existing agents with matching ids are reused instead of duplicated.
- **Run persistence and recovery**: every CLI run is saved to a durable manifest in your workspace as it progresses. If VS Code closes mid-run, it comes back as `interrupted`, read-only history on next launch — never auto-resumed — browsable from a history selector with expandable objective/output per step.

See [Workflows](/workflows) for the full walkthrough.

### Interaction Language

Agent responses can be steered independently of the dashboard's own UI language via the `agentStudio.interactionLanguage` workspace setting (`en`/`es`, default `en`), with an optional per-node override in any workflow. Code, commands, paths, and API names are preserved as-is unless you explicitly ask for a translation.

## Dashboard Overview

**Your control center in VS Code:**

The main dashboard provides:

- **Quick stats**: Agent count, active workflows, capability coverage
- **Recent activity**: Last agents edited, workflows run
- **Global search**: Find agents, workflows, or capabilities instantly
- **Theme controls**: Light/dark mode, compact/spacious layout
- **Settings link**: Configure MCP servers, tool directories, agent templates

Everything you need is one click away.

## Local-First Architecture

Agent Studio stores everything locally in your workspace.

**Why this matters:**

- No cloud dependency = instant startup, zero latency
- Version control your agents = audit trail, branching, rollback
- Team collaboration = pull requests, code review, merge conflicts resolved like any source file
- Portability = agents work offline, in any environment

Your agent definitions are `.agent.md` files in your repo. Treat them like code.

## Shared Resource Repositories

Keep agents and workflows together in one versionable library.

- **Create resource repository** creates the canonical
  `.github/agents/` and `.vscode/agent-studio/workflows/` layout, README, and
  manifest when the chosen repository does not exist.
- **Export repository bundle** writes every loaded agent and workflow to that
  layout in one operation. **Import repository bundle** reads them together,
  skips duplicate IDs, and reports invalid definitions or missing agent
  references.
- A created library is used for future global resources through
  `agentStudio.resourceRepository`; legacy `agents/*.md` and `workflows/*.json`
  libraries are still readable.

The dashboard rail also switches between **Agents** and **Workflows**, so a
workflow can be selected directly and its metadata or graph edited independently.

## Integration Points

**VS Code features you already love:**

- **Sidebar**: Agent Studio panel always accessible
- **Markdown preview**: Live view of agent instructions as you type
- **Search**: Find agents, workflows, or capabilities across the workspace
- **Source control**: Commit agent changes alongside code
- **Chat**: Open any agent in chat with one click; context auto-copied

**External integrations:**

- **Skills and Tools**: Register custom capabilities that multiple agents can access
- **MCP servers**: Connect to any MCP-compatible service
- **Webhooks**: Trigger workflows programmatically

---

**[← Back to Features](#)** | **[Explore Docs →](/getting-started)**
