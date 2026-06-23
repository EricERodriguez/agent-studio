---
prev:
  text: Tools and Skills
  link: /tools-and-skills
next:
  text: "Visibility: Tools, Skills & MCP"
  link: /visibility
---

# Visual Dashboard

The Agent Studio dashboard is a single-screen workspace, structured as a guided 4-step flow: **Choose → Edit → Graph → Inspect**. You always know where you are, and every step is one click away from the others.

## Layout Overview

The dashboard has four regions, top to bottom and left to right:

- **Header** — the Agent Studio logo and title, live counts of agents/workflows/capabilities, the EN/ES language switch, and the **+ Agent**, **Workflow**, and refresh buttons.
- **Steps bar** — the `1 Choose › 2 Edit › 3 Graph › 4 Inspect` breadcrumb (click any step to jump there), plus an Editor/Graph shortcut and a live **Save** indicator for the agent you're editing.
- **Agent rail** (left) — search, scope filter (All/Repo/Global), the agent list, and the **Capability filters** toggle.
- **Center stage** — whichever step is active: Choose, Edit, Graph, or Inspect.
- **Inspector** (right) — a collapsible summary of the selected agent, available whenever you're in **Edit** or **Graph**.

## 1. Choose

The starting point. Pick an agent to edit, open a workflow, or manage your agents in bulk.

![Choose view](/screenshots/dashboard-choose.png)

- **Agent cards** — name, role, scope badge (Repo/Global), description, and a `T·S·M` capability count. Click **Open ›** to jump straight into the **Edit** step for that agent.
- **Workflows** — listed below the agents, with step count, entry count, and scope. Click **Open ›** to jump to the **Graph** step in workflow mode.
- **Export / Import** — at the bottom of this view:
  - **Export All Agents** writes every loaded agent as a `.agent.md` file into a folder you choose.
  - **Create Repo Structure** scaffolds a fresh `.github/agents/` folder (with a short `README.md`) containing all your agents, ready to become its own repository.
  - **Import Agents** lets you pick a folder of previously exported `.agent.md` files; you choose Repository or Global scope, and Agent Studio imports the ones that don't already exist in your current list (matching ids are skipped, not overwritten).

## 2. Edit (Agent Builder)

Six tabs cover everything an agent definition needs. The header above the tabs always shows the agent's avatar, name, scope badge, live Saved/Unsaved indicator, and its file path.

![Identity tab](/screenshots/dashboard-edit-identity.png)

- **Identity** — Agent ID (read-only), Scope, Name, and Role in a 2×2 grid, plus Description, Role quick-picks, Tags, and **Generate agent for AI providers** (Claude Code / OpenAI Codex / Google Antigravity, with **✨ All AIs** and **Export now**). The provider you've selected shows a small accent dot.
- **Instructions** — the agent's system prompt, with a live token estimate and a required-field warning if it's empty.
- **Context** — optional extra context, constraints, or conventions.
- **Handoffs** — click any other agent to toggle whether this one can delegate to it; selected agents show a filled checkmark.
- **Capabilities** — see below.
- **Preview** — the live-generated `.agent.md` markdown (frontmatter + instructions), exactly what gets written to disk on Save.

![Capabilities tab](/screenshots/dashboard-edit-capabilities.png)

The **Capabilities** tab has its own Tools/Skills/MCP sub-tabs (each shows a count). For the active kind:

- Click any chip in **Available …** to toggle it on or off for this agent.
- Click **+ Add new** to register a capability that doesn't exist yet — enter an ID, a label, and (for Tools) a kind, then **Add**.
- **Selected …** lists what's currently assigned, each removable with **✕**. Selected MCP servers also get an **Auto-run** toggle.

## 3. Graph

Visualizes either the relationships between all your agents, or the steps of a single workflow. Switch between the two with the **Agent graph / Workflow graph** toggle floating in the top-left corner of the canvas.

![Agent graph](/screenshots/dashboard-graph-agents.png)

**Agent graph** — every agent as a node; the selected agent's outgoing handoffs are highlighted in accent color, everything else stays dimmed so the graph doesn't read as "everyone connected to everyone."

![Workflow graph](/screenshots/dashboard-graph-workflow.png)

**Workflow graph** — steps as nodes, with the entry point outlined in green. Selecting a step reveals **Set entry** / **Remove** buttons beneath it, and dragging from the small handle on a node's right edge draws a new connection to another step. The floating **Run status** panel on the left shows step-by-step progress, plus controls to add a step, auto-layout, save, delete the workflow, and run it (Chat or Plan mode).

**Common canvas controls** (bottom-left): zoom in/out, reset view, and the current zoom percentage. **Minimap** (bottom-right): click anywhere on it to jump the view there. You can also pan by dragging the empty canvas background, and zoom with the mouse wheel.

## 4. Inspect

A read-only, full-page view of one agent's place in your system — useful for understanding impact before you change something.

![Inspect view](/screenshots/dashboard-inspect.png)

- **Capability layer** — the agent's Tools, Skills, and MCP servers as chips. Click one to see exactly which agents share it.
- **Delegates to / Delegated from** — outgoing and incoming handoffs, each clickable to jump to that agent.
- **Used in workflows** — every workflow this agent appears in, and whether it's the entry step.

## Capability Filters

Click **Capability filters** at the bottom of the agent rail to open a floating panel for narrowing the agent list by Tool, Skill, MCP server, or Scope.

![Capability filters](/screenshots/dashboard-capability-filters.png)

Active filters show as removable chips, and the panel always shows a live "Showing X of Y agents" count. **Clear Filters** resets everything in one click. These filters also apply to the agent grid in the **Choose** step.

## Inspector Panel

Available on the right whenever you're in **Edit** or **Graph**. Shows the selected agent's avatar, scope, role, description, Tools/Skills/MCP counts, a capability chip list, its handoffs, and **Open in Chat** / **Edit** / **Reveal File** actions. Collapse it to a thin vertical handle with the arrow in its header, and expand it again the same way.

---

**[← Tools and Skills](/tools-and-skills)** | **[Visibility: Tools, Skills & MCP →](/visibility)**
