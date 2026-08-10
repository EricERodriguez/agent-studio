import * as vscode from "vscode";

/**
 * One vscode.Terminal per workflow node, reused across turns for that node within a run.
 * Every terminal after the first opens as a split of the first one (not a separate tab) — the
 * user asked for this explicitly (2026-08-09) so all of a run's agents are visible side by side.
 */
export class WorkflowTerminalService {
  private readonly terminals = new Map<string, vscode.Terminal>();
  private anchorTerminal: vscode.Terminal | undefined;

  getOrCreateTerminal(nodeId: string, name: string, cwd: string): vscode.Terminal {
    const existing = this.terminals.get(nodeId);
    if (existing) {
      return existing;
    }
    if (this.anchorTerminal) {
      // Some VS Code versions only honor `location.parentTerminal` reliably when the parent is
      // the currently active/shown terminal at creation time — make sure of that first.
      this.anchorTerminal.show(true);
    }
    const terminal = vscode.window.createTerminal(
      this.anchorTerminal
        ? { name, cwd, location: { parentTerminal: this.anchorTerminal } }
        : { name, cwd },
    );
    if (!this.anchorTerminal) {
      this.anchorTerminal = terminal;
    }
    this.terminals.set(nodeId, terminal);
    terminal.show(true);
    return terminal;
  }
}
