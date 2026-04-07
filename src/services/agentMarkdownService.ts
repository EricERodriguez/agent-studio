import matter from "gray-matter";
import type {
  AgentDefinition,
  MCPServerRef,
  SkillRef,
  ToolRef,
} from "../domain/models";
import { toAgentId } from "../infrastructure/fsUtils";

interface AgentFrontmatter {
  name?: string;
  description?: string;
  role?: string;
  tools?: Array<string | Record<string, unknown>>;
  skills?: Array<string | Record<string, unknown>>;
  mcp?: Array<string | Record<string, unknown>>;
  handoffs?: string[];
  tags?: string[];
  context?: string;
}

export class AgentMarkdownService {
  parse(content: string): AgentDefinition {
    const parsed = matter(content);
    const fm = (parsed.data || {}) as AgentFrontmatter;

    const name = fm.name?.trim() || "Untitled Agent";
    const instructions = parsed.content.trim();

    const tools: ToolRef[] = (fm.tools || []).map((item) => {
      if (typeof item === "string") {
        return { id: item, label: item, kind: "built-in" };
      }
      const id = String(item.id || item.name || "tool");
      const label = String(item.label || item.name || id);
      const kind = (item.kind as ToolRef["kind"]) || "built-in";
      return {
        id,
        label,
        kind,
        description: item.description as string | undefined,
      };
    });

    const skills: SkillRef[] = (fm.skills || []).map((item) => {
      if (typeof item === "string") {
        return { id: item, label: item };
      }
      const id = String(item.id || item.name || "skill");
      const label = String(item.label || item.name || id);
      return { id, label, description: item.description as string | undefined };
    });

    const mcpServers: MCPServerRef[] = (fm.mcp || []).map((item) => {
      if (typeof item === "string") {
        return { id: item, label: item };
      }
      const id = String(item.id || item.name || "mcp-server");
      const label = String(item.label || item.name || id);
      return {
        id,
        label,
        command: item.command as string | undefined,
        args: item.args as string[] | undefined,
        env: item.env as Record<string, string> | undefined,
      };
    });

    return {
      id: toAgentId(name),
      name,
      description: fm.description || "",
      role: fm.role,
      instructions,
      context: fm.context,
      handoffs: fm.handoffs || [],
      tags: fm.tags || [],
      capabilities: {
        tools,
        skills,
        mcpServers,
      },
    };
  }

  generate(agent: AgentDefinition): string {
    const data: Record<string, unknown> = {
      name: agent.name,
      description: agent.description,
      role: agent.role,
      tools: agent.capabilities.tools,
      skills: agent.capabilities.skills,
      mcp: agent.capabilities.mcpServers,
      handoffs: agent.handoffs,
      tags: agent.tags,
      context: agent.context,
    };

    const sanitized = Object.fromEntries(
      Object.entries(data).filter(([, value]) => {
        if (Array.isArray(value)) {
          return value.length > 0;
        }
        return value !== undefined && value !== "";
      }),
    );

    return matter.stringify(agent.instructions.trim() + "\n", sanitized);
  }
}
