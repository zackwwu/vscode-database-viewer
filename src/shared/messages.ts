import { ColumnMeta, ConnectionConfig, QueryResult, RowChange, TableInfo } from "./types";

export type WebviewMessage =
  | { type: "fetch-table-data"; requestId: string; table: string; schema?: string; where?: string; orderBy?: string; limit: number; offset: number }
  | { type: "update-rows"; requestId: string; table: string; schema?: string; changes: RowChange[] }
  | { type: "execute-query"; requestId: string; sql: string; connectionId: string }
  | { type: "get-schema"; requestId: string; connectionId: string }
  | { type: "cancel-query"; requestId: string; queryId: string }
  | { type: "count-rows"; requestId: string; table: string; schema?: string; where?: string }
  | { type: "test-connection"; requestId: string; config: ConnectionConfig }
  | { type: "save-connection"; requestId: string; config: ConnectionConfig; password?: string }
  | { type: "delete-connection"; requestId: string; connectionId: string };

export type ExtensionMessage =
  | { type: "table-data"; requestId: string; rows: Record<string, unknown>[]; columns: ColumnMeta[]; totalCount?: number }
  | { type: "query-results"; requestId: string; results: QueryResult[]; executionTimeMs: number }
  | { type: "update-success"; requestId: string; updatedCount: number }
  | { type: "update-error"; requestId: string; errors: { rowKey: Record<string, unknown>; message: string }[] }
  | { type: "schema-info"; requestId: string; tables: TableInfo[] }
  | { type: "row-count"; requestId: string; count: number }
  | { type: "error"; requestId: string; message: string }
  | { type: "loading"; requestId: string; loading: boolean }
  | { type: "connection-test-result"; requestId: string; success: boolean; error?: string }
  | { type: "connection-saved"; requestId: string }
  | { type: "connection-deleted"; requestId: string };

export function createRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
