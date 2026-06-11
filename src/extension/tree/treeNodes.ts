import * as vscode from "vscode";

export type TreeNodeType = "connection" | "schema" | "table" | "column" | "addConnection";

export interface DatabaseTreeItem extends vscode.TreeItem {
  nodeType: TreeNodeType;
  connectionId: string;
  schema?: string;
  tableName?: string;
}

export function createConnectionNode(
  id: string,
  name: string,
  driver: string,
  connected: boolean
): DatabaseTreeItem {
  const node: DatabaseTreeItem = {
    label: name,
    nodeType: "connection",
    connectionId: id,
    collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
    contextValue: "connection",
    description: driver,
    iconPath: new vscode.ThemeIcon(connected ? "database" : "circle-outline"),
  } as DatabaseTreeItem;
  return node;
}

export function createSchemaNode(connectionId: string, schemaName: string): DatabaseTreeItem {
  return {
    label: schemaName,
    nodeType: "schema",
    connectionId,
    schema: schemaName,
    collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
    contextValue: "schema",
    iconPath: new vscode.ThemeIcon("symbol-namespace"),
  } as DatabaseTreeItem;
}

export function createTableNode(
  connectionId: string,
  tableName: string,
  schema?: string
): DatabaseTreeItem {
  return {
    label: tableName,
    nodeType: "table",
    connectionId,
    schema,
    tableName,
    collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
    contextValue: "table",
    iconPath: new vscode.ThemeIcon("table"),
    command: {
      command: "databaseViewer.openTable",
      title: "Open Table",
      arguments: [connectionId, schema, tableName],
    },
  } as DatabaseTreeItem;
}

export function createColumnNode(
  name: string,
  dataType: string,
  isPrimaryKey: boolean
): DatabaseTreeItem {
  const label = isPrimaryKey ? `${name} (PK)` : name;
  return {
    label,
    nodeType: "column",
    connectionId: "",
    collapsibleState: vscode.TreeItemCollapsibleState.None,
    contextValue: "column",
    description: dataType,
    iconPath: new vscode.ThemeIcon(isPrimaryKey ? "key" : "symbol-field"),
  } as DatabaseTreeItem;
}

export function createAddConnectionNode(): DatabaseTreeItem {
  return {
    label: "+ Add Connection...",
    nodeType: "addConnection",
    connectionId: "",
    collapsibleState: vscode.TreeItemCollapsibleState.None,
    contextValue: "addConnection",
    command: {
      command: "databaseViewer.addConnection",
      title: "Add Connection",
    },
  } as DatabaseTreeItem;
}
