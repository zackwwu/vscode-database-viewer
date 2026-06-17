import * as vscode from "vscode";
import { ConnectionManager } from "../connections/connectionManager";
import {
  DatabaseTreeItem,
  createAddConnectionNode,
  createColumnNode,
  createConnectionNode,
  createSchemaNode,
  createTableNode,
} from "./treeNodes";

export class DatabaseTreeProvider implements vscode.TreeDataProvider<DatabaseTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<DatabaseTreeItem | undefined | null>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private connectionManager: ConnectionManager) {
    connectionManager.onDidChangeConnections(() => {
      this._onDidChangeTreeData.fire(undefined);
    });
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: DatabaseTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: DatabaseTreeItem): Promise<DatabaseTreeItem[]> {
    if (!element) {
      return this.getRootChildren();
    }

    switch (element.nodeType) {
      case "connection":
        return this.getConnectionChildren(element);
      case "schema":
        return this.getSchemaChildren(element);
      case "table":
        return this.getTableChildren(element);
      default:
        return [];
    }
  }

  private getRootChildren(): DatabaseTreeItem[] {
    const connections = this.connectionManager.getConnections();
    return connections.map((conn) =>
      createConnectionNode(conn.id, conn.name, conn.driver, this.connectionManager.isConnected(conn.id))
    );
  }

  private async getConnectionChildren(node: DatabaseTreeItem): Promise<DatabaseTreeItem[]> {
    try {
      const wasConnected = this.connectionManager.isConnected(node.connectionId);
      const driver = await this.connectionManager.getDriver(node.connectionId);
      if (!wasConnected) {
        this._onDidChangeTreeData.fire(undefined);
      }
      const tables = await driver.getTables();

      const schemas = new Set(tables.map((t) => t.schema).filter(Boolean));

      if (schemas.size > 0) {
        return Array.from(schemas).map((schema) => createSchemaNode(node.connectionId, schema!));
      }

      return tables.map((t) => createTableNode(node.connectionId, t.name));
    } catch (error) {
      console.error(`Error loading tables for connection ${node.connectionId}:`, error);
      return [];
    }
  }

  private async getSchemaChildren(node: DatabaseTreeItem): Promise<DatabaseTreeItem[]> {
    try {
      const driver = await this.connectionManager.getDriver(node.connectionId);
      const tables = await driver.getTables();
      return tables
        .filter((t) => t.schema === node.schema)
        .map((t) => createTableNode(node.connectionId, t.name, node.schema));
    } catch (error) {
      console.error(`Error loading tables for schema ${node.schema}:`, error);
      return [];
    }
  }

  private async getTableChildren(node: DatabaseTreeItem): Promise<DatabaseTreeItem[]> {
    try {
      const driver = await this.connectionManager.getDriver(node.connectionId);
      const columns = await driver.getColumns(node.tableName!, node.schema);
      return columns.map((col) => createColumnNode(col.name, col.dataType, col.isPrimaryKey));
    } catch (error) {
      console.error(`Error loading columns for table ${node.tableName}:`, error);
      return [];
    }
  }
}
