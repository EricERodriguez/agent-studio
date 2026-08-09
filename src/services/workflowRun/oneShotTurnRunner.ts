import * as vscode from "vscode";
import * as path from "path";
import { waitForShellIntegration, waitForExecutionEnd } from "./shellIntegrationUtil";

/**
 * Runs one agent turn as a real one-shot CLI invocation and waits for the actual exit code,
 * instead of typing into a long-running REPL and assuming completion once the prompt is sent.
 *
 * The prompt is written to a file and piped into the CLI via stdin redirection — never
 * interpolated into the command line or passed as a CLI argument. This is required, not just
 * a hardening measure: docs/swarmforge-integration/ Fase 5 confirmed empirically (2026-08-09)
 * that both a raw commandLine string and the `executeCommand(executable, args[])` overload
 * execute embedded `$(...)`/backtick content as real shell commands, and separately mangle any
 * prompt containing quotes or backticks into multiple broken arguments even without an attack
 * (claude only received the first word of a real prompt; codex's argument parser errored out).
 * See docs/swarmforge-integration/02-arquitectura-motor-nativo.md.
 *
 * The turn's full stdout/stderr is captured by redirecting it to a file (rather than reading the
 * terminal's raw escape-sequence stream via TerminalShellExecution.read()), so the caller gets
 * plain text without ANSI-stripping.
 *
 * One-shot invocation per executable — both confirmed empirically against real CLIs (2026-08-09):
 * `claude -p` and `codex exec` (not `codex -p`, which turned out to mean `--profile`, not
 * "prompt" — `codex -p < file` errored with "a value is required for '--profile'"). See
 * docs/swarmforge-integration/PROGRESS.md for the run-by-run evidence.
 *
 * `codex exec`'s raw stdout is not just the agent's answer — it includes a startup banner, the
 * echoed prompt, and a full tool-use trace (confirmed 2026-08-09: it actually ran shell commands
 * to explore the repo before answering). That whole blob is unsuitable as the "previous step's
 * output" fed into the next agent's prompt. `codex exec --help` confirmed a purpose-built flag
 * for this: `-o, --output-last-message <FILE>` — "the last message from the agent". Used here so
 * chaining reads only the final answer, not the full transcript. `claude -p`'s stdout already
 * looked clean in testing, so it has no equivalent flag wired up (its raw stdout is used as-is).
 */

interface OneShotSpec {
  /** One-shot command, without the stdin/stdout redirection (added by runAgentTurn). */
  command: string;
  /** Extra flag(s) asking the CLI to write just its final answer to `path`, if supported. */
  cleanOutputFlag?: (path: string) => string;
}

const ONE_SHOT_SPEC: Record<string, OneShotSpec> = {
  claude: { command: "claude -p" },
  codex: { command: "codex exec", cleanOutputFlag: (filePath) => `-o "${filePath}"` },
};

export interface AgentTurnResult {
  success: boolean;
  exitCode: number | undefined;
  timedOut: boolean;
  promptFilePath: string;
  /** The agent's final answer, suitable for chaining into the next step's prompt. */
  output: string;
}

export interface AgentTurnRequest {
  terminal: vscode.Terminal;
  executable: string;
  prompt: string;
  runDir: string;
  stepIndex: number;
  timeoutMs?: number;
}

async function writeTextFile(filePath: string, content: string): Promise<void> {
  await vscode.workspace.fs.writeFile(
    vscode.Uri.file(filePath),
    Buffer.from(content, "utf8"),
  );
}

async function readTextFileIfExists(filePath: string): Promise<string> {
  try {
    const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
    return Buffer.from(bytes).toString("utf8");
  } catch {
    return "";
  }
}

export async function runAgentTurn(
  request: AgentTurnRequest,
): Promise<AgentTurnResult> {
  const { terminal, executable, prompt, runDir, stepIndex, timeoutMs = 10 * 60 * 1000 } = request;

  await vscode.workspace.fs.createDirectory(vscode.Uri.file(runDir));
  const promptFilePath = path.join(runDir, `step-${stepIndex}-prompt.txt`);
  const rawOutputFilePath = path.join(runDir, `step-${stepIndex}-output.txt`);
  const cleanOutputFilePath = path.join(runDir, `step-${stepIndex}-final.txt`);
  await writeTextFile(promptFilePath, prompt);

  const shellIntegration = await waitForShellIntegration(terminal);
  if (!shellIntegration) {
    return { success: false, exitCode: undefined, timedOut: false, promptFilePath, output: "" };
  }

  // Only the *FilePath variables are interpolated here — every one of them is a path Agent
  // Studio itself constructs (runDir + a numeric step index), never the prompt content. Do not
  // change this to pass the prompt (or any agent-generated text) as a shell argument; see the
  // empirical findings referenced above.
  const spec = ONE_SHOT_SPEC[executable] ?? { command: `${executable} -p` };
  const cleanFlag = spec.cleanOutputFlag ? ` ${spec.cleanOutputFlag(cleanOutputFilePath)}` : "";
  const commandLine =
    `${spec.command}${cleanFlag} < "${promptFilePath}" > "${rawOutputFilePath}" 2>&1`;
  const execution = shellIntegration.executeCommand(commandLine);
  const exitCode = await waitForExecutionEnd(execution, timeoutMs);

  const rawOutput = await readTextFileIfExists(rawOutputFilePath);
  const cleanOutput = spec.cleanOutputFlag
    ? await readTextFileIfExists(cleanOutputFilePath)
    : "";
  const output = cleanOutput.trim() ? cleanOutput : rawOutput;

  return {
    success: exitCode === 0,
    exitCode,
    timedOut: exitCode === undefined,
    promptFilePath,
    output,
  };
}
