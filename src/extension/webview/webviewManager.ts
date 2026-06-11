import * as vscode from "vscode";
import { ConnectionManager } from "../connections/connectionManager";
import { MessageHandler } from "./messageHandler";

type WebviewPanelType = "table" | "query";

interface PanelInfo {
  panel: vscode.WebviewPanel;
  handler: MessageHandler;
  type: WebviewPanelType;
}

function getNonce(): string {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export class WebviewManager {
  private panels: Map<string, PanelInfo> = new Map();
  private extensionUri: vscode.Uri;

  constructor(private connectionManager: ConnectionManager, extensionUri: vscode.Uri) {
    this.extensionUri = extensionUri;
  }

  openTableView(connectionId: string, schema: string | undefined, table: string): void {
    const panelKey = `table:${connectionId}:${schema || ""}:${table}`;

    const existing = this.panels.get(panelKey);
    if (existing) {
      existing.panel.reveal();
      return;
    }

    const title = schema ? `${schema}.${table}` : table;
    this.createPanel(panelKey, title, "table", connectionId, { table, schema });
  }

  openQueryConsole(connectionId?: string): void {
    const connections = this.connectionManager.getConnections();
    const actualConnectionId = connectionId || connections[0]?.id || "";

    if (!actualConnectionId) {
      vscode.window.showErrorMessage("No database connections available");
      return;
    }

    const panelKey = `query:${actualConnectionId}:${Date.now()}`;
    const connection = connections.find((c) => c.id === actualConnectionId);
    const title = connection ? `Query Console - ${connection.name}` : "Query Console";

    this.createPanel(panelKey, title, "query", actualConnectionId, {});
  }

  private createPanel(
    key: string,
    title: string,
    type: WebviewPanelType,
    connectionId: string,
    context: Record<string, unknown>
  ): void {
    const panel = vscode.window.createWebviewPanel(
      `databaseViewer.${type}`,
      title,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "dist", "webview")],
      }
    );

    const handler = new MessageHandler(panel, this.connectionManager, connectionId);
    panel.webview.onDidReceiveMessage((msg) => handler.handleMessage(msg));

    panel.webview.html = this.getWebviewHtml(panel.webview, type, context);

    panel.onDidDispose(() => {
      this.panels.delete(key);
    });

    this.panels.set(key, { panel, handler, type });

    // Send initial context to webview
    panel.webview.postMessage({
      type: "init",
      panelType: type,
      connectionId,
      ...context,
    });
  }

  private getWebviewHtml(
    webview: vscode.Webview,
    type: string,
    context: Record<string, unknown>
  ): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "dist", "webview", "main.js")
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "dist", "webview", "style.css")
    );
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};">
  <link href="${styleUri}" rel="stylesheet">
  <title>${type === "table" ? "Table View" : "Query Console"}</title>
</head>
<body>
  <div id="root" data-panel-type="${type}" data-context='${JSON.stringify(context)}'></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  dispose(): void {
    for (const [, info] of this.panels) {
      info.panel.dispose();
    }
    this.panels.clear();
  }
}
