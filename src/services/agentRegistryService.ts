import * as path from "path";
import * as vscode from "vscode";
import type { AgentDefinition, AgentScope } from "../domain/models";
import { AgentMarkdownService } from "./agentMarkdownService";
import {
  ensureDirectory,
  fileNameWithoutExt,
  getGlobalAgentsRoot,
  getWorkspaceRoot,
  toAgentId,
} from "../infrastructure/fsUtils";

export class AgentRegistryService {
  private readonly markdownService = new AgentMarkdownService();

  private inferScopeFromPath(
    agentPath: string,
    workspaceRoot?: string,
  ): AgentScope {
    if (workspaceRoot && agentPath.startsWith(workspaceRoot)) {
      return "repository";
    }

    return "global";
  }

  private async collectAgentFilesFromDirectory(
    dirPath: string,
  ): Promise<vscode.Uri[]> {
    try {
      const entries = await vscode.workspace.fs.readDirectory(
        vscode.Uri.file(dirPath),
      );
      const files = await Promise.all(
        entries.map(async ([name, fileType]) => {
          const absolutePath = path.join(dirPath, name);
          if (fileType === vscode.FileType.Directory) {
            return this.collectAgentFilesFromDirectory(absolutePath);
          }
          if (fileType === vscode.FileType.File && /\.agent\.md$/i.test(name)) {
            return [vscode.Uri.file(absolutePath)];
          }
          return [] as vscode.Uri[];
        }),
      );

      return files.flat();
    } catch {
      return [];
    }
  }

