# Roadmap

Agent Studio is actively developed. Here's what's planned for upcoming releases.

## Current Release

**Agent Studio 2.0.0** (Latest Stable)

- Visual agent builder with rich editor
- Handoff graph visualization
- Capabilities inspector (Tools, Skills, MCP servers)
- Workflow orchestration — native execution engine (Run Workflow) with real Claude CLI / Codex CLI sessions per agent, dependency-graph parallelism, automatic/human handoffs with an in-dashboard approval panel, live run status on the graph, a Stop button, and preflight safety checks
- Run state persistence and recovery: CLI runs survive a VS Code restart as inspectable, `interrupted` history (never auto-resumed), with a run history selector and expandable objective/output in the Run status panel
- Two/Four/Six-Pack workflow starter templates
- Per-workflow-node interaction language, independent of the dashboard UI language
- Local-first architecture with version control
- Dark mode with responsive design

## Q2 2026

**Planned Features:**

- **Advanced Search**: Full-text search across agent instructions, capabilities, and relationships
- **Import/Export**: Bulk import agents from JSON/YAML; export workflows as shareable templates
- **Settings Sync**: Sync Agent Studio preferences and workspace configuration via VS Code Settings Sync
- **Performance Optimization**: Graph rendering improvements for 200+ agent workspaces

**Fixes & Polish:**

- Keyboard navigation improvements throughout dashboard
- Better error messages for capability mismatches
- Improved MCP server auto-discovery and docs

## Q3 2026

**Planned Features:**

- **Conditional Workflows**: Branch logic in workflows based on agent outputs
- **Agent Testing**: Built-in test runner for individual agents and workflows
- **Documentation Generator**: Auto-generate docs for your agents and workflows in Markdown
- **Analytics Dashboard**: Track agent usage, performance metrics, and error rates
- **Team Presence**: Real-time collaboration indicators (see which team members are editing which agents)

**Community Contributions:**

- First community-submitted extensions and plugins
- Expanded MCP server integrations

## Q4 2026

**Planned Features:**

- **Scheduled Workflows**: Cron-based execution for recurring agent tasks
- **Webhook Triggers**: External systems can trigger workflows via HTTP
- **Agent Versioning**: Tag and rollback agent definitions across time
- **Advanced Authorization**: Fine-grained permission control (which team members can edit which agents)
- **Multi-Workspace Support**: Manage agents across multiple VS Code workspace folders
- **Cloud Sync (Optional)**: Teams can optionally sync agent definitions to a shared service (fully backward-compatible; local-first by default)

## Backlog (Future)

**Longer-term roadmap:**

- **Agent Marketplace**: Share agents, skills, and workflows with other developers
- **Custom UI Components**: Build custom dashboards and visualizations within Agent Studio
- **Agent Profiling**: Bottleneck analysis and performance optimization suggestions
- **Deployment Integration**: Direct deployment of agents to cloud platforms (Azure Container Instances, AWS Lambda, etc.)
- **Mobile Dashboard**: Read-only mobile companion for monitoring workflows
- **Voice Commands**: Use VS Code voice commands to trigger agent actions
- **WASM Extensions**: Extend Agent Studio capabilities via WebAssembly plugins

## How to Contribute

Have an idea or want to help? Here's how:

1. **Report Issues**: Found a bug? [Open an issue](https://github.com/EricERodriguez/agent-studio/issues)
2. **Request Features**: Want a capability on the roadmap sooner? [Submit a feature request](https://github.com/EricERodriguez/agent-studio/discussions)
3. **Submit PRs**: Check the [contributing guide](https://github.com/EricERodriguez/agent-studio/blob/main/CONTRIBUTING.md) for development setup
4. **Share Feedback**: Join the [discussions forum](https://github.com/EricERodriguez/agent-studio/discussions) and share how you're using Agent Studio

## Version History

| Version | Release Date | Highlights                                                                   |
| ------- | ------------ | ---------------------------------------------------------------------------- |
| 2.0.0   | Aug 10 2026  | Native workflow execution engine, human-in-the-loop handoffs, live run status, safety preflight, Two/Four/Six-Pack templates, run persistence & recovery |
| 1.0.0   | Apr 11 2026  | Initial public release; visual agent builder, graphs, capabilities inspector |
| 0.9.0   | Apr 2026     | Beta; core features, community feedback incorporation                        |
| 0.1.0   | Apr 2026     | Alpha/internal; foundation and architecture                                  |

---

**[← Features](/features)** | **[Report a Bug →](https://github.com/EricERodriguez/agent-studio/issues)**
