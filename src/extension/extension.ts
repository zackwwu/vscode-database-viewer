import * as vscode from "vscode";
import { ConnectionManager } from "./connections/connectionManager";
import { DatabaseTreeProvider } from "./tree/treeProvider";
import { WebviewManager } from "./webview/webviewManager";
import { DatabaseTreeItem } from "./tree/treeNodes";

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
      webviewManager.openConnectionForm();
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
    vscode.commands.registerCommand("databaseViewer.openQuery", (nodeOrId?: DatabaseTreeItem | string) => {
      const connectionId = typeof nodeOrId === "string" ? nodeOrId : nodeOrId?.connectionId;
      webviewManager.openQueryConsole(connectionId);
    }),
    vscode.commands.registerCommand("databaseViewer.editConnection", (node: DatabaseTreeItem) => {
      if (node.connectionId) {
        const config = connectionManager.getConnection(node.connectionId);
        if (config) {
          webviewManager.openConnectionForm(config);
        }
      }
    }),
    vscode.commands.registerCommand("databaseViewer.deleteConnection", async (node: DatabaseTreeItem) => {
      if (node.connectionId) {
        const config = connectionManager.getConnection(node.connectionId);
        const confirm = await vscode.window.showWarningMessage(
          `Delete connection "${config?.name}"?`,
          { modal: true },
          "Delete"
        );
        if (confirm === "Delete") {
          await connectionManager.deleteConnection(node.connectionId);
          treeProvider.refresh();
        }
      }
    }),
    vscode.commands.registerCommand("databaseViewer.disconnect", async (node: DatabaseTreeItem) => {
      if (node.connectionId) {
        try {
          const driver = await connectionManager.getDriver(node.connectionId);
          await driver.disconnect();
          treeProvider.refresh();
          vscode.window.showInformationMessage("Disconnected.");
        } catch (error) {
          vscode.window.showErrorMessage(
            `Disconnect failed: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    })
  );
}

export function deactivate() {}
