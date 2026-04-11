# Visibility: Tools, Skills & MCP

Agent Studio makes your agent infrastructure transparent through a unified Capabilities layer. Understand what's available, who can use it, and where gaps exist.

## Why Visibility Matters

In complex agent systems, you eventually ask:

- "Does agent X have access to tool Y?"
- "Which agents can make API calls?"
- "Is there a tool we registered but nobody uses?"
- "Why didn't the workflow find the right capability?"

Agent Studio answers these instantly.

## Tools Inspector

Discover and manage all tools available to your agents.

**What's shown:**

- **Tool name and description**: Full details from tool registration
- **Agent assignments**: Which agents have this tool in their capabilities
- **Usage count**: How many agents use this tool (high = critical, low = maybe deprecated)
- **Last modified**: When this tool was last registered or updated
- **Type**: Built-in, custom, external
- **Category**: API, database, search, data-transform, etc.

**Actions:**

- Click a tool to see all agents that use it
- Pin frequently-used tools for quick access
- Search by tool name or category
- Filter by agent or by type (built-ins only, custom only, etc.)

**Example Usage:**
You're building a new agent and want to see what API tools are available. Filter by category "API", skim the list, and see that 3 other agents already use `fetch_http` and 2 use `call_rest_api`. You pick one that's proven and add it to your agent.

## Skills Inspector

Manage shared knowledge bases and instruction sets.

**What's shown:**

- **Skill name and description**: Purpose and scope
- **Related agents**: Which agents inherit this skill
- **Skill path**: Where the `.skills` directory lives in your workspace
- **File count**: How many files contribute to this skill
- **Last synced**: When Agent Studio last indexed this skill
- **Tags**: Organization labels you assign

**Actions:**

- Browse skills by category or search by name
- View agents using each skill
- Create a new skill from template
- Link/unlink skills to specific agents
- Export skill as sharable module

**Example Usage:**
Your team wants all agents to understand your company's data schema. You create a "CompanyDataModel" skill with `.md` files explaining tables, relationships, and query patterns. Assign it to all agents. Now when they write queries, they have consistent context.

## MCP Servers Registry

Monitor and configure MCP (Model Context Protocol) servers connected to Agent Studio.

**What's shown:**

- **Server name and URL**: Connection details
- **Connection status**: Active, connecting, error, disabled
- **Resource types**: What this server provides (tools, prompts, resources)
- **Agent bindings**: Which agents can access this server
- **Availability**: Uptime, last health check
- **Latency**: Average response time

**Actions:**

- Click to view server details and supported resources
- Enable/disable servers without restarting VS Code
- Test connection with one click
- View real-time health status
- Configure authentication/credentials per server
- Bind or unbind from specific agents

**Example Usage:**
Your team runs an MCP server for a proprietary API. You register it in Agent Studio. All agents can see it's available. You assign it specifically to the "APIClient" and "DataFetcher" agents. Later, an error appears—Agent Studio shows the server is down. You click "reconnect" and it's back online.

## Unified Capability View

See your entire infrastructure at once.

**The Matrix**

- **Rows**: Agents in your workspace
- **Columns**: Tools, Skills, MCP servers
- **Cells**: Green (has access), Gray (not assigned), Red (requested but unavailable)

This view is especially useful for:

- **Auditing access**: Verify each agent has only the tools it needs
- **Onboarding**: New engineers can see the full capability landscape
- **Planning**: Identify where you need new tools or skills
- **Security**: Ensure sensitive tools aren't over-assigned

**Filtering**

- Show only agents with a specific tag
- Show only tools from a specific category
- Show only high-risk capabilities
- Show orphaned tools (assigned to no agents)

## Gap Detection

Agent Studio automatically identifies capability mismatches.

**Warnings you'll see:**

**Red Flag: Missing Capability**

- An agent tries to use a tool/skill it doesn't have assigned
- Agent Studio flags it: "Agent 'DataAnalyst' references 'sql_query' but isn't assigned it"
- One click to assign the capability

**Yellow Flag: Orphaned Tool**

- A tool exists but no agent uses it
- Might be outdated; candidate for deprecation
- Hover to see when it was last used

**Blue Flag: Over-Assignment**

- An agent has 15+ capabilities; might be doing too much
- Suggestion: consider splitting into multiple agents
- Not a hard rule; just a signal

**Green Flag: Healthy**

- Agent has clear, cohesive set of capabilities
- All assigned tools are actively used
- Well-scoped responsibilities

## Registering New Tools and Skills

**From Within Agent Studio:**

1. Open Capabilities Inspector → Tools section
2. Click "Register new tool"
3. Enter: name, description, category, endpoint/implementation
4. Confirm and it appears in the registry immediately
5. Assign to agents who need it

**Via VS Code Settings:**

```json
{
  "agentStudio.toolDirectories": [
    "${workspaceFolder}/tools",
    "${workspaceFolder}/libs/custom-tools"
  ],
  "agentStudio.skillDirectories": [
    "${workspaceFolder}/.skills",
    "/shared/team-skills"
  ]
}
```

## Integrating MCP Servers

**Connect an MCP server:**

1. Ensure the MCP server is running (locally or remote)
2. Go to Agent Studio settings
3. Add to `agentStudio.mcpServers`:
   ```json
   {
     "name": "my-api",
     "endpoint": "http://localhost:3000/mcp",
     "auth": "api-key",
     "credentials": "${secret:MCP_API_KEY}"
   }
   ```
4. Agent Studio auto-discovers resources and shows them in the MCP inspector
5. Assign to agents via the Capabilities panel

## Audit Trail

Who changed what and when.

**For each tool, skill, or MCP server:**

- View assignments history
- See which editor made the change
- Timestamp of every change
- Revert to previous state with one click

This is especially useful for:

- **Security**: Understand who added high-risk tools
- **Debugging**: Know when a capability was removed
- **Team accountability**: Track tool/skill governance

---

**[← Visual Dashboard](/visual-dashboard)** | **[Explore Features →](/features)**
