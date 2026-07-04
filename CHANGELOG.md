# Changelog

All notable changes to this project will be documented in this file.

## [1.0.2] - 2026-07-03

### Graph layout fix

- Fixed the workflow run-status panel overlapping other floating controls in the Graph view. It no longer floats at its own fixed coordinates; it now stacks in normal flow below the workflow action toolbar (workflow picker, Add Step, Auto Layout, Save Workflow, Delete), so the two can never cover each other regardless of how many lines the toolbar wraps to, and the Agent graph/Workflow graph toggle in the top-left corner stays clickable.

## [1.0.1] - 2026-07-03

### Run workflows in a real CLI

- Added two new "Run Workflow" modes, **Claude CLI** and **Codex CLI**, alongside the existing Chat and Plan modes. Instead of pasting into VS Code's chat, each step's prompt is typed straight into an integrated terminal running `claude` or `codex`, so a workflow run drives the actual CLI session.

### Workflow import/export

- Added **Export All Workflows** and **Import Workflows** to the Choose view's Export/Import section, mirroring the existing agent export/import: write every loaded workflow as a `.json` file into a folder you choose, or import workflow files from a folder (skipping ids that already exist).

### Fixes

- Fixed the header's **Workflow** button doing nothing: the webview posted a `createWorkflow` message that the extension side never handled.
- Fixed agents, workflows, and skills going silently missing from discovery when their files were symlinks (e.g. a shared agents/workflows repo linked into `~/.claude/agents` or `~/.agents/workflows`). File-type checks compared against `vscode.FileType.File`/`.Directory` with strict equality, which fails for symlinked entries since VS Code reports those with the `SymbolicLink` bit also set; switched to bitwise checks.

## [1.0.0] - 2026-06-23

### Dashboard redesign

- Rebuilt the dashboard around a guided 4-step flow: **Choose → Edit → Graph → Inspect**, with a single-shell layout (flat header, steps bar, agent rail, inspector — hairline dividers instead of a "card dashboard" look).
- Added the **Choose** view: agent and workflow picker with capability-aware filtering.
- Added the **Inspect** view: read-only, full-page summary of an agent's capability layer, handoffs in/out, and the workflows it's used in.
- Replaced the ReactFlow-based graph with a custom SVG canvas: pan (drag background), zoom (wheel or on-canvas controls), draggable nodes, a clickable minimap, and a floating Agent graph/Workflow graph mode toggle.
  - Agent graph now only highlights the selected agent's handoffs (incoming dim, outgoing accent) instead of rendering every relationship at equal weight.
  - Workflow graph gained a floating run-status panel, inline Add Step/Auto Layout/Save/Delete/Run controls, drag-to-connect between steps, and an editable entry point.
- Moved Capability Filters into a floating, portal-rendered panel (so it can never be clipped or hidden behind other panes) with a live active-filter count badge.
- Redesigned the Agent Builder:
  - **Identity** tab now uses a 2×2 grid (Agent ID, Scope, Name, Role) with a header showing the agent's avatar, scope badge, and live Saved/Unsaved indicator; selected AI providers show an accent dot.
  - Section tabs (Identity/Instructions/Context/Handoffs/Capabilities/Preview) are now underlined tabs instead of bordered buttons, with live badges for Handoffs and Capabilities counts.
  - **Handoffs** tab is now a toggleable agent list instead of a native multi-select.
  - **Capabilities** tab rebuilt with Tools/Skills/MCP sub-tabs, pool-chip toggles, an inline "Add new" composer, and plain selected-item rows (with an Auto-run toggle for MCP servers).
  - **Instructions** tab shows a live token estimate and a required-field indicator.
- Removed the `reactflow` dependency.

### Bulk export, repo scaffolding, and import

- Added **Export All Agents**: write every loaded agent as a `.agent.md` file into a folder you choose.
- Added **Create Repo Structure**: scaffold a `.github/agents/` folder (plus a short `README.md`) with all your agents, ready to become its own repository.
- Added **Import Agents**: pick a folder of previously exported `.agent.md` files, choose Repository or Global scope, and import the agents that don't already exist locally.
- All three live in the **Choose** view's new **Export / Import** section, with English/Spanish labels and hints.

### Multi-AI agent generation

- Add multi-AI agent generation: export any agent to Claude Code (`.claude/agents`), OpenAI Codex (`AGENTS.md`), or Google Antigravity (`.antigravity/agents`) from one canonical definition.
- Add a "✨ All AIs" option to generate an agent for every supported provider in one step, available when creating an agent and via the new **Agent Studio: Export Agent for Claude, Codex or Antigravity** command.
- Discover globally installed Claude Code subagents from `~/.claude/agents/*.md` alongside repository and Agent Studio global agents (toggle via `agentStudio.includeClaudeAgents`); both repository and global agents are fully editable from Agent Builder.
- Show a `Repo`/`Global` scope badge on the dashboard's agent picker, search results, and Inspector panel, plus a scope filter in Capability Filters.
- Surface a visible warning (Inspector panel, Agents tree tooltip, console) when two agent files resolve to the same agent id instead of silently dropping one.
- Export global-scoped agents to the matching global location for Claude Code and Antigravity (`~/.claude/agents`, `~/.antigravity/agents`); Codex export is skipped for global agents with an explanation, since Codex has no global agents convention.

## [0.1.0] - 2026-04-11

- Initial public-ready package and repository layout
- Add activity bar, views, commands and dashboard webview
