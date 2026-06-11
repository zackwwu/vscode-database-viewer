import * as vscode from "vscode";
import { ConnectionManager } from "../connections/connectionManager";
import { MessageHandler } from "./messageHandler";

type WebviewPanelType = "table" | "query" | "connection-form";

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

    this.createPanel(panelKey, title, "query", actualConnectionId, {
      connections: connections.map((c) => ({
        id: c.id,
        name: c.name,
        driver: c.driver,
      })),
    });
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
    } as any);
  }

  openConnectionForm(existingConfig?: any): void {
    const panelKey = existingConfig ? `conn-form:${existingConfig.id}` : `conn-form:new-${Date.now()}`;
    const title = existingConfig ? `Edit: ${existingConfig.name}` : "New Connection";

    const existing = this.panels.get(panelKey);
    if (existing) {
      existing.panel.reveal();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "databaseViewer.connectionForm",
      title,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "dist", "webview")],
      }
    );

    panel.webview.html = this.getWebviewHtml(panel.webview, "connection-form", {});

    // Override message handler for connection form
    panel.webview.onDidReceiveMessage(async (msg: any) => {
      if (msg.type === "test-connection") {
        try {
          const { SqliteDriver } = await import("../database/drivers/sqlite");
          const { PostgresDriver } = await import("../database/drivers/postgres");

          const config = msg.config;
          let driver: any;

          if (config.driver === "sqlite") {
            driver = new SqliteDriver({ filePath: config.filePath! });
          } else {
            // Get stored password if not provided
            let pwd = "";
            if (config.username) {
              const stored = await this.connectionManager.getPassword(config.id);
              pwd = stored || "";
            }
            driver = new PostgresDriver({
              host: config.host,
              port: config.port,
              database: config.database,
              username: config.username,
              password: pwd,
              ssl: config.ssl
                ? {
                    ca: config.ssl.caFile,
                    cert: config.ssl.clientCertFile,
                    key: config.ssl.clientKeyFile,
                    rejectUnauthorized: config.ssl.rejectUnauthorized,
                  }
                : undefined,
            });
          }

          await driver.connect();
          await driver.disconnect();
          panel.webview.postMessage({
            type: "connection-test-result",
            requestId: msg.requestId,
            success: true,
          });
        } catch (error) {
          panel.webview.postMessage({
            type: "connection-test-result",
            requestId: msg.requestId,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      } else if (msg.type === "save-connection") {
        try {
          const config = msg.config;
          const isUpdate = existingConfig && existingConfig.id === config.id;

          if (isUpdate) {
            await this.connectionManager.updateConnection(config, msg.password);
          } else {
            await this.connectionManager.addConnection(config, msg.password);
          }

          panel.webview.postMessage({ type: "connection-saved", requestId: msg.requestId });
          panel.dispose();
        } catch (error) {
          panel.webview.postMessage({
            type: "error",
            requestId: msg.requestId,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    });

    panel.onDidDispose(() => {
      this.panels.delete(panelKey);
    });

    this.panels.set(panelKey, { panel, handler: null as any, type: "connection-form" });

    // Send init message
    panel.webview.postMessage({
      type: "init",
      panelType: "connection-form",
      existingConfig: existingConfig || undefined,
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

    const titleMap: Record<string, string> = {
      table: "Table View",
      query: "Query Console",
      "connection-form": "Connection Form",
    };

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};">
  <link href="${styleUri}" rel="stylesheet">
  <title>${titleMap[type] || "Database Viewer"}</title>
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
