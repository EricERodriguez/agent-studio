# Changelog

All notable changes to this project will be documented in this file.

## [2.0.0] - 2026-08-10

### Native workflow execution engine

- **Run Workflow** now drives real CLI sessions end to end instead of pasting into VS Code's chat. Each node runs its own turn in an actual `claude` or `codex` process, chained with the previous step's output and the run's objective (collected through a dedicated **Objective** panel instead of a native input box).
- Nodes with no dependency on each other now run **in parallel**, each in its own VS Code terminal (Claude) or its own `codex app-server` JSON-RPC session (Codex, no visible terminal — progress shown via the Run status panel). The scheduler follows the workflow graph's real dependencies instead of a fixed left-to-right order.
- Added a **Stop** button on the Run status panel to cancel an in-progress run: no new nodes are dispatched and running nodes are left to finish their current turn instead of being killed.
- New CLI launch settings: `agentStudio.cli.claudeCommand`, `agentStudio.cli.codexCommand`, and `agentStudio.cli.startupDelayMs`, so a custom wrapper (alias, different flags, slower-starting shell) can be configured per provider.

### Human-in-the-loop handoffs

- Workflow edges now carry a `handoff.mode` of `automatic` (default) or `human`, toggled with an "⚡ Auto / 👤 Human" control that appears when selecting an edge in the graph editor — human edges are shown with their own color and a 👤 icon.
- Approving a human handoff now opens a dedicated **Approval** panel inside the dashboard (replacing VS Code's native confirmation dialog): full, unclipped context of the previous step, an optional instructions field appended to the next step's prompt, and Approve/Reject actions. Rejecting marks the run as failed without cutting off other branches still in progress.

### Live run status on the graph

- Graph nodes now change color and animate in real time as a run progresses: dimmed for pending/skipped, orange border for queued, an animated pulsing border for running, yellow for waiting on human approval, green for completed, red for failed. Respects `prefers-reduced-motion`.
- The Run status panel now lists every node in the workflow (previously capped at 3) and stays in sync when agents are added, edited, or removed, without requiring a fresh run to pick up the change.

### Safety preflight

- Before a run starts, Agent Studio now verifies the selected CLI (`claude`/`codex`) is installed and starts correctly, blocking the run with a clear error before it asks for an objective if not. If the workspace isn't a git repository, it warns with the option to continue anyway.

### Two/Four/Six-Pack workflow templates

- **Create Workflow** now offers starting from a template, alongside the existing blank "Custom" option: **Two-Pack** (`coder → cleaner`), **Four-Pack** (`specifier → coder → refactorer → architect`, human handoff before coding starts), and **Six-Pack** (`specifier → coder → cleaner → architect → hardener → qa`, human handoff before the final review). Each template only creates the agents that don't already exist in your registry — existing agents with the same id are reused as-is, never overwritten.
- Templates are single-pass linear chains (Agent Studio's scheduler is a strict DAG, unlike the indefinite review loops some inspirations use elsewhere).

### Interaction language, independent of the dashboard UI language

- New workspace setting `agentStudio.interactionLanguage` (`en`/`es`, default `en`) controls the language agents are asked to respond in, fully independent of the dashboard's own display language.
- Individual workflow nodes can override it from a `workspace / English / Spanish` selector in the graph editor. The language instruction is written to preserve code, commands, paths, and API names as-is unless translation is explicitly requested.

### Run state persistence and recovery

- CLI workflow runs (`Claude CLI` / `Codex CLI`) are now written to a durable manifest under `.agent-studio/runs/<runId>/manifest.json` as they progress, including the run's objective and each step's final output.
- If VS Code closes while a run is still active, the run is marked `interrupted` the next time Agent Studio starts — its in-flight steps become `interrupted` and any steps that hadn't started yet become `skipped`. Recovery is **inspection-only**: Agent Studio never reattaches to a terminal or `codex app-server` process, and never auto-resumes or retries a node.
- The Run status panel gained a **history selector** for workflows with more than one saved run, an expandable **Objective** section, and an expandable **Output** section per step — including for recovered runs, which are labeled "Recovered for inspection only."

### Workflow editor improvements

- Added **Rename** and **Edit JSON** buttons to the workflow graph toolbar, matching the controls that already existed for agents — no more digging through the filesystem to rename a workflow or hand-edit its JSON.
- Edge labels ("handoff") are now clickable themselves, not just the underlying connector line, to open the handoff mode toggle.

### Known issues

- Workflow terminals for parallel nodes currently open as separate tabs instead of a side-by-side split.
- See [`docs/swarmforge-integration/BUGS.md`](docs/swarmforge-integration/BUGS.md) for the full list of open, deliberately-deferred issues.

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
