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
 * Open question, not yet confirmed against a real CLI: whether `<executable> -p` with no
 * trailing argument actually reads the prompt from stdin for every supported provider. Confirmed
 * for `claude` from its documented `-p`/stdin usage; NOT independently confirmed for `codex` in
 * this project yet (see docs/swarmforge-integration/PROGRESS.md).
 */

export interface AgentTurnResult {
  success: boolean;
  exitCode: number | undefined;
  timedOut: boolean;
  promptFilePath: string;
}

export interface AgentTurnRequest {
  terminal: vscode.Terminal;
  executable: string;
  prompt: string;
  runDir: string;
  stepIndex: number;
  timeoutMs?: number;
}

async function writePromptFile(
  runDir: string,
  stepIndex: number,
  prompt: string,
): Promise<string> {
  await vscode.workspace.fs.createDirectory(vscode.Uri.file(runDir));
  const promptFilePath = path.join(runDir, `step-${stepIndex}-prompt.txt`);
  await vscode.workspace.fs.writeFile(
    vscode.Uri.file(promptFilePath),
    Buffer.from(prompt, "utf8"),
  );
  return promptFilePath;
}

export async function runAgentTurn(
  request: AgentTurnRequest,
): Promise<AgentTurnResult> {
  const { terminal, executable, prompt, runDir, stepIndex, timeoutMs = 10 * 60 * 1000 } = request;

  const promptFilePath = await writePromptFile(runDir, stepIndex, prompt);

  const shellIntegration = await waitForShellIntegration(terminal);
  if (!shellIntegration) {
    return { success: false, exitCode: undefined, timedOut: false, promptFilePath };
  }

  // Only promptFilePath is interpolated here — it is a path Agent Studio itself constructs
  // (runDir + a numeric step index), never the prompt content. Do not change this to pass the
  // prompt as a shell argument; see the empirical findings referenced above.
  const commandLine = `${executable} -p < "${promptFilePath}"`;
  const execution = shellIntegration.executeCommand(commandLine);
  const exitCode = await waitForExecutionEnd(execution, timeoutMs);

  return {
    success: exitCode === 0,
    exitCode,
    timedOut: exitCode === undefined,
    promptFilePath,
  };
}
