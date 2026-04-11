---
prev:
  text: Installation
  link: /installation
next:
  text: Core Concepts
  link: /core-concepts
---

# Quick Start

Get Agent Studio working and build something real in 5 minutes.

## Prerequisites

- Agent Studio installed (see [Installation](./installation.md))
- VS Code open with a workspace folder

## Step 1: Create an Agent (1 minute)

1. Click the **Agent Studio** icon in the sidebar
2. Click **"New Agent"**
3. Fill in:
   - **Name**: `Cheerleader`
   - **Emoji**: 🎉
   - **Role**: "Motivates and provides encouragement"
4. Click **Create**

Agent Studio creates a `.agent.md` file in your workspace.

## Step 2: Write Instructions (1 minute)

Click the **Instructions** tab and paste:

```markdown
You are an enthusiastic cheerleader. Your job is to:

- Celebrate wins, no matter how small
- Provide motivating quotes
- Use lots of emojis
- Keep responses under 100 words
- Be genuine and supportive
```

Save (Cmd/Ctrl+S). The file updates automatically.

## Step 3: Add Capabilities (1 minute)

Click the **Capabilities** tab. Search and add:

- `joke_generator` (to make people laugh)
- `quote_fetch` (for motivation)
- `emoji_picker` (for visual flair)

These are examples. Click what's available in your workspace, or make it up for now—you'll wire up real tools later.

## Step 4: Test in Chat (1 minute)

1. Open **VS Code Chat** (Cmd/Ctrl+Alt+I)
2. Click **"Agent Studio"** in the message bar
3. Select **Cheerleader**
4. Ask it: _"I just shipped my first feature!"_

The agent's role, instructions, and capabilities are sent to your LLM. It responds in character.

## Step 5: Create a Workflow (1 minute)

Now let's create a multi-agent workflow.

1. In Agent Studio, click the **Workflows** tab
2. Click **"New Workflow"**
3. Name it: `MorningBoost`
4. Drag **Cheerleader** onto the canvas
5. Click **Save**

To run this workflow:

1. Open **VS Code Chat**
2. Type: `/workflow MorningBoost give me motivation`
3. Your Cheerleader agent executes and responds

---

## What You've Built

- ✅ **1 Agent** with instructions and capabilities
- ✅ **1 Workflow** with that agent
- ✅ **Integration** with VS Code chat

## Where to Go From Here

- **[Explore the Dashboard](./visual-dashboard.md)**: Master all features
- **[Create Multiple Agents](./creating-agents.md)**: Build a team
- **[Build Complex Workflows](./workflows.md)**: Chain agents together
- **[Register Real Tools](./tools-and-skills.md)**: Connect APIs and functions

---

## Bonus: Version Control Your Agent

Your `.agent.md` file is just a text file. Commit it to git:

```bash
git add Cheerleader.agent.md
git commit -m "Add Cheerleader agent"
```

Your team can now pull it and use it.

---

**[← Installation](./installation.md)** | **[Core Concepts →](./core-concepts.md)**
