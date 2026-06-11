import Database from "better-sqlite3";
import { ColumnMeta, QueryResult, TableInfo } from "../../../shared/types";
import { DatabaseDriver, SqliteConnectionOptions } from "./types";

export class SqliteDriver implements DatabaseDriver {
  private db: Database.Database | null = null;
  private options: SqliteConnectionOptions;

  constructor(options: SqliteConnectionOptions) {
    this.options = options;
  }

  async connect(): Promise<void> {
    this.db = new Database(this.options.filePath);
    this.db.pragma("journal_mode = WAL");
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  isConnected(): boolean {
    return this.db !== null;
  }

  async execute(sql: string, params?: unknown[]): Promise<QueryResult> {
    if (!this.db) {
      throw new Error("Not connected");
    }

    const trimmed = sql.trim().toUpperCase();
    const isSelect = trimmed.startsWith("SELECT") || trimmed.startsWith("PRAGMA") || trimmed.startsWith("WITH");

    if (isSelect) {
      const stmt = this.db.prepare(sql);
      const rows = params ? stmt.all(...params) : stmt.all();
      const columns = stmt.columns().map((col) => ({
        name: col.name,
        dataType: col.type || "TEXT",
        nullable: true,
        isPrimaryKey: false,
      }));

      return { rows: rows as Record<string, unknown>[], columns, rowCount: rows.length };
    } else {
      const stmt = this.db.prepare(sql);
      const result = params ? stmt.run(...params) : stmt.run();
      return {
        rows: [],
        columns: [],
        rowCount: 0,
        affectedRows: result.changes,
      };
    }
  }

  async getTables(): Promise<TableInfo[]> {
    if (!this.db) {
      throw new Error("Not connected");
    }

    const rows = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all() as { name: string }[];

    return rows.map((row) => ({ name: row.name }));
  }

  async getColumns(table: string): Promise<ColumnMeta[]> {
    if (!this.db) {
      throw new Error("Not connected");
    }

    const columns = this.db.prepare(`PRAGMA table_info("${table}")`).all() as {
      cid: number;
      name: string;
      type: string;
      notnull: number;
      dflt_value: unknown;
      pk: number;
    }[];

    return columns.map((col) => ({
      name: col.name,
      dataType: col.type || "TEXT",
      nullable: col.notnull === 0 && col.pk === 0,
      isPrimaryKey: col.pk > 0,
    }));
  }

  async getPrimaryKey(table: string): Promise<string[]> {
    if (!this.db) {
      throw new Error("Not connected");
    }

    const columns = this.db.prepare(`PRAGMA table_info("${table}")`).all() as {
      name: string;
      pk: number;
    }[];

    return columns.filter((col) => col.pk > 0).map((col) => col.name);
  }
}
