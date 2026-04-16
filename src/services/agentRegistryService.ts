import * as path from "path";
import * as vscode from "vscode";
import type { AgentDefinition } from "../domain/models";
import { AgentMarkdownService } from "./agentMarkdownService";
import {
  ensureDirectory,
  fileNameWithoutExt,
  getWorkspaceRoot,
  toAgentId,
} from "../infrastructure/fsUtils";

export class AgentRegistryService {
  private readonly markdownService = new AgentMarkdownService();

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

    const uris = await Promise.all(
      [...new Set([...defaultGlobs, ...configuredGlobs])].map((glob) =>
        vscode.workspace.findFiles(glob),
      ),
    );
    const files = uris.flat();

    const agents: AgentDefinition[] = [];
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
        agents.push(parsed);
      } catch (error) {
        console.warn(`Agent Studio failed to parse ${uri.fsPath}`, error);
      }
    }

    return agents.sort((a, b) => a.name.localeCompare(b.name));
  }

  async loadAgent(agentPath: string): Promise<AgentDefinition> {
    const content = await vscode.workspace.fs.readFile(
      vscode.Uri.file(agentPath),
    );
    const parsed = this.markdownService.parse(
      Buffer.from(content).toString("utf8"),
    );
    parsed.sourcePath = agentPath;
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

    const folder = path.join(root, ".github", "agents");
    await ensureDirectory(folder);

    const fileName = `${toAgentId(agent.name)}.agent.md`;
    const agentPath = agent.sourcePath || path.join(folder, fileName);

    const serialized = this.markdownService.generate({
      ...agent,
      id: toAgentId(agent.name),
    });
    await vscode.workspace.fs.writeFile(
      vscode.Uri.file(agentPath),
      Buffer.from(serialized, "utf8"),
    );

    return {
      ...agent,
      id: toAgentId(agent.name),
      sourcePath: agentPath,
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
    };
    return this.saveAgent(clone);
  }
}
