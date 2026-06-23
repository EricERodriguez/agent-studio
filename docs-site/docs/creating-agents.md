---
prev:
  text: Core Concepts
  link: /core-concepts
---

# Creating Agents

Learn how to create agents that fit your team's needs, with best practices and examples.

## Anatomy of an Agent

A complete `.agent.md` file looks like this:

```markdown
# Agent: DataAnalyst

Your specialized data analysis expert.

## Identity

- **Role**: Senior Data Analyst
- **Focus**: SQL, statistics, and insights
- **Personality**: Thorough, methodical, detail-oriented
- **Context**: Works with company data warehouse
- **Limitations**: Cannot write to production databases; read-only access

## Instructions

You are a data analysis agent. Your responsibilities:

### Primary Tasks

- Execute queries against the company data warehouse
- Identify trends, anomalies, and outliers
- Create statistical summaries
- Suggest data quality improvements

### Guidelines

- Always validate input before querying
- Provide context and interpretation with raw results
- Flag assumptions in analyses
- Ask clarifying questions if ambiguous

### Error Handling

- If a query fails, explain why and suggest alternatives
- If data is missing, identify what's needed
- If results are unexpected, suggest sanity checks

## Capabilities

### Tools

- sql_query: Execute SQL against data warehouse
- data_visualize: Create charts and graphs
- compute_stats: Statistical calculations
- email_send: Send insights via email

### Skills

- CompanyDataModel: Understanding of schemas and relationships
- DataQuality: Best practices for validation
- ReportingStandards: Company reporting conventions

### MCP Servers

- analytics-server: Custom analytics API

## Handoffs

### Can delegate to:

- **ReportWriter** (for formatted presentation creation)
  - Requires approval: No
  - Max retries: 3
  - Timeout: 60s
- **DataEngineer** (for data pipeline fixes)
  - Requires approval: Yes (changes infrastructure)
  - Max retries: 1
  - Timeout: 120s

### Should NOT delegate to:

- Other analysts (to avoid circular dependencies)
```

This structure is a suggestion. You can adapt it for your needs.

## Step-by-Step: Create a New Agent

### 1. Plan Your Agent

Before opening Agent Studio, ask:

- **What is this agent's specialty?** (one clear responsibility)
- **What tools does it need?** (which capabilities?)
- **What agents might it delegate to?** (handoff relationships)
- **What constraints does it have?** (approval gates, timeouts)

**Good agents are focused.** A `DataAnalyst` shouldn't also be a `ReportWriter`. Let them specialize and handoff.

### 2. Create in Agent Studio UI

1. Open Agent Studio sidebar
2. Click **"New Agent"**
3. Choose the agent scope:

- **Repository**: save it in the current repo
- **Global**: make it available in any repo on your machine

4. Fill in:
   - **Name**: Clear, single-word or short phrase (e.g., `DataAnalyst`, `APIClient`, `ReportWriter`)
   - **Emoji**: Visual identifier (🔍, 📊, 📝)
   - **Role**: One-line description (e.g., "SQL specialist focused on analytics")
5. Click **Create**

You can later change the scope from the **Identity** tab using the **Scope** field.

## Where agents are stored

- **Repository agents** are stored in `.github/agents`
- **Global agents** are stored in `~/.agents/agents`

Agent Studio loads repository agents, global Agent Studio agents (`~/.agents/agents`), and global Claude Code subagents (`~/.claude/agents`, unless `agentStudio.includeClaudeAgents` is set to `false`) together in a single list. If more than one file resolves to the same agent id, only one wins (repository beats global, and `~/.claude/agents` beats `~/.agents/agents`) — the others are shadowed and a warning is shown in the Inspector panel and the Agents tree tooltip so the conflict is visible instead of silent.

## Generating Agents for Claude, Codex or Antigravity

Every agent starts as one canonical `.agent.md` file. From that single source of truth, Agent Studio can generate the file layout each AI tool expects, so you don't have to hand-write the same agent three times.

When you click **Create**, after naming the agent you'll see a picker:

- **Claude Code** — writes a subagent file to `.claude/agents/<id>.md` with `name`, `description` and `tools` frontmatter, ready to be picked up by Claude Code's subagents.
- **OpenAI Codex (AGENTS.md)** — inserts a marked, idempotent section for the agent into the repository's root `AGENTS.md`, the convention Codex CLI (and other agentic CLIs) read for repo-level instructions.
- **Google Antigravity** — writes `.antigravity/agents/<id>.md` using the same subagent-style format as Claude.
- **✨ All AIs** — selects all three providers at once, so one click produces every file.

