---
prev:
  text: Create Multiple Agents
  link: /creating-agents
next:
  text: Register Tools
  link: /tools-and-skills
---

# Workflows

Create, run, and compose multi-agent workflows.

## Overview

Workflows let you chain agents together so they can collaborate on larger tasks. A workflow is a directed graph of agent steps, with an entry point, edges connecting one step's output to the next step's input, and optional human approvals on any edge.

Agent Studio ships two ways to run a workflow: pasting prompts into VS Code Chat (the original, lightweight approach), or **Run Workflow**, a native execution engine that runs each agent in a real Claude CLI or Codex CLI session with real parallelism and human-in-the-loop gating.

## Building a Workflow

1. Open the **Workflows** tab in Agent Studio (or click **+ Workflow** in the dashboard header).
2. Give it a name and pick a scope (Repository or Global).
3. Choose **Custom** to start from a single empty node, or pick a starter template (see below).
4. Drag agents onto the canvas, connect them with edges, and mark one node as the entry point.
5. Click **Save Workflow**.

Use the **Rename** and **Edit JSON** buttons in the graph toolbar to rename the workflow or open its underlying JSON file directly — the same actions already available for individual agents.

### Starting from a Template

When creating a workflow you can pick from a small catalog inspired by SwarmForge's packs, instead of starting from a blank canvas:

- **Two-Pack**: `coder → cleaner`, fully automatic.
- **Four-Pack**: `specifier → coder → refactorer → architect`, with a human approval gate between `specifier` and `coder` (review the spec before code gets written).
- **Six-Pack**: `specifier → coder → cleaner → architect → hardener → qa`, with a human approval gate between `hardener` and `qa` (a closing gate before final review).

Each template only creates the agents that don't already exist in your registry — if you've already run one template, or already had an agent with a matching id (e.g. your own `coder`), it's reused as-is rather than overwritten.

Unlike SwarmForge's packs, these templates are **linear, single-pass chains**, not indefinite loops. Agent Studio's run engine is a strict DAG scheduler — a node runs at most once per run — so there's no "loop coder and cleaner until a human stops it" behavior. This is a deliberate simplification to fit the native engine's execution model.

## Handoffs: Automatic vs Human

Every edge in a workflow graph has a handoff mode:

- **⚡ Automatic** (default): the next agent starts as soon as its predecessors finish, no confirmation needed.
- **👤 Human**: the run pauses at that edge and waits for a person to approve before continuing.

Select an edge (click the connecting line or its "handoff" label) to reveal a floating **⚡ Auto / 👤 Human** toggle. Edges set to `human` render in a distinct color with a 👤 icon, so you can see the gating structure of a workflow at a glance without opening it.

## Running a Workflow

The **Run status** panel on the graph view has a mode selector and a **Run Workflow** button.

### Run modes

- **Chat**: opens each agent in VS Code Chat, one at a time, in graph order — the original behavior, no CLI session involved.
- **Plan**: doesn't execute anything; it generates a text execution plan listing the steps in order.
- **Claude CLI**: runs each step as a real `claude` CLI session.
- **Codex CLI**: runs each step as a real `codex` session via `codex app-server`.

### Native execution (Claude CLI / Codex CLI)

Choosing **Claude CLI** or **Codex CLI** hands the run over to Agent Studio's native execution engine:

1. **Preflight check**: before anything else, Agent Studio confirms the chosen CLI is installed and starts correctly (`<cli> --version`). If it isn't, the run is blocked with an error before you're even asked for an objective. Agent Studio accepts a Git repository in the workspace root or in a direct child project, so it works when the open folder groups several independent repositories. If it finds neither, you get a warning with the option to continue anyway — Agent Studio deliberately does **not** check for uncommitted changes.
2. **Objective panel**: a panel asks what this run should do (e.g. "Review the repo and propose 3 small improvements, then implement them"). This objective is folded into every agent's prompt, along with the output of whatever step ran before it.
3. **Parallel terminals per agent**: each node in the workflow graph runs in its own session — a real integrated VS Code terminal for Claude, or a `codex app-server` JSON-RPC session (no terminal, progress shown only in the Run status panel) for Codex. Nodes with no dependency on each other in the graph are dispatched at the same time, not one after another. Claude terminals for sibling nodes open side-by-side as real VS Code splits (using VS Code's native `workbench.action.terminal.split` command), not as separate tabs.
4. **Human approval gates**: when the run reaches a `human` edge, it pauses and opens an approval panel inside the dashboard — not a native VS Code dialog — showing the full, unclipped output of the previous step, an optional instructions field, and Approve/Reject buttons. Approving with instructions folds them into the next step's prompt; rejecting marks the whole run as failed.
5. **Live graph status**: nodes change color and animation as the run progresses — dimmed for `pending`, orange border for `queued`, an animated pulsing border for `running`, yellow for `waiting_approval`, green for `completed`, red for `failed`, and dimmed for `skipped`. The pulse animation respects `prefers-reduced-motion`.
6. **Stop**: a **■ Stop** button in the Run status panel cancels a run in progress. Nodes already running are allowed to finish their current turn rather than being killed outright; no new nodes are dispatched after cancelling.

## Run History and Recovery

Every CLI run (`Claude CLI` / `Codex CLI`) is written to a durable manifest under `.agent-studio/runs/<runId>/manifest.json` in your workspace as it progresses, including the objective you gave it and each step's final output.

- If a workflow has more than one saved run, the Run status panel shows a **history selector** so you can switch between them.
- Each step can be expanded to see its **Output**, and the run's **Objective** is available in its own expandable section.
- If VS Code closes while a run is still active, that run is marked `interrupted` the next time Agent Studio starts — steps that were queued, running, or waiting on approval become `interrupted`, and steps that hadn't started yet become `skipped`. A banner marks it "Recovered for inspection only."

Recovery is **read-only by design**: Agent Studio never reattaches to a terminal or a `codex app-server` process, and never automatically resumes or retries a node — a recovered run is history you can inspect, not a run you can continue.

## Interaction Language

Agents respond in the language set by the **`agentStudio.interactionLanguage`** workspace setting (`en` or `es`, default `en`) — this is independent of the dashboard's own UI language. Any individual workflow node can override it: select the node in the graph and choose `Workspace default`, `English`, or `Spanish` from its language selector. The instruction sent to the agent preserves code, commands, paths, and API names as-is, unless you explicitly ask it to translate them too.

## Learn more

- See the [Dashboard](./visual-dashboard.md) for saved workflows and execution history.
- Register tools and capabilities on the [Tools and Skills](./tools-and-skills.md) page.
