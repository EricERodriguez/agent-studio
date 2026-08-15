import * as vscode from "vscode";
import { spawn, type ChildProcessWithoutNullStreams } from "child_process";

/**
 * Runs a Codex turn via `codex app-server --stdio` — JSON-RPC over stdio (JSONL: one JSON object
 * per line), the same interface the official Codex VS Code extension uses. This replaces the
 * terminal+sendText approach for Codex specifically (Claude keeps using interactiveTurnRunner.ts,
 * which works fine for it).
 *
 * Why: real testing (2026-08-09) showed `sendText`-driven interactive Codex sessions reliably
 * broke — the prompt landed on the raw shell instead of Codex's TUI (zsh parse errors). The user
 * asked Codex itself how to integrate reliably; Codex's answer, confirmed against
 * https://developers.openai.com/codex/app-server:
 *   - There is no documented "ready for input" signal for the TUI, so sendText + a fixed delay
 *     can never be made robust for it.
 *   - `--no-alt-screen` (this project's first attempted fix) only changes rendering/scrollback,
 *     not which process receives keystrokes — it does not address the race.
 *   - app-server gives an explicit protocol instead: `initialize` → `initialized` →
 *     `thread/start` → `turn/start` → `turn/completed` (reliable end-of-turn event, not polling
 *     a marker file) — plus `turn/steer` for mid-task human feedback (not implemented yet here,
 *     see "Qué falta" in docs/swarmforge-integration/PROGRESS.md).
 *
 * The exact message shapes below are taken from the real protocol schema generated locally via
 * `codex app-server generate-json-schema --out <dir> --experimental` (not guessed, not just
 * taken from the chat response) — see docs/swarmforge-integration/PROGRESS.md for how this was
 * obtained. Key confirmed shapes:
 *   - Handshake: `{id, method:"initialize", params:{clientInfo:{name,version}}}` → response,
 *     then a fire-and-forget `{method:"initialized"}` notification (this is the *only* client
 *     notification the protocol defines).
 *   - `thread/start` params accept `sandbox: "read-only"|"workspace-write"|"danger-full-access"`
 *     and `approvalPolicy: "untrusted"|"on-request"|"never"`. Using `workspace-write` +
 *     `never` here mirrors the scoped-write decision already made for Claude
 *     (`--permission-mode acceptEdits`) without having to implement the approval-request
 *     response protocol (ExecCommandApprovalResponse / ApplyPatchApprovalResponse / etc., each
 *     with its own result shape) in this first version — `"never"` means Codex is told about
 *     sandbox failures directly and adapts, instead of asking us.
 *   - The thread id and turn completion arrive via notifications
 *     (`thread/started` → `{thread:{id,...}}}`, `turn/completed` → `{threadId, turn:{id, status,
 *     items, error}}`), not necessarily via the matching request's own `result` — this file reads
 *     both and prefers the notification, since only the notification payloads were fully
 *     confirmed against the real schema.
 *   - The turn's final answer is the last `items` entry with `type: "agentMessage"` (`.text`).
 */

interface JsonRpcMessage {
  id?: number | string;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string };
}

interface ThreadItem {
  type: string;
  text?: string;
}

interface TurnPayload {
  id: string;
  status: "completed" | "interrupted" | "failed" | "inProgress";
  items: ThreadItem[];
  error?: { message: string };
}

/** Convert protocol activity into a deliberately non-sensitive status for the dashboard. */
function describeActivity(params: unknown): string {
  const payload = params as {
    item?: { type?: string };
    itemType?: string;
  };
  const itemType = payload?.item?.type ?? payload?.itemType;
  if (itemType === "commandExecution") return "Codex is running a command";
  if (itemType === "reasoning") return "Codex is analyzing the task";
  if (itemType === "agentMessage") return "Codex is preparing a response";
  if (itemType === "fileChange") return "Codex is applying a file change";
  return "Codex is working";
}

class AppServerClient {
  private readonly proc: ChildProcessWithoutNullStreams;
  private nextId = 1;
  private buffer = "";
  private readonly pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  private readonly notificationHandlers = new Map<string, (params: unknown) => void>();
  private disposed = false;

