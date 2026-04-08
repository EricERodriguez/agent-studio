import * as path from "path";
import * as vscode from "vscode";
import matter from "gray-matter";
import type {
  AgentDefinition,
  CapabilityGraph,
  MCPServerRef,
  SkillRef,
  ToolRef,
} from "../domain/models";
import { getWorkspaceRoot } from "../infrastructure/fsUtils";

interface McpJsonShape {
  mcpServers?: Record<
    string,
    { command?: string; args?: string[]; env?: Record<string, string> }
  >;
  servers?: Record<
    string,
    { command?: string; args?: string[]; env?: Record<string, string> }
  >;
}

interface SkillFrontmatter {
  name?: string;
  description?: string;
}

function getUserMcpConfigPaths(): string[] {
  const home = process.env.HOME || process.env.USERPROFILE;
  const appData = process.env.APPDATA;

  if (!home && !appData) {
    return [];
  }

  const candidates = new Set<string>();

  if (process.platform === "linux" && home) {
    candidates.add(path.join(home, ".config", "Code", "User", "mcp.json"));
    candidates.add(
      path.join(home, ".config", "Code - Insiders", "User", "mcp.json"),
    );
  }

  if (process.platform === "darwin" && home) {
    candidates.add(
      path.join(
        home,
        "Library",
        "Application Support",
        "Code",
        "User",
        "mcp.json",
      ),
    );
    candidates.add(
      path.join(
        home,
        "Library",
        "Application Support",
        "Code - Insiders",
        "User",
        "mcp.json",
      ),
    );
  }

  if (process.platform === "win32" && appData) {
    candidates.add(path.join(appData, "Code", "User", "mcp.json"));
    candidates.add(path.join(appData, "Code - Insiders", "User", "mcp.json"));
  }

  return [...candidates];
}

async function loadMcpServersFromPath(
  mcpPath: string,
): Promise<
  | Record<
      string,
      { command?: string; args?: string[]; env?: Record<string, string> }
    >
  | undefined
> {
  try {
    const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(mcpPath));
    const json = JSON.parse(
      Buffer.from(bytes).toString("utf8"),
    ) as McpJsonShape;
    return json.servers || json.mcpServers || {};
  } catch {
    return undefined;
  }
}

function getUserSkillsPaths(): string[] {
  const home = process.env.HOME || process.env.USERPROFILE;
  const appData = process.env.APPDATA;

  if (!home && !appData) {
    return [];
  }

  const candidates = new Set<string>();

  if (process.platform === "linux" && home) {
    candidates.add(path.join(home, ".agents", "skills"));
    candidates.add(
      path.join(home, ".config", "Code", "User", "prompts", "skills"),
    );
    candidates.add(
      path.join(
        home,
        ".config",
        "Code - Insiders",
        "User",
        "prompts",
        "skills",
      ),
    );
  }

  if (process.platform === "darwin" && home) {
    candidates.add(path.join(home, ".agents", "skills"));
    candidates.add(
      path.join(
        home,
        "Library",
        "Application Support",
        "Code",
        "User",
        "prompts",
        "skills",
      ),
    );
    candidates.add(
      path.join(
        home,
        "Library",
        "Application Support",
        "Code - Insiders",
        "User",
        "prompts",
        "skills",
      ),
    );
  }

  if (process.platform === "win32" && appData) {
    candidates.add(path.join(appData, "Code", "User", "prompts", "skills"));
    candidates.add(
      path.join(appData, "Code - Insiders", "User", "prompts", "skills"),
    );
  }

  return [...candidates];
}

function getWorkspaceSkillsPaths(): string[] {
  const root = getWorkspaceRoot();
  if (!root) {
    return [];
  }

  return [
    path.join(root, ".agents", "skills"),
    path.join(root, ".github", "skills"),
  ];
}

function extractTitle(content: string): string | undefined {
  const firstHeading = content.match(/^#\s+(.+)$/m);
  return firstHeading?.[1]?.trim();
}

async function loadSkillFromDirectory(
  skillDirPath: string,
  fallbackId: string,
): Promise<SkillRef | undefined> {
  const skillFilePath = path.join(skillDirPath, "SKILL.md");

  try {
    const bytes = await vscode.workspace.fs.readFile(
      vscode.Uri.file(skillFilePath),
    );
    const content = Buffer.from(bytes).toString("utf8");
    const parsed = matter(content);
    const frontmatter = (parsed.data || {}) as SkillFrontmatter;

    const label =
      frontmatter.name?.trim() || extractTitle(parsed.content) || fallbackId;
    const description = frontmatter.description?.trim();

    return {
      id: fallbackId,
      label,
      description,
    };
  } catch {
    return {
      id: fallbackId,
      label: fallbackId,
    };
  }
}

async function loadSkillsFromPath(pathToScan: string): Promise<SkillRef[]> {
  try {
    const entries = await vscode.workspace.fs.readDirectory(
      vscode.Uri.file(pathToScan),
    );
    const skills = await Promise.all(
      entries
        .filter(([, fileType]) => fileType === vscode.FileType.Directory)
        .map(([name]) =>
          loadSkillFromDirectory(path.join(pathToScan, name), name),
        ),
    );

    return skills.filter((skill): skill is SkillRef => Boolean(skill));
  } catch {
    return [];
  }
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

    const installedSkills = await Promise.all(
      [...new Set([...getWorkspaceSkillsPaths(), ...getUserSkillsPaths()])].map(
        (skillPath) => loadSkillsFromPath(skillPath),
      ),
    );

    for (const skillsFromPath of installedSkills) {
      for (const skill of skillsFromPath) {
        const existing = map.get(skill.id);
        map.set(skill.id, {
          id: skill.id,
          label:
            existing?.label && existing.label !== existing.id
              ? existing.label
              : skill.label,
          description: existing?.description || skill.description,
        });
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
    const candidatePaths = [
      ...(root
        ? [path.join(root, "mcp.json"), path.join(root, ".vscode", "mcp.json")]
        : []),
      ...getUserMcpConfigPaths(),
    ];

    for (const mcpPath of candidatePaths) {
      const servers = await loadMcpServersFromPath(mcpPath);
      if (!servers) {
        continue;
      }

      for (const [id, server] of Object.entries(servers)) {
        discovered.set(id, {
          id,
          label: id,
          command: server.command,
          args: server.args,
          env: server.env,
        });
      }
    }

    return [...discovered.values()].sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  }

  async buildCapabilityGraph(
    agents: AgentDefinition[],
  ): Promise<CapabilityGraph> {
    const [tools, skills, mcpServers] = await Promise.all([
      this.discoverTools(agents),
      this.discoverSkills(agents),
      this.discoverMcpServers(agents),
    ]);

    const usage = {
      tools: {} as Record<string, string[]>,
      skills: {} as Record<string, string[]>,
      mcpServers: {} as Record<string, string[]>,
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
      usage,
    };
  }
}
