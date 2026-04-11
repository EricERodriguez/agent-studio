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

Create multi-agent workflows visually, then execute through VS Code chat.

**Build workflows by:**

1. Creating a new workflow in the sidebar
2. Adding agents as sequential steps or parallel branches
3. Marking entry and exit points
4. Connecting output of one agent to input of the next
5. Triggering from the dashboard with context pre-loaded into chat

No Python, no JSON templating. Just visual, declarative agent choreography.

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
