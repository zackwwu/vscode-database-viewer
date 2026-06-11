import * as vscode from "vscode";
import { WebviewMessage, ExtensionMessage } from "../../shared/messages";

export class MessageHandler {
  constructor(private panel: vscode.WebviewPanel) {}

  handleMessage(msg: WebviewMessage): void {
    switch (msg.type) {
      case "fetch-table-data":
        this.handleFetchTableData(msg);
        break;
      case "update-rows":
        this.handleUpdateRows(msg);
        break;
      case "execute-query":
        this.handleExecuteQuery(msg);
        break;
      case "get-schema":
        this.handleGetSchema(msg);
        break;
      case "cancel-query":
        this.handleCancelQuery(msg);
        break;
      case "count-rows":
        this.handleCountRows(msg);
        break;
      case "test-connection":
        this.handleTestConnection(msg);
        break;
      case "save-connection":
        this.handleSaveConnection(msg);
        break;
      case "delete-connection":
        this.handleDeleteConnection(msg);
        break;
    }
  }

  private sendResponse(msg: ExtensionMessage): void {
    this.panel.webview.postMessage(msg);
  }

  private handleFetchTableData(msg: Extract<WebviewMessage, { type: "fetch-table-data" }>): void {
    this.sendResponse({ type: "error", requestId: msg.requestId, message: "Not implemented" });
  }

  private handleUpdateRows(msg: Extract<WebviewMessage, { type: "update-rows" }>): void {
    this.sendResponse({ type: "error", requestId: msg.requestId, message: "Not implemented" });
  }

  private handleExecuteQuery(msg: Extract<WebviewMessage, { type: "execute-query" }>): void {
    this.sendResponse({ type: "error", requestId: msg.requestId, message: "Not implemented" });
  }

  private handleGetSchema(msg: Extract<WebviewMessage, { type: "get-schema" }>): void {
    this.sendResponse({ type: "error", requestId: msg.requestId, message: "Not implemented" });
  }

  private handleCancelQuery(msg: Extract<WebviewMessage, { type: "cancel-query" }>): void {
    // Will be implemented with query executor
  }

  private handleCountRows(msg: Extract<WebviewMessage, { type: "count-rows" }>): void {
    this.sendResponse({ type: "error", requestId: msg.requestId, message: "Not implemented" });
  }

  private handleTestConnection(msg: Extract<WebviewMessage, { type: "test-connection" }>): void {
    this.sendResponse({ type: "error", requestId: msg.requestId, message: "Not implemented" });
  }

  private handleSaveConnection(msg: Extract<WebviewMessage, { type: "save-connection" }>): void {
    this.sendResponse({ type: "error", requestId: msg.requestId, message: "Not implemented" });
  }

  private handleDeleteConnection(msg: Extract<WebviewMessage, { type: "delete-connection" }>): void {
    this.sendResponse({ type: "error", requestId: msg.requestId, message: "Not implemented" });
  }
}