  constructor(cwd: string, private readonly output: vscode.OutputChannel) {
    this.proc = spawn("codex", ["app-server", "--stdio"], { cwd });
    this.proc.stdout.on("data", (chunk: Buffer) => this.onData(chunk));
    this.proc.stderr.on("data", (chunk: Buffer) => {
      this.output.appendLine(`[codex app-server stderr] ${chunk.toString("utf8").trim()}`);
    });
    this.proc.on("error", (error) => {
      this.output.appendLine(`[codex app-server] failed to start: ${error.message}`);
      this.rejectAllPending(error);
    });
    this.proc.on("exit", (code) => {
      this.output.appendLine(`[codex app-server] exited with code ${code}`);
      this.rejectAllPending(new Error(`codex app-server exited with code ${code}`));
    });
  }

  private rejectAllPending(error: Error): void {
    for (const { reject } of this.pending.values()) {
      reject(error);
    }
    this.pending.clear();
  }

  private onData(chunk: Buffer): void {
    this.buffer += chunk.toString("utf8");
    let newlineIndex: number;
    while ((newlineIndex = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, newlineIndex).trim();
      this.buffer = this.buffer.slice(newlineIndex + 1);
      if (!line) {
        continue;
      }
      this.output.appendLine(`< ${line}`);
      let message: JsonRpcMessage;
      try {
        message = JSON.parse(line);
      } catch {
        continue;
      }
      this.handleMessage(message);
    }
  }

  private handleMessage(message: JsonRpcMessage): void {
    if (message.method && message.id === undefined) {
      this.notificationHandlers.get(message.method)?.(message.params);
      return;
    }
    if (message.id !== undefined && (message.result !== undefined || message.error)) {
      const id = typeof message.id === "number" ? message.id : Number(message.id);
      const pending = this.pending.get(id);
      if (!pending) {
        return;
      }
      this.pending.delete(id);
      if (message.error) {
        pending.reject(new Error(message.error.message));
      } else {
        pending.resolve(message.result);
      }
      return;
    }
    if (message.method && message.id !== undefined) {
      // A server request expecting a response (e.g. an approval request). Not handling any
      // specific request type in this first version — approvalPolicy "never" at thread/start
      // means Codex should not need to send these for a normal run.
      this.output.appendLine(`[codex app-server] unhandled server request: ${message.method}`);
    }
  }

  onNotification(method: string, handler: (params: unknown) => void): void {
    this.notificationHandlers.set(method, handler);
  }

  request<T>(method: string, params: unknown): Promise<T> {
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });
    this.output.appendLine(`> ${payload}`);
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
      this.proc.stdin.write(payload + "\n");
    });
  }

  notify(method: string): void {
    const payload = JSON.stringify({ method });
    this.output.appendLine(`> ${payload}`);
    this.proc.stdin.write(payload + "\n");
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.proc.kill();
  }
}

interface CodexSession {
  client: AppServerClient;
  threadId?: string;
  initializePromise: Promise<void>;
}

/** One `codex app-server` child process per workflow node, reused across turns for that node. */
export class CodexAppServerService {
  private readonly sessions = new Map<string, CodexSession>();
  private readonly outputChannel = vscode.window.createOutputChannel(
    "Agent Studio: Codex app-server",
  );

  private async getOrCreateSession(nodeId: string, cwd: string): Promise<CodexSession> {
    const existing = this.sessions.get(nodeId);
    if (existing) {
      return existing;
    }
    const client = new AppServerClient(cwd, this.outputChannel);
    const initializePromise = (async () => {
      await client.request("initialize", {
        clientInfo: { name: "agent-studio", version: "1.0.3" },
      });
      client.notify("initialized");
    })();
    const session: CodexSession = { client, initializePromise };
    this.sessions.set(nodeId, session);
    return session;
  }

