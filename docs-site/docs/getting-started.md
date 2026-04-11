---
prev: false
next:
  text: Installation
  link: /installation
---

# Getting Started

Welcome to Agent Studio. This guide walks you through installing, setting up your first workspace, and building your first agent.

## What You'll Need

- **VS Code** (1.85 or later): [Download](https://code.visualstudio.com)
- **A workspace folder**: Any empty or existing VS Code workspace
- **5 minutes**: That's all it takes to get your first agent running

You don't need Node.js, Python, or any other runtime unless your agents themselves use them.

## Installation

1. Open VS Code
2. Go to Extensions (Cmd/Ctrl+Shift+X)
3. Search for **"Agent Studio"**
4. Click **Install**

Agent Studio will appear in your sidebar immediately. No reload required.

## Open Agent Studio

Click the **Agent Studio icon** in the VS Code activity bar (left sidebar). The main panel will appear showing:

- **Quick Actions** at the top
- **Agents** tab (empty for now)
- **Workflows** tab
- **Capabilities** tab
- **Templates** tab

## Create Your First Agent

1. Click **"New Agent"** in the sidebar
2. Fill in the form:
   - **Name**: `DataExplorer`
   - **Emoji**: 📊
   - **Role**: "Analyzes datasets and generates insights"
3. Click **Create**

Agent Studio will:

- Create a new `.agent.md` file in your workspace
- Open the Agent Builder editor
- Add it to your sidebar

## Add Instructions

The **Instructions** tab is where you describe how your agent should behave.

Click the markdown editor and type:

```markdown
# DataExplorer Agent

You are a data analysis expert. Your role is to:

- Load and examine CSV files
- Generate statistical summaries
- Create visualizations
- Identify outliers and anomalies
- Make data-driven recommendations

When you receive a file, first describe what you observe,
then ask clarifying questions before diving into analysis.
```

As you type, you'll see a live preview in the sidebar. The `.agent.md` file updates in real-time.

## Add Capabilities

Your agent needs tools to do useful work.

1. Click the **Capabilities** tab in the Agent Builder
2. In the search box, type `read` to find file reading capabilities
3. Click **`file_read`** to add it
4. Add a few more:
   - `csv_parse`
   - `compute_stats`
   - `plot_chart`

These are example capabilities. In your real workspace, you'll see the tools you actually have registered. For now, Agent Studio lets you add any name; you'll wire up real implementations later.

## Set Up Handoffs (Optional)

If you have another agent in your workspace, you can define which agents this one can delegate to.

1. Click the **Handoffs** tab
2. Search for another agent
3. Click to add it as a delegation target
4. Set constraints:
   - **Requires approval**: Check if a human should approve before delegating
   - **Max retries**: How many times to retry if it fails
   - **Timeout**: How long to wait before giving up

For your first agent, you can skip this step.

## Save Your Agent

Click **Save** (Cmd/Ctrl+S) or it will auto-save as you edit.

Your agent is now saved as `.agent.md` in your workspace root. You can:

- Commit it to git
- Share it with your team
- Edit it in any text editor

## Test Your Agent in VS Code Chat

1. Go to the **VS Code Chat** pane (Cmd/Ctrl+Alt+I)
2. Start a new chat
3. Click the **Agent Studio** icon in the chat header
4. Select your `DataExplorer` agent
5. Ask it a question or give it a task

The agent's instructions and capabilities are automatically copied into the chat context. Your model will use this to understand its role and constraints.

## Next Steps

Congratulations! You've created your first agent. Now you're ready to:

- **[Explore the Dashboard](./visual-dashboard.md)**: Learn all the features available
- **[Create Multiple Agents](./creating-agents.md)**: Build a multi-agent team
- **[Build Workflows](./workflows.md)**: Chain agents together for complex tasks
- **[Register Tools](./tools-and-skills.md)**: Connect your own APIs and functions

You can also browse [Why Agent Studio](./why-agent-studio.md) to understand the philosophy behind the tool.

---

**[← Back](/index.md)** | **[Read Installation →](./installation.md)**
