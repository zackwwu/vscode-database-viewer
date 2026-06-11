import * as vscode from "vscode";
import { ConnectionManager } from "./connections/connectionManager";
import { DatabaseTreeProvider } from "./tree/treeProvider";

export function activate(context: vscode.ExtensionContext) {
  const connectionManager = new ConnectionManager(context);
  const treeProvider = new DatabaseTreeProvider(connectionManager);

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
        vscode.window.showInformationMessage(`Open table: ${table} - coming soon`);
      }
    ),
    vscode.commands.registerCommand("databaseViewer.openQuery", () => {
      vscode.window.showInformationMessage("Query Console - coming soon");
    })
  );
}

export function deactivate() {}
