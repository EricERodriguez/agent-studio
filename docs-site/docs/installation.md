---
prev:
  text: Getting Started
  link: /getting-started
next:
  text: Quick Start
  link: /quick-start
---

# Installation

Agent Studio is a VS Code extension available on the Marketplace. Installation takes 30 seconds.

## Via VS Code Marketplace (Recommended)

**Easiest method:**

1. Open **VS Code**
2. Go to **Extensions** (Cmd/Ctrl+Shift+X)
3. Search for **Agent Studio**
4. Click **Install**
5. A dialog appears asking to reload; click **Reload Now** (or reload manually)

Agent Studio will appear in your sidebar immediately with an icon that looks like a network diagram.

## System Requirements

- **VS Code**: 1.85 or later (latest stable recommended)
- **OS**: macOS, Windows, or Linux
- **Memory**: 100 MB free (Agent Studio is lightweight)
- **Storage**: ~20 MB for extension files

## Verify Installation

1. Check your VS Code sidebar (left) for the Agent Studio icon
2. Click it to open the sidebar panel
3. You should see:
   - Quick Actions
   - Agents tab (empty)
   - Workflows tab
   - Capabilities tab
   - Templates tab

If you don't see the icon, try:

- Reloading VS Code (Cmd/Ctrl+Shift+P → "Reload Window")
- Checking that the extension installed successfully (go to Extensions → search "Agent Studio" → verify it says "Installed")

## Initial Setup

### Workspace Configuration

Agent Studio works in any VS Code workspace, but the first time you use it, configure where your agents live.

**Option 1: Default (Recommended for Beginners)**

Just start using Agent Studio. Agents are created in your workspace root (`.agent.md` files) and auto-discovered. No configuration needed.

**Option 2: Custom Directories (For Larger Projects)**

If you have existing agents or want to organize them:

1. Go to **Settings** (Cmd/Ctrl+,)
2. Search for **Agent Studio**
3. Set `agentStudio.agentDirectories` to point to your agent folders:
   ```json
   ["${workspaceFolder}/agents", "${workspaceFolder}/lib/agent-definitions"]
   ```
4. Agent Studio will scan these folders on startup

### Registering Tools and Skills

You can skip this initially, but when you're ready to connect real tools:

1. Go to **Settings**
2. Search for **Agent Studio**
3. Set `agentStudio.toolDirectories` to where your tools are registered:
   ```json
   {
     "agentStudio.toolDirectories": [
       "${workspaceFolder}/tools",
       "${workspaceFolder}/lib/custom-tools"
     ],
     "agentStudio.skillDirectories": ["${workspaceFolder}/.skills"]
   }
   ```
4. Tools and skills are auto-discovered from these directories

### Connecting MCP Servers

If you're using external MCP servers (e.g., for APIs, databases):

1. Go to **Settings**
2. Search for **Agent Studio**
3. Add to `agentStudio.mcpServers`:
   ```json
   [
     {
       "name": "my-api-server",
       "endpoint": "http://localhost:3000/mcp",
       "auth": "none"
     }
   ]
   ```
4. Ensure the MCP server is running on the specified endpoint
5. Agent Studio will discover its resources automatically

For secured MCP servers, use `"auth": "api-key"` and store credentials in VS Code's secret storage:

```json
{
  "name": "secure-api",
  "endpoint": "https://api.example.com/mcp",
  "auth": "api-key",
  "credentials": "${secret:MCP_API_KEY}"
}
```

## Uninstall

If you ever need to uninstall:

1. Go to **Extensions** (Cmd/Ctrl+Shift+X)
2. Find **Agent Studio**
3. Click the **gear icon** → **Uninstall**
4. Reload VS Code

Your `.agent.md` files remain in your workspace (they're just markdown files). You can still edit them in any text editor.

## Troubleshooting Setup

**Q: Agent Studio doesn't appear in the sidebar?**

- Reload VS Code (Cmd/Ctrl+Shift+P → "Reload Window")
- Check if it installed (go to Extensions, search "Agent Studio")
- If it says "Install" instead of "Installed", the install didn't complete—try again

**Q: I don't see my existing agents?**

- Ensure your agent files are named `*.agent.md`
- Check they're in a monitored directory (workspace root or `agentStudio.agentDirectories`)
- Reload Agent Studio (click the icon, then click the settings gear → "Reload")

**Q: Tools and Skills aren't showing in the Capabilities inspector?**

- Verify directories are set in `agentStudio.toolDirectories` and `agentStudio.skillDirectories`
- Ensure tools/skills are properly registered (check file structure and naming conventions)
- Reload vs Code to refresh discovery

**Q: MCP servers aren't connecting?**

- Check that the MCP server is actually running and listening on the specified endpoint
- Test connectivity: `curl http://localhost:3000/mcp` (replace with your endpoint)
- Check for firewall or network issues
- Review the VS Code output panel (View → Output → "Agent Studio") for error messages

## Next Steps

With Agent Studio installed, you're ready to:

- **[Create Your First Agent](./getting-started.md)**: Follow the Getting Started guide
- **[Quick Start](./quick-start.md)**: 5-minute walkthrough
- **[Explore the Dashboard](./visual-dashboard.md)**: Learn all features

---

**[← Getting Started](./getting-started.md)** | **[Quick Start →](./quick-start.md)**
