export interface ConnectionConfig {
  id: string;
  name: string;
  driver: "postgres" | "sqlite";
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  ssl?: {
    enabled: boolean;
    caFile?: string;
    clientCertFile?: string;
    clientKeyFile?: string;
    rejectUnauthorized: boolean;
  };
  filePath?: string;
}

export interface ColumnMeta {
  name: string;
  dataType: string;
  nullable: boolean;
  isPrimaryKey: boolean;
}

export interface TableInfo {
  name: string;
  schema?: string;
}

export interface QueryResult {
  rows: Record<string, unknown>[];
  columns: ColumnMeta[];
  rowCount: number;
  affectedRows?: number;
}

export interface RowChange {
  primaryKey: Record<string, unknown>;
  updates: Record<string, unknown>;
}
