# Contributing

Agent Studio is open source and welcomes contributions from the community. Here's how to get involved.

## Ways to Contribute

### 1. Report Bugs

Found an issue? Let us know.

**How to report:**

1. Check [existing issues](https://github.com/EricERodriguez/agent-studio/issues) to avoid duplicates
2. Describe:
   - What were you doing?
   - What did you expect?
   - What happened instead?
   - OS, VS Code version, extension version
3. Include relevant logs (View → Output → "Agent Studio")

**Example:**

```
Title: "Agent Builder crashes when pasting long instructions"

Steps to reproduce:
1. Create a new agent
2. Go to Instructions tab
3. Paste a 5000+ character markdown text
4. Observe: Application freezes for 30 seconds, then crashes

Expected: Paste completes instantly; no crash

Actual: Frozen UI; extension restart required

Environment: macOS 14.2, VS Code 1.88.0, Agent Studio 1.0.0
```

### 2. Request Features

Have an idea? Share it.

**How to request:**

1. Search [discussions](https://github.com/EricERodriguez/agent-studio/discussions) for similar requests
2. Check the [roadmap](./roadmap.md) to see if it's planned
3. Start a discussion with:
   - What problem does this solve?
   - How would you use it?
   - Why now?

**Example:**

```
Title: "Support conditional branching in workflows"

Problem: Currently workflows are linear. I need to route based on agent output.

Use case: I have an agent that classifies requests (urgent/normal/low).
I want to route urgent → escalation, normal → standard, low → queue.

I could implement this myself if there's an extension point for custom branching logic.
```

### 3. Write Documentation

Docs are always a work in progress. Help us improve.

**How to contribute docs:**

1. Fork the [repository](https://github.com/EricERodriguez/agent-studio)
2. Edit files in `docs-site/docs/`
3. Build and test locally: `cd docs-site && npm run docs:dev`
4. Open a pull request with:
   - What you changed
   - Why (typo fix, new section, clarification)

**Docs we need:**

- More examples in getting-started
- Tutorials for specific use cases
- Troubleshooting guides
- Community tips and tricks

### 4. Improve the Code

Want to dive in with code?

## Development Setup

### Prerequisites

- Node.js 18+
- VS Code 1.85+
- Git

### Clone and Install

```bash
git clone https://github.com/EricERodriguez/agent-studio.git
cd agent-studio
npm install
```

### Project Structure

```
agent-studio/
├── src/                     # Extension code (TypeScript)
│   ├── extension.ts         # Entry point
│   ├── commands/            # Command implementations
│   ├── services/            # Business logic
│   ├── domain/              # Data models
│   └── views/               # Sidebar panels
├── webview/                 # React web app
│   ├── app/                 # React components and pages
│   ├── app/store/           # Zustand state management
│   └── app/hooks/           # Custom React hooks
├── webview-dist/            # Built webview (committed)
├── docs-site/               # VitePress documentation (separate from extension code)
├── package.json             # Root deps (extension build tools)
└── tsconfig.json            # TypeScript config
```

### Building

```bash
# Build extension + webview
npm run build

# Watch mode (rebuild on changes)
npm run watch

# Type check
npm run typecheck
```

### Running in Debug Mode

1. Open the project in VS Code
2. Press **F5** to launch a debug session
3. A new VS Code window opens with Agent Studio loaded
4. Make changes to code; reload (Cmd/Ctrl+Shift+P → "Reload Window")

### Testing

```bash
# Run tests (if we have them in future)
npm test

# Lint code
npm run lint
```

## Code Style & Standards

### TypeScript

- Use strict mode: `"strict": true` in tsconfig
- No `any` types without justification
- Name exports; prefer named over default exports
- Use interfaces for data models; types for unions

### React Components

- Prefer functional components with hooks
- Store complex state in Zustand, not local state
- Memoize components that take expensive props
- Use descriptive names (`AgentBuilder`, not `Editor`)

### File Organization

```
src/
├── services/
│   ├── agentRegistryService.ts   # Discovery & registry
│   ├── workflowService.ts         # Workflow orchestration
│   └── capabilityService.ts       # Tools/skills/MCP
├── domain/
│   ├── models.ts                  # TypeScript interfaces
│   └── messages.ts                # Message types
└── infrastructure/
    └── fsUtils.ts                 # File system helpers
```

### Naming Conventions

- **Functions**: `camelCase` (e.g., `loadAgent()`, `parseMarkdown()`)
- **Classes**: `PascalCase` (e.g., `AgentRegistry`, `WorkflowEngine`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `MAX_AGENTS = 1000`)
- **Interfaces**: `PascalCase` with `I` prefix (e.g., `IAgent`, `IWorkflow`)

### Comments

- Comment _why_, not _what_
- Link to relevant issues or PRs
- Remove commented-out code before committing

**Good comments:**

```typescript
// We debounce to batch rapid file edits (user pasting large instructions)
const debouncedRefresh = debounce(() => refreshRegistry(), 500);
```

**Bad comments:**

```typescript
// Loop through agents
for (const agent of agents) {
  // ...
}
```

## Submitting a Pull Request

### Before You Start

1. Check [open issues](https://github.com/EricERodriguez/agent-studio/issues) to see if someone is already working on it
2. If it's a significant change, open an issue first to discuss

### Branch Naming

```
feature/agent-versioning          # New feature
bugfix/graph-rendering-crash      # Bug fix
docs/add-contributing-guide       # Documentation
chore/update-dependencies         # Maintenance
```

### Commit Messages

- First line: Clear, present tense (e.g., "Add support for agent versioning")
- Body: Explain _why_ this change (what problem does it solve?)
- Reference issues: "Fixes #123" or "Related to #456"

**Example:**

```
Add support for agent versioning

When an agent is edited, users can now tag checkpoints and rollback.
This makes agent iteration safer in team environments.

Implement:
- New tab in Agent Builder for version history
- Checkbox list of versions with timestamps
- One-click restore functionality

Fixes #89
```

### Before Submitting

1. Test your changes locally
2. Run `npm run build` and `npm run typecheck` to ensure no errors
3. Update relevant documentation in `docs-site/docs/`
4. Verify your changes don't break existing tests

### PR Description Template

```markdown
## Description

Brief summary of what this PR does.

## Problem

What issue does this solve? Reference #123 if applicable.

## Solution

How does this PR solve it?

## Testing

How have you tested this?

## Screenshots (if UI changes)

Before/after if relevant.

## Checklist

- [ ] Code builds without errors
- [ ] Type checking passes
- [ ] No linting errors
- [ ] Tests pass (if applicable)
- [ ] Documentation updated
- [ ] Commit messages are clear
```

### Code Review

- Maintainers will review your PR within a few days
- We may ask for changes, clarifications, or optimizations
- Once approved, your PR will be merged

## Licensing

By contributing, you agree that your code will be licensed under the same license as Agent Studio (check LICENSE file).

## Questions?

- [GitHub Discussions](https://github.com/EricERodriguez/agent-studio/discussions): Ask questions, share ideas
- [GitHub Issues](https://github.com/EricERodriguez/agent-studio/issues): Report bugs
- [Email](mailto:eric92rodriguez@gmail.com): For security issues or urgent matters

---

Thank you for contributing to Agent Studio! 🙌
