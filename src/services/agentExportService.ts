import matter from "gray-matter";
import * as path from "path";
import * as vscode from "vscode";
import type { AgentDefinition, AgentProvider } from "../domain/models";
import { ensureDirectory, getHomeDir, toAgentId } from "../infrastructure/fsUtils";

export const AGENT_PROVIDER_LABELS: Record<AgentProvider, string> = {
  claude: "Claude Code",
  codex: "OpenAI Codex (AGENTS.md)",
  antigravity: "Google Antigravity",
};

const AGENTS_MD_START = (id: string) => `<!-- agent-studio:start:${id} -->`;
const AGENTS_MD_END = (id: string) => `<!-- agent-studio:end:${id} -->`;

/**
 * Converts a canonical `.agent.md` definition into the file layout each
 * external AI tool expects, so the same agent can be driven from Claude
 * Code, the OpenAI Codex CLI or Google Antigravity without hand-editing.
 */
export class AgentExportService {
  async exportAgent(
    agent: AgentDefinition,
    providers: AgentProvider[],
    workspaceRoot: string,
  ): Promise<{
    written: Array<{ provider: AgentProvider; path: string }>;
    skipped: Array<{ provider: AgentProvider; reason: string }>;
  }> {
    const unique = [...new Set(providers)];
    const written: Array<{ provider: AgentProvider; path: string }> = [];
    const skipped: Array<{ provider: AgentProvider; reason: string }> = [];
    const isGlobal = agent.sourceScope === "global";
    const home = getHomeDir();

    for (const provider of unique) {
      switch (provider) {
        case "claude": {
          const base =
            isGlobal && home
              ? path.join(home, ".claude", "agents")
              : path.join(workspaceRoot, ".claude", "agents");
          written.push({
            provider,
            path: await this.exportSubagentStyle(agent, base),
          });
          break;
        }
        case "antigravity": {
          const base =
            isGlobal && home
              ? path.join(home, ".antigravity", "agents")
              : path.join(workspaceRoot, ".antigravity", "agents");
          written.push({
            provider,
            path: await this.exportSubagentStyle(agent, base),
          });
          break;
        }
        case "codex": {
          if (isGlobal) {
            skipped.push({
              provider,
              reason:
                "Codex has no global agents file convention; export the agent as repository-scoped to write AGENTS.md.",
            });
            break;
          }
          written.push({
            provider,
            path: await this.exportToAgentsMd(agent, workspaceRoot),
          });
          break;
        }
      }
    }

    return { written, skipped };
  }

  /**
   * Claude Code subagents and Antigravity agents both use a markdown file
   * per agent with `name`/`description`/`tools` frontmatter and the
   * instructions as the body, so a single writer covers both.
   */
  private async exportSubagentStyle(
    agent: AgentDefinition,
    targetDir: string,
  ): Promise<string> {
    await ensureDirectory(targetDir);
    const id = toAgentId(agent.name);
    const filePath = path.join(targetDir, `${id}.md`);

    const frontmatter: Record<string, unknown> = {
      name: agent.name,
      description: agent.description || undefined,
      tools: agent.capabilities.tools.map((t) => t.id),
    };
    const sanitized = Object.fromEntries(
      Object.entries(frontmatter).filter(
        ([, value]) =>
          value !== undefined && !(Array.isArray(value) && value.length === 0),
      ),
    );

    const content = matter.stringify(
      agent.instructions.trim() + "\n",
      sanitized,
    );

    await vscode.workspace.fs.writeFile(
      vscode.Uri.file(filePath),
      Buffer.from(content, "utf8"),
    );

    return filePath;
  }

  /**
   * Codex CLI (and other agentic CLIs) read repo-level instructions from a
   * root `AGENTS.md` file rather than per-agent files, so each agent is
   * written as a marked, idempotent section that can be regenerated.
   */
  private async exportToAgentsMd(
    agent: AgentDefinition,
    workspaceRoot: string,
  ): Promise<string> {
    const filePath = path.join(workspaceRoot, "AGENTS.md");
    const id = toAgentId(agent.name);

    let existing = "";
    try {
      const buffer = await vscode.workspace.fs.readFile(
        vscode.Uri.file(filePath),
      );
      existing = Buffer.from(buffer).toString("utf8");
    } catch {
      existing = "# Repository Agents\n\nAgents managed by Agent Studio for use with Codex.\n";
    }

    const block = [
      AGENTS_MD_START(id),
      `## ${agent.name}`,
      "",
      agent.description ? `${agent.description}\n` : "",
      agent.instructions.trim(),
      AGENTS_MD_END(id),
    ]
      .filter((line) => line !== "")
      .join("\n");

    const startMarker = AGENTS_MD_START(id);
    const endMarker = AGENTS_MD_END(id);
    const startIndex = existing.indexOf(startMarker);
    const endIndex = existing.indexOf(endMarker);

    let nextContent: string;
    if (startIndex !== -1 && endIndex !== -1) {
      nextContent =
        existing.slice(0, startIndex) +
        block +
        existing.slice(endIndex + endMarker.length);
    } else {
      nextContent = `${existing.trimEnd()}\n\n${block}\n`;
    }

    await vscode.workspace.fs.writeFile(
      vscode.Uri.file(filePath),
      Buffer.from(nextContent, "utf8"),
    );

    return filePath;
  }
}