  private async ensureThread(session: CodexSession, cwd: string): Promise<string> {
    if (session.threadId) {
      return session.threadId;
    }
    await session.initializePromise;
    const threadStarted = new Promise<string>((resolve) => {
      session.client.onNotification("thread/started", (params) => {
        const thread = (params as { thread?: { id?: string } })?.thread;
        if (thread?.id) {
          resolve(thread.id);
        }
      });
    });
    const result = await session.client.request<{ thread?: { id?: string }; threadId?: string }>(
      "thread/start",
      { cwd, sandbox: "workspace-write", approvalPolicy: "never" },
    );
    const threadId =
      (await Promise.race([
        threadStarted,
        new Promise<string | undefined>((resolve) => setTimeout(() => resolve(undefined), 5000)),
      ])) ??
      result?.thread?.id ??
      result?.threadId;
    if (!threadId) {
      throw new Error("codex app-server did not report a threadId for thread/start");
    }
    session.threadId = threadId;
    return threadId;
  }

  async runTurn(
    nodeId: string,
    cwd: string,
    prompt: string,
    timeoutMs: number,
    shouldCancel: () => boolean,
    onActivity?: (summary: string) => void,
  ): Promise<{ success: boolean; timedOut: boolean; cancelled: boolean; output: string }> {
    try {
      const session = await this.getOrCreateSession(nodeId, cwd);
      const threadId = await this.ensureThread(session, cwd);

      const turnCompleted = new Promise<TurnPayload>((resolve) => {
        session.client.onNotification("turn/completed", (params) => {
          const payload = params as { threadId?: string; turn?: TurnPayload };
          if (payload?.threadId === threadId && payload.turn) {
            resolve(payload.turn);
          }
        });
      });

      // Activity notifications can be frequent (especially command output deltas). Coalesce them
      // into a safe, human-readable heartbeat rather than exposing protocol JSON to the webview.
      let lastActivity = "";
      let lastActivityAt = 0;
      const reportActivity = (params: unknown): void => {
        const summary = describeActivity(params);
        const now = Date.now();
        if (summary === lastActivity && now - lastActivityAt < 1500) return;
        lastActivity = summary;
        lastActivityAt = now;
        onActivity?.(summary);
      };
      session.client.onNotification("item/started", reportActivity);
      session.client.onNotification("item/completed", reportActivity);
      session.client.onNotification("item/commandExecution/outputDelta", () =>
        onActivity?.("Codex command produced output"),
      );

      await session.client.request("turn/start", {
        threadId,
        input: [{ type: "text", text: prompt }],
      });
      onActivity?.("Codex started the turn");

      const cancelCheck = new Promise<"cancelled">((resolve) => {
        const interval = setInterval(() => {
          if (shouldCancel()) {
            clearInterval(interval);
            resolve("cancelled");
          }
        }, 1000);
      });
      const timeout = new Promise<"timeout">((resolve) =>
        setTimeout(() => resolve("timeout"), timeoutMs),
      );

      const outcome = await Promise.race([turnCompleted, cancelCheck, timeout]);
      if (outcome === "cancelled") {
        return { success: false, timedOut: false, cancelled: true, output: "" };
      }
      if (outcome === "timeout") {
        return { success: false, timedOut: true, cancelled: false, output: "" };
      }

      const turn = outcome;
      if (turn.status !== "completed") {
        return {
          success: false,
          timedOut: false,
          cancelled: turn.status === "interrupted",
          output: turn.error?.message ?? `Turn ended with status "${turn.status}"`,
        };
      }
      const agentMessages = turn.items.filter((item) => item.type === "agentMessage");
      const output = agentMessages.map((item) => item.text ?? "").join("\n\n");
      return { success: true, timedOut: false, cancelled: false, output };
    } catch (error) {
      this.outputChannel.appendLine(
        `[codex app-server] turn failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        success: false,
        timedOut: false,
        cancelled: false,
        output: error instanceof Error ? error.message : String(error),
      };
    }
  }

  disposeAll(): void {
    for (const session of this.sessions.values()) {
      session.client.dispose();
    }
    this.sessions.clear();
  }
}
