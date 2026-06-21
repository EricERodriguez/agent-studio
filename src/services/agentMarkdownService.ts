import matter from "gray-matter";
import type {
  AgentDefinition,
  AgentProvider,
  MCPServerRef,
  SkillRef,
  ToolRef,
} from "../domain/models";
import { toAgentId } from "../infrastructure/fsUtils";

const KNOWN_PROVIDERS: AgentProvider[] = ["claude", "codex", "antigravity"];

interface AgentFrontmatter {
  name?: string;
  description?: string;
  role?: string;
  tools?: string | Array<string | Record<string, unknown>>;
  skills?: Array<string | Record<string, unknown>>;
  mcp?: Array<string | Record<string, unknown>>;
  handoffs?: Array<string | Record<string, unknown>>;
  tags?: string[];
  context?: string;
  providers?: string[];
  model?: string;
}

export class AgentMarkdownService {
  private buildDefaultHandoff(agent: string, label?: string) {
    const resolvedLabel = label || agent;
    return {
      agent,
      label: resolvedLabel,
      prompt: `Delegate to ${resolvedLabel} when this task needs their expertise.`,
      send: true,
    };
  }

  // Falls back to a flat key: value frontmatter reader when the YAML engine
  // rejects the block. Real-world Claude Code subagent files often contain an
  // unquoted description with ": " in it (e.g. "Read-only: never modifies..."),
  // which is invalid strict YAML but otherwise a simple, single-level frontmatter.
  private parseLenientFrontmatter(content: string): {
    data: Record<string, unknown>;
    content: string;
  } {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!match) {
      return { data: {}, content };
    }

    const [, frontmatterBlock, body] = match;
    const data: Record<string, unknown> = {};
    for (const line of frontmatterBlock.split(/\r?\n/)) {
      const lineMatch = line.match(/^([A-Za-z0-9_-]+):\s?(.*)$/);
      if (!lineMatch) {
        continue;
      }
      const [, key, rawValue] = lineMatch;
      data[key] = rawValue.trim();
    }

    return { data, content: body };
  }

  private pruneUndefined<T>(value: T): T | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (Array.isArray(value)) {
      const cleaned = value
        .map((item) => this.pruneUndefined(item))
        .filter((item) => item !== undefined);
      return cleaned as T;
    }

    if (value && typeof value === "object") {
      const cleanedEntries = Object.entries(value)
        .map(
          ([key, nestedValue]) =>
            [key, this.pruneUndefined(nestedValue)] as const,
        )
        .filter(([, nestedValue]) => nestedValue !== undefined);
      return Object.fromEntries(cleanedEntries) as T;
    }

    return value;
  }

  parse(content: string): AgentDefinition {
    let parsed: { data: Record<string, unknown>; content: string };
    try {
      const result = matter(content);
      parsed = { data: result.data || {}, content: result.content };
    } catch {
      parsed = this.parseLenientFrontmatter(content);
    }
    const fm = (parsed.data || {}) as AgentFrontmatter;

    const name = fm.name?.trim() || "Untitled Agent";
    const instructions = parsed.content.trim();

    const toolsList = Array.isArray(fm.tools)
      ? fm.tools
      : typeof fm.tools === "string"
        ? fm.tools
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        : [];

    const tools: ToolRef[] = toolsList.map((item) => {
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
      const id = String(item.id || item.name || item.agent || "mcp-server");
      const label = String(item.label || item.name || id);
      return {
        id,
        label,
        command: item.command as string | undefined,
        args: item.args as string[] | undefined,
        env: item.env as Record<string, string> | undefined,
        autoRunMCP: (item.autoRunMCP as boolean) || false,
      };
    });

    const handoffs = (fm.handoffs || []).map((item) => {
      if (typeof item === "string") {
        return this.buildDefaultHandoff(item, item);
      }
      const agent = String(
        (item as any).agent || (item as any).id || (item as any).name || "",
      );
      const label = String(
        (item as any).label || (item as any).name || agent || "",
      );
      const defaults = this.buildDefaultHandoff(agent, label);
      const prompt =
        ((item as any).prompt as string | undefined) || defaults.prompt;
      const send =
        typeof (item as any).send === "boolean"
          ? ((item as any).send as boolean)
          : defaults.send;
      return { agent, label, prompt, send };
    });

    const providers = (fm.providers || []).filter((p): p is AgentProvider =>
      KNOWN_PROVIDERS.includes(p as AgentProvider),
    );

    return {
      id: toAgentId(name),
      name,
      description: fm.description || "",
      role: fm.role,
      instructions,
      context: fm.context,
      handoffs,
      tags: fm.tags || [],
      capabilities: {
        tools,
        skills,
        mcpServers,
      },
      providers: providers.length > 0 ? providers : undefined,
    };
  }

  generate(agent: AgentDefinition): string {
    const data: Record<string, unknown> = {
      name: agent.name,
      description: agent.description,
      role: agent.role,
      tools: agent.capabilities.tools.map((t) => t.id),
      skills: agent.capabilities.skills,
      mcp: agent.capabilities.mcpServers.map((m) => ({
        id: m.id,
        label: m.label,
        command: m.command,
        args: m.args,
        env: m.env,
        autoRunMCP: m.autoRunMCP,
      })),
      handoffs: agent.handoffs.map((h) => {
        const defaults = this.buildDefaultHandoff(h.agent, h.label);
        const out: Record<string, unknown> = {
          agent: h.agent,
          label: h.label || defaults.label,
          prompt: h.prompt || defaults.prompt,
          send: typeof h.send === "boolean" ? h.send : defaults.send,
        };
        return out;
      }),
      tags: agent.tags,
      context: agent.context,
      providers: agent.providers,
    };

    const sanitized = Object.fromEntries(
      Object.entries(data).filter(([, value]) => {
        if (Array.isArray(value)) {
          return value.length > 0;
        }
        return value !== undefined && value !== "";
      }),
    );

    return matter.stringify(
      agent.instructions.trim() + "\n",
      this.pruneUndefined(sanitized) as Record<string, unknown>,
    );
  }
}
