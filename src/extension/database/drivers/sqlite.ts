import * as fs from "fs";
import * as path from "path";
import { ColumnMeta, QueryResult, TableInfo } from "../../../shared/types";
import { DatabaseDriver, SqliteConnectionOptions } from "./types";

export class SqliteDriver implements DatabaseDriver {
  private db: any = null;
  private options: SqliteConnectionOptions;
  private SQL: any = null;

  constructor(options: SqliteConnectionOptions) {
    this.options = options;
  }

  async connect(): Promise<void> {
    const initSqlJs = require("sql.js/dist/sql-asm.js");
    this.SQL = await initSqlJs();

    if (fs.existsSync(this.options.filePath)) {
      const buffer = fs.readFileSync(this.options.filePath);
      this.db = new this.SQL.Database(buffer);
    } else {
      this.db = new this.SQL.Database();
    }
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      this.save();
      this.db.close();
      this.db = null;
    }
  }

  isConnected(): boolean {
    return this.db !== null;
  }

  private save(): void {
    if (this.db) {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(this.options.filePath, buffer);
    }
  }

  async execute(sql: string, params?: unknown[]): Promise<QueryResult> {
    if (!this.db) {
      throw new Error("Not connected");
    }

    const stripped = sql.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").trim();
    const uppercased = stripped.toUpperCase();
    const isSelect = uppercased.startsWith("SELECT") || uppercased.startsWith("PRAGMA") || uppercased.startsWith("WITH");

    if (isSelect) {
      // Inline params into SQL for SELECT queries (sql.js exec param support is unreliable)
      let finalSql = sql;
      if (params && params.length > 0) {
        for (const param of params) {
          if (typeof param === "number") {
            finalSql = finalSql.replace("?", String(param));
          } else if (param === null) {
            finalSql = finalSql.replace("?", "NULL");
          } else {
            finalSql = finalSql.replace("?", `'${String(param).replace(/'/g, "''")}'`);
          }
        }
      }

      const results = this.db.exec(finalSql);

      if (results.length === 0) {
        return { rows: [], columns: [], rowCount: 0 };
      }

      const result = results[0];
      const colNames: string[] = result.columns;
      const rows: Record<string, unknown>[] = result.values.map((values: any[]) => {
        const row: Record<string, unknown> = {};
        for (let i = 0; i < colNames.length; i++) {
          row[colNames[i]] = values[i];
        }
        return row;
      });

      const columns: ColumnMeta[] = colNames.map((name) => ({
        name,
        dataType: "TEXT",
        nullable: true,
        isPrimaryKey: false,
      }));

      return { rows, columns, rowCount: rows.length };
    } else {
      // For write operations, use parameterized run
      if (params && params.length > 0) {
        this.db.run(sql, params);
      } else {
        this.db.run(sql);
      }
      const changes = this.db.getRowsModified();
      this.save();
      return {
        rows: [],
        columns: [],
        rowCount: 0,
        affectedRows: changes,
      };
    }
  }

  async getTables(): Promise<TableInfo[]> {
    if (!this.db) {
      throw new Error("Not connected");
    }

    const stmt = this.db.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );

    const tables: TableInfo[] = [];
    while (stmt.step()) {
      const row = stmt.get();
      tables.push({ name: row[0] as string });
    }
    stmt.free();

    return tables;
  }

  async getColumns(table: string): Promise<ColumnMeta[]> {
    if (!this.db) {
      throw new Error("Not connected");
    }

    const stmt = this.db.prepare(`PRAGMA table_info("${table}")`);
    const columns: ColumnMeta[] = [];

    while (stmt.step()) {
      const row = stmt.get();
      // PRAGMA table_info returns: cid, name, type, notnull, dflt_value, pk
      columns.push({
        name: row[1] as string,
        dataType: (row[2] as string) || "TEXT",
        nullable: row[3] === 0 && row[5] === 0,
        isPrimaryKey: (row[5] as number) > 0,
      });
    }
    stmt.free();

    return columns;
  }

  async getPrimaryKey(table: string): Promise<string[]> {
    if (!this.db) {
      throw new Error("Not connected");
    }

    const stmt = this.db.prepare(`PRAGMA table_info("${table}")`);
    const pks: string[] = [];

    while (stmt.step()) {
      const row = stmt.get();
      if ((row[5] as number) > 0) {
        pks.push(row[1] as string);
      }
    }
    stmt.free();

    return pks;
  }
}
