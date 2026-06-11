import { ColumnMeta, QueryResult, TableInfo } from "../../../shared/types";

export interface DatabaseDriver {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  execute(sql: string, params?: unknown[]): Promise<QueryResult>;
  getTables(): Promise<TableInfo[]>;
  getColumns(table: string, schema?: string): Promise<ColumnMeta[]>;
  getPrimaryKey(table: string, schema?: string): Promise<string[]>;
}

export interface PostgresConnectionOptions {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: {
    ca?: string;
    cert?: string;
    key?: string;
    rejectUnauthorized: boolean;
  };
}

export interface SqliteConnectionOptions {
  filePath: string;
}
