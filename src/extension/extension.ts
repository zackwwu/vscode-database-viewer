import * as vscode from "vscode";
import { ConnectionManager } from "./connections/connectionManager";
import { DatabaseTreeProvider } from "./tree/treeProvider";
import { WebviewManager } from "./webview/webviewManager";

export function activate(context: vscode.ExtensionContext) {
  const connectionManager = new ConnectionManager(context);
  const treeProvider = new DatabaseTreeProvider(connectionManager);
  const webviewManager = new WebviewManager(connectionManager, context.extensionUri);

  const treeView = vscode.window.createTreeView("databaseViewer.connections", {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });

  context.subscriptions.push(
    treeView,
    vscode.commands.registerCommand("databaseViewer.addConnection", () => {
      vscode.window.showInformationMessage("Add Connection - coming soon");
    }),
    vscode.commands.registerCommand("databaseViewer.refresh", () => {
      treeProvider.refresh();
    }),
    vscode.commands.registerCommand(
      "databaseViewer.openTable",
      (connectionId: string, schema: string | undefined, table: string) => {
        webviewManager.openTableView(connectionId, schema, table);
      }
    ),
    vscode.commands.registerCommand("databaseViewer.openQuery", (connectionId?: string) => {
      webviewManager.openQueryConsole(connectionId);
    })
  );
}

export function deactivate() {}