Press <kbd>Esc</kbd> on the picker to skip this step — your canonical `.agent.md` is always saved regardless, and you can export it later.

### Exporting an existing agent later

If you skipped the picker, changed an agent's instructions, or want to add another provider, you have two options:

**From the Agent Builder:**

1. Open the agent and go to the **Identity** tab
2. Under **Generate agent for AI providers**, toggle Claude Code / Codex / Antigravity, or click **✨ All AIs**
3. Click **Export now** to write the provider files immediately — this does not require clicking **Save** first, though Save will persist your provider selection into the agent's frontmatter

**From the Agents view or Command Palette:**

1. Right-click the agent in the **Agents** view (or run **Agent Studio: Export Agent for Claude, Codex or Antigravity** from the Command Palette)
2. Select one, several, or **✨ All AIs**
3. Agent Studio regenerates the provider files and remembers your selection in the agent's `providers` frontmatter field

Re-running the export is safe: Claude/Antigravity files are overwritten in place, and the `AGENTS.md` section for that agent is replaced between its `<!-- agent-studio:start:... -->` / `<!-- agent-studio:end:... -->` markers without touching the rest of the file.

> **Note on Codex and Antigravity:** Codex CLI's only standardized convention today is `AGENTS.md`; it doesn't have a per-agent subagent spec like Claude Code. Antigravity's agent file format isn't fully standardized either, so Agent Studio uses the same well-documented subagent shape as Claude Code as a sensible, portable default. Adjust the generated files if your version of either tool expects something different.

> **Note on global-scoped agents:** when exporting an agent whose `Scope` is `global`, Claude Code and Antigravity files are written to `~/.claude/agents` / `~/.antigravity/agents` instead of the workspace, since both are global locations. Codex has no equivalent global file, so exporting a global agent for Codex is skipped with an explanation message — export it as a repository-scoped agent instead if you need an `AGENTS.md` entry.

### Exporting, scaffolding, or importing every agent at once

The per-agent export above writes provider-specific files (Claude/Codex/Antigravity) for one agent. If you want to move or share your **whole** agent set instead, open the **Choose** view and scroll to **Export / Import**:

- **Export All Agents** — pick a destination folder, and Agent Studio writes every currently loaded agent as a plain `<id>.agent.md` file there. Useful for backups or handing your agents to someone on another machine.
- **Create Repo Structure** — pick a destination folder, and Agent Studio creates a `.github/agents/` folder inside it (with all your agents) plus a short `README.md` explaining the layout. The result is a folder ready to `git init` and push as its own repository — Agent Studio does not run git for you.
- **Import Agents** — pick a folder that contains `.agent.md` files (it searches recursively, so a folder created by either action above works). You'll be asked whether to import as **Repository** or **Global** agents. Files whose id already matches an agent you have are skipped, so importing is safe to run more than once.

These three actions work on your **entire** agent list, not a single agent, and are available with English/Spanish labels depending on your selected dashboard language.

### 3. Write Instructions

In the Agent Builder → **Instructions** tab, describe:

**Be specific, not vague:**

❌ **Vague:**

```
You are helpful and good at analysis.
```

✅ **Specific:**

```
You are a data analyst. Your job is to:
1. Execute SQL queries against the data warehouse
2. Report findings with numerical evidence
3. Flag data quality issues
4. If a query fails, explain why and suggest fixes
5. Always validate results before reporting
```

**Include guidelines:**

- What the agent should do
- What it shouldn't do
- How to handle errors
- When to ask for clarification
- Tone and style expectations

**Use headers and lists** for readability. Your agent's instructions are part of its context, so clarity helps it perform better.

### 4. Add Capabilities

Click **Capabilities** tab:

1. Search for the first tool your agent needs
2. Click it to add
3. Repeat until your agent has everything it needs

**Pro tip**: You're not limited to existing tools. If a tool doesn't exist yet, add it anyway—it signals what infrastructure you need to build.

**Example for a DataAnalyst:**

- `sql_query`
- `data_visualize`
- `csv_export`

### 5. Define Handoffs

Click **Handoffs** tab:

1. Search for an agent this one might delegate to
2. Click to add
3. Set constraints:
   - **Requires approval**: Tick if a human should review before delegating
   - **Max retries**: Number of attempts before giving up
   - **Timeout**: Seconds to wait for response

