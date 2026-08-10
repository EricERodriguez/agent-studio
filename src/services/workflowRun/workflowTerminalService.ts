import * as vscode from "vscode";

/**
 * One vscode.Terminal per workflow node, reused across turns for that node within a run.
 * Every terminal after the first opens as a split of the first one (not a separate tab) — the
 * user asked for this explicitly (2026-08-09) so all of a run's agents are visible side by side.
 */
export class WorkflowTerminalService {
  private readonly terminals = new Map<string, Promise<vscode.Terminal>>();
  private anchorTerminal: vscode.Terminal | undefined;
  /** Terminal creation has observable lifecycle events, unlike sendText. Serialize creation so a
   * split never races the extension host registering its parent terminal. */
  private creationTail: Promise<void> = Promise.resolve();

  async getOrCreateTerminal(
    nodeId: string,
    name: string,
    cwd: string,
  ): Promise<vscode.Terminal> {
    const existing = this.terminals.get(nodeId);
    if (existing) {
      return existing;
    }

    const created = this.creationTail.then(async () => {
      const parent = this.anchorTerminal;
      if (parent) {
        // Make the intended group active before VS Code resolves the location option.
        parent.show(true);
      }
      const terminal = parent
        ? await this.createSplitTerminal(parent, { name, cwd, location: { parentTerminal: parent } })
        : await this.createAndWaitForOpen({ name, cwd });
      if (!this.anchorTerminal) {
        this.anchorTerminal = terminal;
      }
      terminal.show(true);
      return terminal;
    });
    this.terminals.set(nodeId, created);
    this.creationTail = created.then(
      () => undefined,
      () => undefined,
    );
    return created;
  }

  private async createAndWaitForOpen(
    options: vscode.TerminalOptions,
  ): Promise<vscode.Terminal> {
    let terminal: vscode.Terminal | undefined;
    let resolveOpened: (() => void) | undefined;
    const opened = new Promise<void>((resolve) => {
      resolveOpened = resolve;
    });
    const listener = vscode.window.onDidOpenTerminal((candidate) => {
      if (candidate === terminal) {
        resolveOpened?.();
      }
    });

    try {
      terminal = vscode.window.createTerminal(options);
      // The event normally arrives immediately. The bounded fallback keeps terminal creation
      // usable on hosts that report it before listeners can observe it.
      await Promise.race([
        opened,
        new Promise<void>((resolve) => setTimeout(resolve, 250)),
      ]);
      return terminal;
    } finally {
      listener.dispose();
    }
  }

  private async createSplitTerminal(
    parent: vscode.Terminal,
    fallbackOptions: vscode.TerminalOptions,
  ): Promise<vscode.Terminal> {
    let resolveOpened: ((terminal: vscode.Terminal) => void) | undefined;
    const opened = new Promise<vscode.Terminal>((resolve) => {
      resolveOpened = resolve;
    });
    const listener = vscode.window.onDidOpenTerminal((candidate) => {
      resolveOpened?.(candidate);
    });

    try {
      // `location.parentTerminal` is the documented API, but it consistently created a new tab
      // in the real EDH. The workbench command is the same action exposed as “Split Terminal” and
      // was confirmed there to create a pane in the active parent's group. Creation remains
      // serialized, so the opened terminal cannot be claimed by another workflow node.
      await vscode.commands.executeCommand("workbench.action.terminal.split");
      const terminal = await Promise.race([
        opened,
        new Promise<vscode.Terminal | undefined>((resolve) =>
          setTimeout(() => resolve(vscode.window.activeTerminal), 250),
        ),
      ]);
      if (terminal && terminal !== parent) {
        return terminal;
      }

      // Preserve a usable terminal on hosts where the workbench command is unavailable.
      return this.createAndWaitForOpen(fallbackOptions);
    } finally {
      listener.dispose();
    }
  }
}
