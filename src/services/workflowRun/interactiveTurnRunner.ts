import * as vscode from "vscode";
import * as path from "path";

/**
 * Runs one agent turn as a real interactive CLI session — like SwarmForge's tmux-attached
 * sessions — instead of a one-shot invocation. The user asked for this explicitly (2026-08-09)
 * after using the one-shot design (docs/swarmforge-integration/02-arquitectura-motor-nativo.md):
 * they want to be able to give an agent feedback mid-task if needed, the same way SwarmForge's
 * roles stay attached and interactive rather than exiting after a single non-interactive answer.
 *
 * This also sidesteps the shell-injection class of risk from the one-shot design entirely: the
 * prompt is typed into an already-running process via `terminal.sendText`, the same as literal
 * keystrokes — it never gets parsed as a shell command line, so the `$(...)`/backtick findings
 * from Fase 5 (see oneShotTurnRunner.ts) don't apply here. What it trades away is the *hard*
 * completion signal (a real exit code): SwarmForge's own model resolves this the same way this
 * file does — the agent explicitly signals "I'm done with this task" as an action, not the
 * infrastructure detecting a process exiting. Here that signal is a marker file the agent is
 * instructed to write; detected by polling, not a VS Code API event, since there is no discrete
 * "command" for Shell Integration to track while an interactive REPL is running (confirmed in
 * Fase 5 empirically: only the initial process launch produced a start/end event; nothing fired
 * for subsequent input typed into the running process).
 *
 * `oneShotTurnRunner.ts` is no longer wired into workflowRunManager.ts but is kept as-is: it's
 * validated, documented work (Fase 5) that stays useful if a fully unattended, no-TTY-feedback
 * mode is wanted again later (e.g. scheduled/CI-style runs).
 */

const LAUNCH_COMMAND: Record<string, string> = {
  claude: "claude --permission-mode acceptEdits",
  // Not yet confirmed against `codex --help` (only `codex exec --help` was checked) — this
  // assumes plain `codex` (no `exec` subcommand) opens its interactive TUI. Ask the user to
  // verify and adjust if it behaves differently.
  codex: "codex --sandbox workspace-write",
};

export interface AgentTurnResult {
  success: boolean;
  exitCode: undefined;
  timedOut: boolean;
  promptFilePath: string;
  /** The agent's final answer, read from the marker file it was instructed to write. */
  output: string;
}

export interface AgentTurnRequest {
  terminal: vscode.Terminal;
  executable: string;
  prompt: string;
  runDir: string;
  /** Identifies this turn's files within runDir — typically the workflow node id. Sanitized
   * before use, so any string is safe to pass. */
  stepId: string;
  timeoutMs?: number;
}

function sanitizeForFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

async function writeTextFile(filePath: string, content: string): Promise<void> {
  await vscode.workspace.fs.writeFile(
    vscode.Uri.file(filePath),
    Buffer.from(content, "utf8"),
  );
}

async function readTextFileIfExists(filePath: string): Promise<string | undefined> {
  try {
    const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
    return Buffer.from(bytes).toString("utf8");
  } catch {
    return undefined;
  }
}

function flattenForTyping(text: string): string {
  // sendText submits on newline in most REPLs, same reason the original pre-Fase-5 code
  // flattened this before typing into a shared terminal.
  return text.replace(/\r?\n+/g, " ").trim();
}

function buildPromptWithMarkerInstruction(prompt: string, markerFilePath: string): string {
  return (
    `${prompt}\n\n` +
    `When you are done with this task, write your complete final response to the file ` +
    `"${markerFilePath}" (create it if it does not exist yet) using your file-write tool, then ` +
    `stop and wait — do not ask for confirmation before writing that file, and do not consider ` +
    `the task finished until that file is written.`
  );
}

async function waitForMarkerFile(
  markerFilePath: string,
  timeoutMs: number,
  pollIntervalMs = 2000,
): Promise<string | undefined> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const content = await readTextFileIfExists(markerFilePath);
    if (content !== undefined) {
      return content;
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  return undefined;
}

export async function runAgentTurn(
  request: AgentTurnRequest,
): Promise<AgentTurnResult> {
  const { terminal, executable, prompt, runDir, stepId, timeoutMs = 10 * 60 * 1000 } = request;
  const safeStepId = sanitizeForFilename(stepId);

  await vscode.workspace.fs.createDirectory(vscode.Uri.file(runDir));
  const promptFilePath = path.join(runDir, `step-${safeStepId}-prompt.txt`);
  const markerFilePath = path.join(runDir, `step-${safeStepId}-done.txt`);
  await writeTextFile(promptFilePath, prompt);

  const launchCommand = LAUNCH_COMMAND[executable] ?? executable;
  terminal.sendText(launchCommand, true);
  // Give the CLI a moment to boot before typing into it — same fixed delay the original
  // pre-Fase-5 code used for this exact purpose.
  await new Promise((resolve) => setTimeout(resolve, 1500));

  const fullPrompt = buildPromptWithMarkerInstruction(prompt, markerFilePath);
  terminal.sendText(flattenForTyping(fullPrompt), true);

  const output = await waitForMarkerFile(markerFilePath, timeoutMs);

  return {
    success: output !== undefined,
    exitCode: undefined,
    timedOut: output === undefined,
    promptFilePath,
    output: output ?? "",
  };
}