  async discoverAgents(): Promise<AgentDefinition[]> {
    const root = getWorkspaceRoot();
    if (!root) {
      return [];
    }

    const configuredPaths = vscode.workspace
      .getConfiguration("agentStudio")
      .get<string[]>("agentPaths", [".github/agents"]);

    const defaultGlobs = [
      ".github/agents/**/*.agent.md",
      ".github/chatmodes/**/*.agent.md",
    ];
    const configuredGlobs = configuredPaths.map(
      (base) => `${base.replace(/\\/g, "/")}/**/*.agent.md`,
    );

    const workspaceUris = await Promise.all(
      [...new Set([...defaultGlobs, ...configuredGlobs])].map((glob) =>
        vscode.workspace.findFiles(glob),
      ),
    );
    const globalRoot = getGlobalAgentsRoot();
    const globalFiles = globalRoot
      ? await this.collectAgentFilesFromDirectory(globalRoot)
      : [];
    const files = [...globalFiles, ...workspaceUris.flat()];

    const agentsById = new Map<string, AgentDefinition>();
    for (const uri of files) {
      try {
        const buffer = await vscode.workspace.fs.readFile(uri);
        const text = Buffer.from(buffer).toString("utf8");
        const parsed = this.markdownService.parse(text);
        // Basic validation: surface common frontmatter shapes that should be migrated
        try {
          const matter = await import("gray-matter");
          const raw = matter.default(text);
          const fm = raw.data as Record<string, unknown>;
          if (fm.tools && Array.isArray(fm.tools)) {
            const nonStrings = (fm.tools as any[]).filter(
              (t) => typeof t !== "string",
            );
            if (nonStrings.length > 0) {
              console.warn(
                `${uri.fsPath}: frontmatter 'tools' contains non-string entries; consider migrating to an array of tool ids.`,
              );
            }
          }
          if (fm.handoffs && Array.isArray(fm.handoffs)) {
            const nonObjects = (fm.handoffs as any[]).filter(
              (h) => typeof h !== "object",
            );
            if (nonObjects.length > 0) {
              // strings are accepted but we encourage object format; surface as info
              console.info(
                `${uri.fsPath}: frontmatter 'handoffs' contains string entries; they will be migrated to explicit handoff objects.`,
              );
            }
          }
        } catch (e) {
          // ignore validation failures
        }
        parsed.id = toAgentId(parsed.name || fileNameWithoutExt(uri.fsPath));
        parsed.sourcePath = uri.fsPath;
        parsed.sourceScope = this.inferScopeFromPath(uri.fsPath, root);
        agentsById.set(parsed.id, parsed);
      } catch (error) {
        console.warn(`Agent Studio failed to parse ${uri.fsPath}`, error);
      }
    }

    return [...agentsById.values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }

  async loadAgent(agentPath: string): Promise<AgentDefinition> {
    const content = await vscode.workspace.fs.readFile(
      vscode.Uri.file(agentPath),
    );
    const parsed = this.markdownService.parse(
      Buffer.from(content).toString("utf8"),
    );
    parsed.sourcePath = agentPath;
    parsed.sourceScope = this.inferScopeFromPath(agentPath, getWorkspaceRoot());
    return parsed;
  }

  async saveAgent(agent: AgentDefinition): Promise<AgentDefinition> {
    const root = getWorkspaceRoot();
    if (!root) {
      throw new Error("No workspace opened.");
    }

    if (!agent.name.trim()) {
      throw new Error("Agent name is required.");
    }
    if (!agent.instructions.trim()) {
      throw new Error("Agent instructions are required.");
    }

    const targetScope = agent.sourceScope || "repository";
    const globalRoot = getGlobalAgentsRoot();
    const folder =
      targetScope === "global"
        ? globalRoot
        : path.join(root, ".github", "agents");

    if (!folder) {
      throw new Error("Global agents folder is not available on this system.");
    }

    await ensureDirectory(folder);

    const fileName = `${toAgentId(agent.name)}.agent.md`;
    const agentPath = path.join(folder, fileName);
    const previousPath = agent.sourcePath;

    // Attempt to preserve existing frontmatter arrays only when fields are
    // absent in the incoming payload. If a field is present but empty, treat
    // it as an explicit user action (for example, clearing all handoffs).
    try {
      const existing = await vscode.workspace.fs
        .readFile(vscode.Uri.file(agentPath))
        .then((b) => Buffer.from(b).toString("utf8"))
        .catch(() => null);
      if (existing) {
        try {
          const parsedExisting = this.markdownService.parse(existing);
          const incoming = agent as unknown as Record<string, unknown>;
          const incomingCapabilities =
            (incoming.capabilities as Record<string, unknown> | undefined) ||
            undefined;
          const hasIncomingMcp = Boolean(
            incomingCapabilities &&
            Object.prototype.hasOwnProperty.call(
              incomingCapabilities,
              "mcpServers",
            ),
          );
          const hasIncomingSkills = Boolean(
            incomingCapabilities &&
            Object.prototype.hasOwnProperty.call(
              incomingCapabilities,
              "skills",
            ),
          );
          const hasIncomingHandoffs = Object.prototype.hasOwnProperty.call(
            incoming,
            "handoffs",
          );

          if (
            !hasIncomingMcp &&
            parsedExisting.capabilities?.mcpServers &&
            parsedExisting.capabilities.mcpServers.length > 0
          ) {
            agent.capabilities = {
              ...agent.capabilities,
              mcpServers: parsedExisting.capabilities.mcpServers,
            };
          }
          if (
            !hasIncomingSkills &&
            parsedExisting.capabilities?.skills &&
            parsedExisting.capabilities.skills.length > 0
          ) {
            agent.capabilities = {
              ...agent.capabilities,
              skills: parsedExisting.capabilities.skills,
            };
          }
          if (
            !hasIncomingHandoffs &&
            parsedExisting.handoffs &&
            parsedExisting.handoffs.length > 0
          ) {
            agent.handoffs = parsedExisting.handoffs;
          }
        } catch (e) {
          // ignore parse/merge errors
        }
      }
    } catch (e) {
      // ignore filesystem read errors
    }

    // Debug: log full incoming agent payload to help diagnose missing fields
    try {
      // eslint-disable-next-line no-console
      console.log(
        "[AgentRegistryService] saveAgent payload: ",
        JSON.stringify(agent, null, 2),
      );
    } catch {}

    const serialized = this.markdownService.generate({
      ...agent,
      id: toAgentId(agent.name),
    });

    try {
      // eslint-disable-next-line no-console
      console.log(
        "[AgentRegistryService] serialized agent content:\n",
        serialized,
      );
    } catch {}
    await vscode.workspace.fs.writeFile(
      vscode.Uri.file(agentPath),
      Buffer.from(serialized, "utf8"),
    );

    try {
      const written = await vscode.workspace.fs.readFile(
        vscode.Uri.file(agentPath),
      );
      const writtenText = Buffer.from(written).toString("utf8");
      // eslint-disable-next-line no-console
      console.log(
        "[AgentRegistryService] file written content:\n",
        writtenText,
      );
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(
        "[AgentRegistryService] failed to read back written file",
        e,
      );
    }

    if (previousPath && previousPath !== agentPath) {
      try {
        await vscode.workspace.fs.delete(vscode.Uri.file(previousPath), {
          useTrash: true,
        });
      } catch (error) {
        console.warn(
          `Agent Studio could not remove old agent file ${previousPath}`,
          error,
        );
      }
    }

    return {
      ...agent,
      id: toAgentId(agent.name),
      sourcePath: agentPath,
      sourceScope: targetScope,
    };
  }

  async deleteAgent(agent: AgentDefinition): Promise<void> {
    if (!agent.sourcePath) {
      throw new Error("Agent source file not found.");
    }
    await vscode.workspace.fs.delete(vscode.Uri.file(agent.sourcePath), {
      useTrash: true,
    });
  }

  async duplicateAgent(agent: AgentDefinition): Promise<AgentDefinition> {
    const clone: AgentDefinition = {
      ...agent,
      id: toAgentId(`${agent.name} copy`),
      name: `${agent.name} Copy`,
      sourcePath: undefined,
      sourceScope: agent.sourceScope,
    };
    return this.saveAgent(clone);
  }
}
