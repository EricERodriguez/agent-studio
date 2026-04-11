# Agent Studio

Agent Studio is a VS Code extension for designing, editing, and orchestrating AI agents directly inside your workspace. It provides a local-first sidebar plus a visual dashboard for `.agent.md` files, capabilities, and multi-agent workflows.

## What This Extension Adds to VS Code

Agent Studio contributes a dedicated **Activity Bar** container named **Agent Studio** with workspace-aware views for agent authoring and orchestration.

Included views:

- Getting Started
- Quick Actions
- Workspace Health
- Agents
- Workflows
- Capabilities
- Templates

The extension also provides a dashboard webview where you can:

- create and edit agents
- manage instructions, context, handoffs, and capabilities
- inspect Tool, Skill, and MCP usage
- build workflow graphs visually
- open agents in VS Code chat

## Core Features

### Agent authoring

- Discovers `.agent.md` files from `.github/agents` and additional configured paths
- Parses frontmatter metadata and instructions body
- Create, edit, duplicate, and delete agents
- Live source preview while editing
- Built-in validations for required fields, handoffs, and missing capabilities

### Capability inspection

- Discovers Tools, Skills, and MCP servers
- Includes `mcp.json` discovery
- Shows usage relationships across agents
- Supports filtering and dashboard focus by capability

### Workflow orchestration

- Create workflow definitions persisted under `.vscode/agent-studio/workflows`
- Add agent steps, choose entry step, and connect steps visually
- Use graph interactions with drag, connect, minimap, zoom, and pan
- Run workflows through VS Code chat or planning mode

### VS Code integration

- Opens an agent in chat for immediate use
- Provides quick-find commands for agents, workflows, and capabilities
- Adds contextual commands to tree items and view title actions

## Commands

Available commands contributed by the extension:

- `Agent Studio: Open Dashboard`
- `Agent Studio: Quick Find Agent`
- `Agent Studio: Quick Find Workflow`
- `Agent Studio: Quick Find Capability`
- `Agent Studio: Create Agent`
- `Agent Studio: Edit Agent`
- `Agent Studio: Delete Agent`
- `Agent Studio: Duplicate Agent`
- `Agent Studio: Open Agent In Chat`
- `Agent Studio: Create Workflow`
- `Agent Studio: Start MCP Server`
- `Agent Studio: Focus Capability In Dashboard`
- `Agent Studio: Focus Workflow In Dashboard`
- `Agent Studio: Refresh Studio`
- `Agent Studio: Show Tools Guide`

## Extension Settings

This extension contributes the following setting:

- `agentStudio.agentPaths`
  Workspace-relative directories used to discover `.agent.md` files.
  Default:

```json
{
  "agentStudio.agentPaths": [".github/agents"]
}
```

## Workspace Files Used by Agent Studio

Agent Studio works with these workspace artifacts:

- `.github/agents/*.agent.md`
- `.vscode/agent-studio/workflows/*.json`
- `mcp.json`

Sample content included in this repo:

- `.github/agents/planner.agent.md`
- `.github/agents/backend-implementer.agent.md`
- `.github/agents/reviewer.agent.md`
- `.vscode/agent-studio/workflows/feature-delivery-flow.json`

## Getting Started

1. Open the workspace in VS Code.
2. Run `npm install`.
3. Build the extension and webview:

```bash
npm run build
```

4. Press `F5` to launch an **Extension Development Host**.
5. In the new VS Code window, open the **Agent Studio** activity bar item.
6. Run `Agent Studio: Open Dashboard` from the Command Palette if the dashboard is not already open.

## Typical Usage Flow

1. Create or discover agents from the **Agents** view.
2. Open the dashboard and edit an agent in **Agent Builder**.
3. Assign handoffs, Tools, Skills, and MCP servers.
4. Create a workflow and add agent steps.
5. Connect the steps in **Workflow Graph**.
6. Run the workflow or open an agent directly in chat.

## Development

Install dependencies:

```bash
npm install
```

Build everything:

```bash
npm run build
```

Type-check:

```bash
npm run check
```

Build extension only:

```bash
npm run build:extension
```

Build webview only:

```bash
npm run build:webview
```

## Project Structure

### Extension host

- `src/extension.ts`
- `src/commands/registerCommands.ts`
- `src/services/agentRegistryService.ts`
- `src/services/agentMarkdownService.ts`
- `src/services/workflowService.ts`
- `src/services/capabilityService.ts`
- `src/services/chatBridgeService.ts`
- `src/services/sampleDataService.ts`
- `src/views/treeProviders.ts`
- `src/views/dashboardPanel.ts`

### Webview app

- React + Vite + Zustand + React Flow
- `webview/app/pages/DashboardPage.tsx`
- `webview/app/components/AgentBuilder.tsx`
- `webview/app/components/WorkflowBuilder.tsx`
- `webview/app/components/GraphCanvas.tsx`
- `webview/app/components/InspectorPanel.tsx`
- `webview/app/store/useStudioStore.ts`

## Notes

- Local-first: no backend service is required.
- Agent definitions are stored as markdown with frontmatter plus instructions body.
- Chat integration relies on VS Code chat and copies context for reliable handoff.
