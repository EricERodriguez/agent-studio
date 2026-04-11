# FAQ

## General

**Q: What is Agent Studio?**

A: Agent Studio is a VS Code extension that provides a visual, inspectable control plane for designing and orchestrating multi-agent systems. Instead of writing YAML or JSON configs, you build agents in a rich editor, manage relationships on an interactive graph, and execute workflows directly from VS Code.

**Q: Is Agent Studio free?**

A: Yes. Agent Studio is free and open source. Install it from the VS Code Marketplace.

**Q: Do my agents stay local?**

A: Yes. Agents are stored as `.agent.md` files in your workspace. They don't leave your machine unless you explicitly commit them to a repository you control. No cloud sync, no proprietary backend.

**Q: Can I use Agent Studio with my existing agents?**

A: Yes. If you already have agents defined in `.agent.md` format, Agent Studio will discover and display them automatically. You can also migrate from JSON/YAML configs.

**Q: Does Agent Studio support team collaboration?**

A: Yes. Since agents are `.md` files, they collaborate through git just like code. Pull requests, code review, merge conflicts—all work as expected. Agent Studio reads the same files your team commits.

## Installation & Setup

**Q: Which VS Code versions are supported?**

A: Agent Studio requires VS Code 1.85 or later. We recommend the latest stable version for best performance.

**Q: How do I install Agent Studio?**

A:

1. Open VS Code
2. Go to Extensions (Cmd/Ctrl+Shift+X)
3. Search for "Agent Studio"
4. Click Install

Agent Studio will appear in your sidebar immediately.

**Q: Do I need Node.js, Python, or any other runtime?**

A: No. Agent Studio is a VS Code extension and doesn't require external runtimes. Your agents themselves may use various languages, but Agent Studio doesn't enforce this.

**Q: How do I configure MCP servers?**

A:

1. Go to VS Code Settings (Cmd/Ctrl+,)
2. Search for "Agent Studio"
3. Add your MCP servers to `agentStudio.mcpServers`
4. Provide endpoint URL, authentication, and any required credentials
5. Agent Studio will auto-discover resources and show them in the Capabilities Inspector

**Q: Can I use Agent Studio in a monorepo?**

A: Yes. Agent Studio discovers all agents in the workspace root and its subdirectories. For large monorepos, you can organize agents by folder, and Agent Studio will help you manage them through tags and search filters.

## Agent Definitions

**Q: What format should my agents be in?**

A: Agents are defined as `.agent.md` markdown files. This format is:

- Human-readable
- Version-control friendly
- Portable across tools
- Parseable by external systems

Example:

```markdown
# Agent: DataAnalyst

Analyst focused on SQL queries and data validation.

## Instructions

- Always validate data before reporting
- Ask for clarification if ambiguous
- Provide structured results

## Capabilities

- sql_query
- data_validate
- file_read

## Handoffs

- Can delegate to: ApiCaller, ReportWriter
```

**Q: How do I define agent capabilities?**

A: In the Agent Builder tab:

1. Open the Capabilities panel
2. Search for the tool, skill, or MCP server you want
3. Click it to add to this agent
4. It appears in the `.agent.md` file under `## Capabilities`

**Q: Can agents have custom fields beyond the defaults?**

A: Yes. The `.agent.md` format is standard markdown, so you can add any custom sections you like:

```markdown
# Agent: CustomAgent

## Tags

#python #api #critical

## SLA

Response time: <100ms

## Team

Owned by: data-platform team
```

Agent Studio will display standard sections in the editor, and ignore custom sections gracefully.

## Workflows

**Q: How do I create a workflow?**

A:

1. Open the Agent Studio sidebar
2. Click "Workflows" tab
3. Click "New Workflow"
4. Drag agents onto the canvas in the order you want them to execute
5. Connect each agent's output to the next agent's input (or leave implicit)
6. Mark the entry and exit points
7. Click "Run" to execute it through VS Code chat

**Q: Can workflows have branching or conditions?**

