import * as vscode from "vscode";

/** One vscode.Terminal per workflow node, reused across turns for that node within a run. */
export class WorkflowTerminalService {
  private readonly terminals = new Map<string, vscode.Terminal>();

  getOrCreateTerminal(nodeId: string, name: string, cwd: string): vscode.Terminal {
    const existing = this.terminals.get(nodeId);
    if (existing) {
      return existing;
    }
    const terminal = vscode.window.createTerminal({ name, cwd });
    this.terminals.set(nodeId, terminal);
    terminal.show(true);
    return terminal;
  }
}