**Example for a DataAnalyst:**

- Can delegate to `ReportWriter` without approval (low-risk)
- Can delegate to `DataEngineer` with approval (infrastructure changes)

## Best Practices

### 1. Keep Agents Focused

Each agent should have one clear specialty. If your agent description is longer than a paragraph, it's probably too broad.

**Bad:**

- `GeneralAssistant` (does everything)
- `AIAgent` (too vague)

**Good:**

- `SQLAnalyst` (queries and reports on data)
- `APIClient` (manages HTTP integrations)
- `DocumentWriter` (formats reports)

### 2. Write Clear Instructions

Your agent is only as smart as its instructions. Spend time here.

```markdown
# Agent: EmailResponder

Responds to customer emails with professionalism and empathy.

## Responsibilities

- Classify email sentiment (positive, neutral, negative)
- Route urgent emails to escalation agent
- Provide helpful responses for common questions
- Offer to forward complex issues to specialists

## Guidelines

- Always be professional and kind
- Acknowledge the customer's concern first
- Provide specific solutions, not vague platitudes
- If unsure, ask for clarification before responding

## Escalation Triggers

Route to escalation if:

- Customer mentions legal issues
- Payment disputes
- Data privacy concerns
- Multiple failed resolution attempts
```

### 3. Use Meaningful Names

Agent names should be descriptive and unique.

**Bad:** `Agent1`, `Assistant`, `Worker`
**Good:** `DataFetcher`, `EmailResponder`, `ReportBuilder`

### 4. Leverage Skills for Shared Knowledge

Don't repeat the same instruction in every agent. Use Skills.

If multiple agents need to know your company's data schema:

1. Create a `CompanyDataModel` skill with schema documentation
2. Assign it to all agents that need it
3. Update it in one place; all agents get the update

### 5. Design Handoff Relationships Thoughtfully

Don't let agents delegate to everyone. Design clean relationships:

```
DataFetcher
    ↓ (passes raw data)
DataCleaner
    ↓ (passes clean data)
DataAnalyst
    ↓ (can delegate to either:)
    ├→ ReportWriter (formatting)
    └→ Visualization (charts)
```

This is clear and testable.

### 6. Version Control Your Agents

Commit your `.agent.md` files to git. Benefits:

- Audit who changed what agent and when
- Rollback to previous versions
- Code review agents before they're active
- Team collaboration via pull requests

```bash
git add *.agent.md
git commit -m "Add DataAnalyst and EmailResponder agents"
```

## Examples

### Example 1: Simple Agent with No Handoffs

```markdown
# Agent: JSONValidator

Validates JSON and provides helpful error messages.

## Instructions

You are a JSON validation specialist. Your job:

- Accept JSON strings as input
- Validate them for syntax errors
- Provide specific error location and suggestion
- Suggest fixes if possible
- Keep explanations brief and clear

If JSON is valid, respond: ✓ Valid JSON

If invalid, respond:
✗ Error at line X, character Y
Problem: [specific issue]
Suggestion: [how to fix]
```

### Example 2: Agent with Handoffs

```markdown
# Agent: TaskRouter

Routes incoming requests to specialized agents.

## Instructions

You are a request routing specialist. Your job:

- Receive incoming requests
- Classify them by type
- Route to the best agent for handling
- Provide context to the receiving agent

Always classify first, then route.
Never try to handle complex requests yourself.

## Handoffs

- **Technical tickets** → TechSupport (approval: No)
- **Billing issues** → BillingSpecialist (approval: No)
- **Feature requests** → ProductManager (approval: Yes)
- **Complaints** → CustomerSuccess (approval: Yes)
```

### Example 3: Multi-Tool Agent

```markdown
# Agent: DataProcessingPipeline

Orchestrates multi-step data transformation.

## Instructions

You coordinate a data processing pipeline. Your job:

1. Accept raw CSV inputs
2. Validate structure and data types
3. Clean and normalize
4. Export to structured format
5. Create validation report

## Capabilities

- csv_read
- data_validate
- data_normalize
- json_export
- report_generate

## Handoffs

- **For visualization** → ChartBuilder (No approval)
- **For database load** → DataEngineer (Yes approval)

## Implementation Notes

Assume tools will fail occasionally. Provide useful error messages and ask for fixes.
```

---

**[← Core Concepts](./core-concepts.md))**
