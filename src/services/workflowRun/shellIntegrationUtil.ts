import * as vscode from "vscode";

/**
 * Shared helpers for driving VS Code's Terminal Shell Integration API. Used by the real
 * one-shot turn runner (oneShotTurnRunner.ts) and by the diagnostic prototype
 * (shellIntegrationPrototype.ts) so both rely on the same, once-validated behavior.
 */

export async function waitForShellIntegration(
  terminal: vscode.Terminal,
  timeoutMs = 5000,
): Promise<vscode.TerminalShellIntegration | undefined> {
  if (terminal.shellIntegration) {
    return terminal.shellIntegration;
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      disposable.dispose();
      resolve(undefined);
    }, timeoutMs);
    const disposable = vscode.window.onDidChangeTerminalShellIntegration((e) => {
      if (e.terminal === terminal) {
        clearTimeout(timer);
        disposable.dispose();
        resolve(e.shellIntegration);
      }
    });
  });
}

export async function waitForExecutionEnd(
  execution: vscode.TerminalShellExecution,
  timeoutMs: number,
): Promise<number | undefined> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      disposable.dispose();
      resolve(undefined);
    }, timeoutMs);
    const disposable = vscode.window.onDidEndTerminalShellExecution((e) => {
      if (e.execution === execution) {
        clearTimeout(timer);
        disposable.dispose();
        resolve(e.exitCode);
      }
    });
  });
}
