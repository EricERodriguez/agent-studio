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
 *
 * Launch command per provider and the startup delay are both user-configurable
 * (`agentStudio.cli.*` settings) — confirmed necessary from real use (2026-08-09): a user with a
 * custom wrapper alias (e.g. `claude-with-memory`) needs to point this at their own command, and
 * a fixed short delay isn't enough for every CLI/wrapper to finish starting up. A real test also
 * showed `codex --sandbox workspace-write` typed too soon after launch got partly swallowed by
 * the still-starting TUI and the rest landed on the raw shell, producing zsh parse errors —
 * typing the prompt as its own `sendText` call (no auto-Enter) followed by a *separate* `sendText`
 * for just the Enter keystroke, with a short pause in between, is a cheap mitigation for that
 * class of race; it is not a guarantee, since VS Code has no API to detect "this TUI is now ready
 * for input".
 */

function getCliConfig() {
  const config = vscode.workspace.getConfiguration("agentStudio.cli");
  return {
    claudeCommand: config.get<string>("claudeCommand", "claude --permission-mode acceptEdits"),
    codexCommand: config.get<string>("codexCommand", "codex --sandbox workspace-write"),
    startupDelayMs: config.get<number>("startupDelayMs", 3000),
  };
}

function launchCommandFor(executable: string): string {
  const { claudeCommand, codexCommand } = getCliConfig();
  if (executable === "claude") {
    return claudeCommand;
  }
  if (executable === "codex") {
    return codexCommand;
  }
  return executable;
}

export interface AgentTurnResult {
  success: boolean;
  exitCode: undefined;
  timedOut: boolean;
  cancelled: boolean;
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
  /** Polled while waiting for the completion marker; return true to abandon the wait early
   * (used by the Stop button — see workflowRunManager.ts). */
  shouldCancel?: () => boolean;
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
  // Typing a literal newline can submit early in some REPLs, same reason the original
  // pre-Fase-5 code flattened this before typing into a shared terminal.
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

/** Types text, then sends the Enter keystroke as a separate call after a short pause — see the
 * file header for why this is split instead of one `sendText(text, true)` call. */
async function typeAndSubmit(terminal: vscode.Terminal, text: string): Promise<void> {
  terminal.sendText(text, false);
  await new Promise((resolve) => setTimeout(resolve, 400));
  terminal.sendText("", true);
}

async function waitForMarkerFile(
  markerFilePath: string,
  timeoutMs: number,
  shouldCancel: () => boolean,
  pollIntervalMs = 2000,
): Promise<{ output: string | undefined; cancelled: boolean }> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (shouldCancel()) {
      return { output: undefined, cancelled: true };
    }
    const content = await readTextFileIfExists(markerFilePath);
    if (content !== undefined) {
      return { output: content, cancelled: false };
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  return { output: undefined, cancelled: false };
}

export async function runAgentTurn(
  request: AgentTurnRequest,
): Promise<AgentTurnResult> {
  const {
    terminal,
    executable,
    prompt,
    runDir,
    stepId,
    timeoutMs = 10 * 60 * 1000,
    shouldCancel = () => false,
  } = request;
  const safeStepId = sanitizeForFilename(stepId);

  await vscode.workspace.fs.createDirectory(vscode.Uri.file(runDir));
  const promptFilePath = path.join(runDir, `step-${safeStepId}-prompt.txt`);
  const markerFilePath = path.join(runDir, `step-${safeStepId}-done.txt`);
  await writeTextFile(promptFilePath, prompt);

  const { startupDelayMs } = getCliConfig();
  terminal.sendText(launchCommandFor(executable), true);
  await new Promise((resolve) => setTimeout(resolve, startupDelayMs));

  const fullPrompt = buildPromptWithMarkerInstruction(prompt, markerFilePath);
  await typeAndSubmit(terminal, flattenForTyping(fullPrompt));

  const { output, cancelled } = await waitForMarkerFile(markerFilePath, timeoutMs, shouldCancel);

  return {
    success: output !== undefined,
    exitCode: undefined,
    timedOut: output === undefined && !cancelled,
    cancelled,
    promptFilePath,
    output: output ?? "",
  };
}
