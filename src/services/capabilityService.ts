import * as path from "path";
import * as vscode from "vscode";
import type { AgentDefinition, CapabilityGraph, MCPServerRef, SkillRef, ToolRef } from "../domain/models";
import { getWorkspaceRoot } from "../infrastructure/fsUtils";

interface McpJsonShape {
  servers?: Record<string, { command?: string; args?: string[]; env?: Record<string, string> }>;
}

export class CapabilityService {
  async discoverTools(agents: AgentDefinition[]): Promise<ToolRef[]> {
    const map = new Map<string, ToolRef>();
    for (const agent of agents) {
      for (const tool of agent.capabilities.tools) {
        map.set(tool.id, tool);
      }
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }

  async discoverSkills(agents: AgentDefinition[]): Promise<SkillRef[]> {
    const map = new Map<string, SkillRef>();
    for (const agent of agents) {
      for (const skill of agent.capabilities.skills) {
        map.set(skill.id, skill);
      }
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }

  async discoverMcpServers(agents: AgentDefinition[]): Promise<MCPServerRef[]> {
    const discovered = new Map<string, MCPServerRef>();
    for (const agent of agents) {
      for (const mcp of agent.capabilities.mcpServers) {
        discovered.set(mcp.id, mcp);
      }
    }

    const root = getWorkspaceRoot();
    if (root) {
      const mcpPath = path.join(root, "mcp.json");
      try {
        const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(mcpPath));
        const json = JSON.parse(Buffer.from(bytes).toString("utf8")) as McpJsonShape;
        for (const [id, server] of Object.entries(json.servers || {})) {
          discovered.set(id, {
            id,
            label: id,
            command: server.command,
            args: server.args,
            env: server.env
          });
        }
      } catch {
        // mcp.json is optional.
      }
    }

    return [...discovered.values()].sort((a, b) => a.label.localeCompare(b.label));
  }

  async buildCapabilityGraph(agents: AgentDefinition[]): Promise<CapabilityGraph> {
    const [tools, skills, mcpServers] = await Promise.all([
      this.discoverTools(agents),
      this.discoverSkills(agents),
      this.discoverMcpServers(agents)
    ]);

    const usage = {
      tools: {} as Record<string, string[]>,
      skills: {} as Record<string, string[]>,
      mcpServers: {} as Record<string, string[]>
    };

    for (const agent of agents) {
      for (const tool of agent.capabilities.tools) {
        usage.tools[tool.id] = usage.tools[tool.id] || [];
        usage.tools[tool.id].push(agent.id);
      }
      for (const skill of agent.capabilities.skills) {
        usage.skills[skill.id] = usage.skills[skill.id] || [];
        usage.skills[skill.id].push(agent.id);
      }
      for (const mcp of agent.capabilities.mcpServers) {
        usage.mcpServers[mcp.id] = usage.mcpServers[mcp.id] || [];
        usage.mcpServers[mcp.id].push(agent.id);
      }
    }

    return {
      tools,
      skills,
      mcpServers,
      usage
    };
  }
}
