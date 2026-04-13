import * as vscode from "vscode";
import type {
  ExtensionToWebviewMessage,
  WorkflowRunState,
  WebviewToExtensionMessage,
} from "../domain/messages";
import type {
  AgentDefinition,
  CapabilityGraph,
  WorkflowDefinition,
} from "../domain/models";

export interface DashboardPanelHandlers {
  onRefresh: () => Promise<void>;
  onSaveAgent: (agent: AgentDefinition) => Promise<void>;
  onDeleteAgent: (agentId: string) => Promise<void>;
  onOpenRawAgent: (agentId: string) => Promise<void>;
  onOpenInChat: (agentId: string) => Promise<void>;
  onDeleteWorkflow: (workflowId: string) => Promise<void>;
  onSaveWorkflow: (workflow: WorkflowDefinition) => Promise<void>;
  onRunWorkflow: (workflowId: string, mode: "chat" | "plan") => Promise<void>;
  onCreateAgent: () => Promise<void>;
  onEditAgent: (agentId: string) => Promise<void>;
}

export class DashboardPanel {
  private panel?: vscode.WebviewPanel;
  private webviewReady = false;
  private pendingMessages: ExtensionToWebviewMessage[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly handlers: DashboardPanelHandlers,
  ) {}

  show(): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      "agentStudio.dashboard",
      "Agent Studio",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.extensionUri, "webview-dist"),
          vscode.Uri.joinPath(this.extensionUri, "media"),
        ],
      },
    );

    // Use the project's logo for the webview panel icon
    this.panel.iconPath = vscode.Uri.joinPath(
      this.extensionUri,
      "media",
      "agent-studio.svg",
    );

    this.panel.webview.html = this.getHtml(this.panel.webview);
    this.webviewReady = false;

    this.panel.webview.onDidReceiveMessage(
      async (message: WebviewToExtensionMessage) => {
        switch (message.type) {
          case "ready":
            this.webviewReady = true;
            await this.handlers.onRefresh();
            this.flushPendingMessages();
            break;
          case "refresh":
            await this.handlers.onRefresh();
            break;
          case "saveAgent":
            await this.handlers.onSaveAgent(message.payload);
            break;
          case "deleteAgent":
            await this.handlers.onDeleteAgent(message.payload.agentId);
            break;
          case "openRawAgent":
            await this.handlers.onOpenRawAgent(message.payload.agentId);
            break;
          case "openInChat":
            await this.handlers.onOpenInChat(message.payload.agentId);
            break;
          case "saveWorkflow":
            await this.handlers.onSaveWorkflow(message.payload);
            break;
          case "deleteWorkflow":
            await this.handlers.onDeleteWorkflow(message.payload.workflowId);
            break;
          case "runWorkflow":
            await this.handlers.onRunWorkflow(
              message.payload.workflowId,
              message.payload.mode,
            );
            break;
          case "createAgent":
            await this.handlers.onCreateAgent();
            break;
          case "editAgent":
            await this.handlers.onEditAgent(message.payload.agentId);
            break;
        }
      },
    );

    this.panel.onDidDispose(() => {
      this.panel = undefined;
      this.webviewReady = false;
      this.pendingMessages = [];
    });
  }

  postState(
    agents: AgentDefinition[],
    workflows: WorkflowDefinition[],
    capabilityGraph: CapabilityGraph,
  ): void {
    if (!this.panel) {
      return;
    }

    const payload: ExtensionToWebviewMessage = {
      type: "state",
      payload: {
        agents,
        workflows,
        capabilityGraph,
      },
    };

    void this.panel.webview.postMessage(payload);
  }

  postInfo(message: string): void {
    this.postMessage({ type: "info", payload: { message } });
  }

  postError(message: string): void {
    this.postMessage({ type: "error", payload: { message } });
  }

  postWorkflowRunUpdate(payload: WorkflowRunState): void {
    this.postMessage({ type: "workflowRunUpdate", payload });
  }

  focusAgentEditor(
    agentId: string,
    tab?:
      | "Identity"
      | "Instructions"
      | "Context"
      | "Handoffs"
      | "Capabilities"
      | "Source Preview",
  ): void {
    this.postMessage({
      type: "focusAgentEditor",
      payload: { agentId, tab },
    });
  }

  focusCapability(kind: "tool" | "skill" | "mcp", id: string): void {
    this.postMessage({
      type: "focusCapability",
      payload: { kind, id },
    });
  }

  focusWorkflow(workflowId: string): void {
    this.postMessage({
      type: "focusWorkflow",
      payload: { workflowId },
    });
  }

  private postMessage(message: ExtensionToWebviewMessage): void {
    if (!this.panel) {
      return;
    }
    if (!this.webviewReady) {
      this.pendingMessages.push(message);
      return;
    }
    void this.panel.webview.postMessage(message);
  }

  private flushPendingMessages(): void {
    if (
      !this.panel ||
      !this.webviewReady ||
      this.pendingMessages.length === 0
    ) {
      return;
    }

    const queued = [...this.pendingMessages];
    this.pendingMessages = [];
    for (const message of queued) {
      void this.panel.webview.postMessage(message);
    }
  }

  private getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.extensionUri,
        "webview-dist",
        "assets",
        "main.js",
      ),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.extensionUri,
        "webview-dist",
        "assets",
        "index.css",
      ),
    );
    const nonce = String(Date.now());

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="${styleUri}" rel="stylesheet" />
  <title>Agent Studio</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}">
    window.acquireVsCodeApi = acquireVsCodeApi;
  </script>
  <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
