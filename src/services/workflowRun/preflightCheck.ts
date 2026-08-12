import * as vscode from "vscode";
import { spawn } from "child_process";
import { workspaceContainsGitRepository } from "./gitWorkspaceCheck";

/**
 * Fase 9 — checks run once, right before launching a workflow, to catch problems that would
 * otherwise surface confusingly mid-run (for example, a CLI that silently never starts, or a
 * workspace where edits cannot be tracked by git at all).
 */
export interface PreflightResult {
  blockers: string[];
  warnings: string[];
}

function executableFor(mode: "cli-claude" | "cli-codex"): string {
  if (mode === "cli-codex") {
    return "codex";
  }
  const config = vscode.workspace.getConfiguration("agentStudio.cli");
  const claudeCommand = config.get<string>(
    "claudeCommand",
    "claude --permission-mode acceptEdits",
  );
  return claudeCommand.trim().split(/\s+/)[0] || "claude";
}

function checkCliAvailable(executable: string, cwd: string): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    const proc = spawn(executable, ["--version"], { cwd, shell: false });
    proc.on("error", () => finish(false));
    proc.on("exit", (code) => finish(code === 0));
    setTimeout(() => {
      if (!settled) {
        proc.kill();
        finish(false);
      }
    }, 5000);
  });
}

export async function runPreflightChecks(
  cwd: string,
  mode: "cli-claude" | "cli-codex",
): Promise<PreflightResult> {
  const blockers: string[] = [];
  const warnings: string[] = [];

  const executable = executableFor(mode);
  const cliAvailable = await checkCliAvailable(executable, cwd);
  if (!cliAvailable) {
    blockers.push(
      `CLI "${executable}" not found or failed to start. Install it, make sure it's on PATH, or ` +
        `adjust the agentStudio.cli.* settings.`,
    );
  }

  const containsGitRepository = await workspaceContainsGitRepository(cwd);
  if (!containsGitRepository) {
    warnings.push(
      "This workspace is not a git repository — changes agents make won't be tracked or easy to undo.",
    );
  }

  return { blockers, warnings };
}
