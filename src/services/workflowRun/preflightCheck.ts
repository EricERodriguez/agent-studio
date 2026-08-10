import * as vscode from "vscode";
import { spawn } from "child_process";

/**
 * Fase 9 — checks run once, right before launching a workflow, to catch problems that would
 * otherwise surface confusingly mid-run (a CLI that silently never starts, or agent edits mixed
 * in with pre-existing uncommitted changes with no way to tell them apart afterwards).
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

function runGit(args: string[], cwd: string): Promise<{ code: number; stdout: string }> {
  return new Promise((resolve) => {
    const proc = spawn("git", args, { cwd, shell: false });
    let stdout = "";
    proc.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString()));
    proc.on("error", () => resolve({ code: 1, stdout: "" }));
    proc.on("close", (code) => resolve({ code: code ?? 1, stdout }));
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

  const gitCheck = await runGit(["rev-parse", "--is-inside-work-tree"], cwd);
  const isGitRepo = gitCheck.code === 0 && gitCheck.stdout.trim() === "true";
  if (!isGitRepo) {
    warnings.push(
      "This workspace is not a git repository — changes agents make won't be tracked or easy to undo.",
    );
  } else {
    const statusCheck = await runGit(["status", "--porcelain"], cwd);
    const changedFiles = statusCheck.stdout.split("\n").filter((line) => line.trim().length > 0);
    if (changedFiles.length > 0) {
      warnings.push(
        `${changedFiles.length} uncommitted change(s) already in the workspace before this run starts.`,
      );
    }
  }

  return { blockers, warnings };
}
