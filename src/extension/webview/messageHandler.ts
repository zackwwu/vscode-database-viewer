import * as vscode from "vscode";
import { WebviewMessage, ExtensionMessage } from "../../shared/messages";
import { ConnectionManager } from "../connections/connectionManager";
import { QueryExecutor } from "../database/queryExecutor";

export class MessageHandler {
  private queryExecutor: QueryExecutor;

  constructor(
    private panel: vscode.WebviewPanel,
    private connectionManager: ConnectionManager,
    private connectionId: string
  ) {
    this.queryExecutor = new QueryExecutor(connectionManager);
  }

  handleMessage(msg: WebviewMessage): void {
    switch (msg.type) {
      case "fetch-table-data":
        this.handleFetchTableData(msg).catch((e) => {
          console.error("handleFetchTableData error:", e);
          this.sendResponse({ type: "error", requestId: msg.requestId, message: String(e) });
        });
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

  private async handleFetchTableData(
    msg: Extract<WebviewMessage, { type: "fetch-table-data" }>
  ): Promise<void> {
    try {
      const { rows, columns } = await this.queryExecutor.fetchTableData(
        this.connectionId,
        msg.table,
        msg.schema,
        msg.where,
        msg.orderBy,
        msg.limit,
        msg.offset
      );
      this.sendResponse({
        type: "table-data",
        requestId: msg.requestId,
        rows,
        columns,
      });
    } catch (error) {
      this.sendResponse({
        type: "error",
        requestId: msg.requestId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async handleUpdateRows(
    msg: Extract<WebviewMessage, { type: "update-rows" }>
  ): Promise<void> {
    try {
      const result = await this.queryExecutor.updateRows(
        this.connectionId,
        msg.table,
        msg.schema,
        msg.changes
      );
      if (result.errors.length > 0) {
        this.sendResponse({
          type: "update-error",
          requestId: msg.requestId,
          errors: result.errors,
        });
      } else {
        this.sendResponse({
          type: "update-success",
          requestId: msg.requestId,
          updatedCount: result.updatedCount,
        });
      }
    } catch (error) {
      this.sendResponse({
        type: "error",
        requestId: msg.requestId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async handleExecuteQuery(
    msg: Extract<WebviewMessage, { type: "execute-query" }>
  ): Promise<void> {
    try {
      this.sendResponse({ type: "loading", requestId: msg.requestId, loading: true });
      const targetId = msg.connectionId || this.connectionId;
      const { results, executionTimeMs } = await this.queryExecutor.executeQuery(targetId, msg.sql);
      this.sendResponse({
        type: "query-results",
        requestId: msg.requestId,
        results,
        executionTimeMs,
      });
    } catch (error) {
      this.sendResponse({
        type: "error",
        requestId: msg.requestId,
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.sendResponse({ type: "loading", requestId: msg.requestId, loading: false });
    }
  }

  private handleGetSchema(msg: Extract<WebviewMessage, { type: "get-schema" }>): void {
    this.sendResponse({ type: "error", requestId: msg.requestId, message: "Not implemented" });
  }

  private handleCancelQuery(msg: Extract<WebviewMessage, { type: "cancel-query" }>): void {
    // Will be implemented with query executor
  }

  private async handleCountRows(
    msg: Extract<WebviewMessage, { type: "count-rows" }>
  ): Promise<void> {
    try {
      const count = await this.queryExecutor.countRows(
        this.connectionId,
        msg.table,
        msg.schema,
        msg.where
      );
      this.sendResponse({
        type: "row-count",
        requestId: msg.requestId,
        count,
      });
    } catch (error) {
      this.sendResponse({
        type: "error",
        requestId: msg.requestId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
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
