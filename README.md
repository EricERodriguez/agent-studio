# Agent Studio (VS Code Extension)

Agent Studio is a local-first visual control plane for AI agents in VS Code. It helps you create `.agent.md` files, inspect capabilities, and orchestrate multi-agent workflows with a graph UI.

## Features

- Activity Bar container: **Agent Studio**
- Tree views:
  - Agents
  - Workflows
  - Capabilities
  - Templates
- Agent Registry:
  - discovers `.github/chatmodes/*.agent.md` + configurable paths
  - parses frontmatter metadata
  - create/edit/delete/duplicate agent commands
- Agent Builder webview:
  - tabs: Identity, Instructions, Context, Handoffs, Capabilities, Source Preview
  - live `.agent.md` preview
  - validations (required fields, capability warning, handoff integrity)
- Dashboard graph (React Flow):
  - Agent handoff graph
  - Workflow graph with node drag, connect, minimap, zoom/pan
- Capability layer:
  - tools, skills, MCP servers (includes `mcp.json` discovery)
  - filters and optional capability graph panel
- Workflow persistence:
  - `.vscode/agent-studio/workflows/*.json`
- Chat integration:
  - opens VS Code chat and copies agent context for quick paste

## Architecture

### Extension Host (`src/`)

- `extension.ts` - composition root
- `commands/registerCommands.ts` - command registration and helpers
- `services/`
  - `agentRegistryService.ts`
  - `agentMarkdownService.ts`
  - `workflowService.ts`
  - `capabilityService.ts`
  - `chatBridgeService.ts`
  - `sampleDataService.ts`
- `domain/`
  - `models.ts`
  - `messages.ts`
- `infrastructure/fsUtils.ts`
- `views/`
  - `treeProviders.ts`
  - `dashboardPanel.ts`

### Webview App (`webview/`)

- React + Vite + Zustand + React Flow
- `app/pages/DashboardPage.tsx`
- `app/components/GraphCanvas.tsx`
- `app/components/AgentBuilder.tsx`
- `app/components/InspectorPanel.tsx`
- `app/store/useStudioStore.ts`

## Commands

- `agentStudio.openDashboard`
- `agentStudio.createAgent`
- `agentStudio.editAgent`
- `agentStudio.deleteAgent`
- `agentStudio.duplicateAgent`
- `agentStudio.openInChat`
- `agentStudio.createWorkflow`

## Sample Data

Included by default:

- agents:
  - `.github/chatmodes/planner.agent.md`
  - `.github/chatmodes/backend-implementer.agent.md`
  - `.github/chatmodes/reviewer.agent.md`
- workflow:
  - `.vscode/agent-studio/workflows/feature-delivery-flow.json`

## Run & Debug

1. Install dependencies:

```bash
npm install
```

2. Build extension and webview:

```bash
npm run build
```

3. Press `F5` in VS Code to launch the Extension Development Host.

4. In the new window:
- Open Command Palette
- Run `Agent Studio: Open Dashboard`
- Explore views under Activity Bar -> Agent Studio

## Development

- Typecheck:

```bash
npm run check
```

- Build extension only:

```bash
npm run build:extension
```

- Build webview only:

```bash
npm run build:webview
```

## Notes

- Local-only: no backend services required.
- Uses VS Code native chat entry point; context is copied to clipboard for reliable handoff.
- Agent storage format is markdown frontmatter + instructions body.