A: Currently, workflows are sequential (agent A → agent B → agent C). Conditional branching is on our roadmap. For now, you can implement logic within an agent's instructions (e.g., "if input contains X, delegate to agent Y").

**Q: How do I test a workflow before running it in production?**

A:

1. Create a test workflow with the same agents but different input
2. Run it from the dashboard with test data
3. Check the execution log for errors or unexpected behavior
4. Iterate until satisfied

Changes to agents automatically apply to all workflows that use them.

**Q: Can I schedule workflows to run automatically?**

A: Not yet. Currently, workflows are triggered manually from the dashboard or via the VS Code chat. Scheduled execution is planned for a future release.

## Capabilities & Tools

**Q: How do I register a custom tool?**

A:

1. Create a tool implementation (can be JavaScript, Python, Go, etc.)
2. Wrap it with the tool interface expected by your agent framework
3. In Agent Studio, go to Capabilities Inspector → Tools
4. Click "Register new tool"
5. Provide: name, description, endpoint/path to implementation
6. The tool appears in the registry and is assignable to agents

**Q: Can I use the same tool with multiple agents?**

A: Yes, that's the whole idea. Register the tool once. Assign it to as many agents as need it. Updates to the tool implementation apply to all agents automatically.

**Q: What's the difference between Tools, Skills, and MCP Servers?**

A:

- **Tools**: Discrete, reusable functions agents can call (API fetch, database query, file write)
- **Skills**: Collections of related instructions/knowledge (CompanyDataModel, BestPractices, Templates)
- **MCP Servers**: External services Agent Studio connects to using the Model Context Protocol (APIs, databases, specialized services)

All three appear in the Capabilities Inspector, but tooling for managing them differs.

**Q: How do I debug a missing capability?**

A:

1. Open Capabilities Inspector
2. Search for the tool/skill the agent needs
3. Click it to see agents that have it assigned
4. If the agent is missing, click "Assign to agents" and add yours
5. Check that the capability definition isn't erroring
6. Restart Agent Studio if needed (Cmd/Ctrl+Shift+P → "Reload Window")

## Performance & Scaling

**Q: How many agents can I have in one workspace?**

A: Agent Studio works efficiently with 3–50 agents. At 50+ agents, we virtualize list rendering and optimize graph performance. At 200+ agents, we recommend organizing agents into subfolders with tags for filtering.

**Q: Does Agent Studio slow down VS Code?**

A: No. Agent Studio runs in the extension host process, not the main thread. It's optimized for low memory and CPU usage. You'll only notice Agent Studio's overhead when you interact with the sidebar.

**Q: How large can my `.agent.md` files be?**

A: Agents can be megabytes if you include detailed instructions, but we recommend keeping instructions concise for readability. If an agent needs massive amounts of context, consider splitting it into multiple smaller agents or moving the context to a Skill.

## Troubleshooting

**Q: Why don't I see my agents in Agent Studio?**

A:

1. Ensure your files are named `*.agent.md`
2. Check they're in the workspace root or a monitored subdirectory
3. Reload vs Code (Cmd/Ctrl+Shift+P → "Reload Window")
4. Check VS Code output for errors (View → Output → "Agent Studio")

**Q: Agent Studio isn't recognizing my tools.**

A:

1. Verify tools are registered in `agentStudio.toolDirectories` in VS Code settings
2. Check that tool files export the correct interface
3. Restart Agent Studio or reload VS Code
4. Check the Output panel for parsing errors

**Q: The Handoff Graph isn't rendering.**

A:

1. Make sure you have WebGL support enabled (most systems do by default)
2. Try zooming out (Cmd/Ctrl+-) to see if graph is just off-screen
3. Right-click the graph → "Reset view"
4. Reload VS Code

**Q: How do I report a bug?**

A:

1. Open VS Code command palette (Cmd/Ctrl+Shift+P)
2. Run "Agent Studio: Show Logs"
3. Include logs when opening an issue on [GitHub](https://github.com/EricERodriguez/agent-studio/issues)

---

Still have questions? [Open an issue on GitHub](https://github.com/EricERodriguez/agent-studio/issues) or start a discussion.
