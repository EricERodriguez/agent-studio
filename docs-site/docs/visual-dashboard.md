# Visual Dashboard

The Agent Studio dashboard is where you spend most of your time. It's designed for clarity, speed, and confidence at scale.

## Layout Overview

The dashboard has three main regions:

**Sidebar Rail** (left)

- Quick Actions (templates, import, export)
- Views: Agents, Workflows, Capabilities, Templates
- Search and filter across all entities

**Main Canvas** (center/right)

- Context-sensitive editor based on what you selected
- Agent Builder, Workflow Editor, Capability Inspector, Handoff Graph
- Live `.agent.md` and workflow `.json` previews

**Bottom Inspector** (optional)

- Details pane for the selected agent or capability
- Relationships, recent edits, usage stats

## Agent Builder Tab

Create and edit agents visually.

**Identity**

- Agent name and emoji
- One-line role description
- Background color for visual distinction
- Created/edited timestamps

**Instructions**

- Rich markdown editor with live preview
- Format agents with headers, lists, tables
- Copy-paste instructions from docs
- Character count and word count

**Capabilities**

- Search bar to find Tools, Skills, MCP servers (fuzzy matching)
- Add by clicking; drag to reorder
- See descriptions and usage counts
- Identify which other agents use the same tool

**Handoffs**

- List all agents this agent can delegate to
- Mark as "requires approval" for human-in-the-loop
- Set constraints: max retries, timeout, fallback behavior
- See the Handoff Graph visualization

**Context**

- Show inherited instructions from Skills or MCP servers
- Read-only reference for what this agent actually "knows"
- Helps debug capability mismatches

## Handoff Graph

Interactive visualization of agent relationships.

**Controls**

- **Zoom**: Scroll wheel or pinch on trackpad
- **Pan**: Click and drag the canvas
- **Minimap**: Bottom-right corner shows you where you are in large graphs
- **Search**: Cmd/Ctrl+F to highlight agents by name
- **Focus**: Double-click an agent to center and zoom

**Node Details**

- Hover over an agent to see its role and capability count
- Color coding: green = healthy, yellow = missing capabilities, red = no capabilities
- Size reflects complexity (number of handoffs and capabilities)

**Edges (Handoff Flows)**

- Solid lines = direct delegation
- Dashed lines = conditional delegation
- Arrow direction shows flow direction
- Hover to see delegation constraints

**Actions**

- Right-click an agent to edit or delete
- Right-click an edge to modify handoff rules
- Drag agents to rearrange (optional; resets to auto-layout on refresh)

## Capabilities Inspector

See exactly which agents use which tools, skills, and MCP servers.

**Tools Section**

- List all registered tools in the workspace
- For each tool: agent assignments, last used, description
- Filter by agent or by tool category
- Add or remove tool registrations

**Skills Section**

- All .skills directories registered in VS Code settings
- Browse skills with descriptions and metadata
- See which agents inherit each skill
- Create new skill templates

**MCP Servers Section**

- View all MCP servers currently active
- Connection status (connected, connecting, error)
- Endpoints and resource types
- Link or unlink from agents

**Gap Detection**

- Red-highlighted tools/skills are orphaned (no agents use them)
- Blue-highlighted are high-value (used by 5+ agents)
- Helps optimize and clean up unused capability registrations

## Workflow Editor

Build multi-agent workflows visually.

**Canvas Elements**

- **Step cards**: Each agent appears as a draggable card
- **Connectors**: Click and drag from one step to another to create sequence
- **Branch nodes**: Add parallel execution points
- **Condition nodes**: Route based on output properties (optional)
- **Entry point**: Mark where workflow execution starts
- **Exit point**: Mark where results are collected

**Sidebar for This Workflow**

- Workflow name and description
- List of steps in order
- Trigger configuration (manual, webhook, schedule)
- Output schema expected from the final step

**Run Panel**

- Input parameters for the workflow
- Run button triggers execution through VS Code chat
- Live execution log as agents execute
- Final output display

## Dashboard Home

Your control center when Agent Studio opens.

**Quick Stats Cards**

- Total agents, active workflows, capability coverage
- Last 3 agents edited (jump to them)
- Next scheduled workflows

**Activity Stream**

- Recent agent edits across your team
- Workflow runs in the past 24 hours
- Capability changes and tool registrations

**Quick Actions Menu**

- Create new agent
- Create new workflow
- Import agents from file
- Export all as `.tar.gz`
- Access workspace settings

**Search and Filter**

- Global search: Cmd/Ctrl+P searches all agents, workflows, and capabilities
- Filter by tag: #python, #api, #data
- Sort by: recently edited, alphabetical, complexity

## Keyboard Shortcuts

| Action           | Shortcut                   |
| ---------------- | -------------------------- |
| Focus search     | Cmd/Ctrl+P                 |
| New agent        | Cmd/Ctrl+N                 |
| New workflow     | Cmd/Ctrl+Shift+W           |
| Save             | Cmd/Ctrl+S                 |
| Zoom in (graph)  | Cmd/Ctrl+=                 |
| Zoom out (graph) | Cmd/Ctrl+-                 |
| Jump to agent    | Cmd/Ctrl+J, then type name |
| Format markdown  | Cmd/Ctrl+Shift+F           |

## Performance and Scaling

Agent Studio is optimized for:

- **3–50 agents**: Instant responsiveness, all features available
- **50–200 agents**: Virtualized lists (only visible items render), graph rendering optimized
- **200+ agents**: Recommend workspaces organized into modules; Agent Studio groups by workspace root

Graph rendering uses Canvas for performance. Real-time updates are debounced to prevent jank.

---

**[← Features](/features)** | **[Get Started →](/getting-started)**
