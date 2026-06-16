import { Pool, PoolConfig } from "pg";
import fs from "fs";
import { ColumnMeta, QueryResult, TableInfo } from "../../../shared/types";
import { DatabaseDriver, PostgresConnectionOptions } from "./types";

export class PostgresDriver implements DatabaseDriver {
  private pool: Pool | null = null;
  private options: PostgresConnectionOptions;

  constructor(options: PostgresConnectionOptions) {
    this.options = options;
  }

  async connect(): Promise<void> {
    const config: PoolConfig = {
      host: this.options.host,
      port: this.options.port,
      database: this.options.database,
      user: this.options.username,
      password: this.options.password,
      max: 5,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
    };

    if (this.options.ssl) {
      config.ssl = {
        rejectUnauthorized: this.options.ssl.rejectUnauthorized,
        ca: this.options.ssl.ca ? fs.readFileSync(this.options.ssl.ca, "utf-8") : undefined,
        cert: this.options.ssl.cert ? fs.readFileSync(this.options.ssl.cert, "utf-8") : undefined,
        key: this.options.ssl.key ? fs.readFileSync(this.options.ssl.key, "utf-8") : undefined,
      };
    }

    this.pool = new Pool(config);
    const client = await this.pool.connect();
    client.release();
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  isConnected(): boolean {
    return this.pool !== null;
  }

  async execute(sql: string, params?: unknown[]): Promise<QueryResult> {
    if (!this.pool) {
      throw new Error("Not connected");
    }

    let convertedSql = sql;
    if (params && params.length > 0) {
      let paramIndex = 1;
      convertedSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
    }

    const result = await this.pool.query(convertedSql, params);

    if (result.fields && result.fields.length > 0) {
      const columns: ColumnMeta[] = result.fields.map((field) => ({
        name: field.name,
        dataType: field.dataTypeID.toString(),
        nullable: true,
        isPrimaryKey: false,
      }));

      return {
        rows: result.rows,
        columns,
        rowCount: result.rowCount ?? result.rows.length,
      };
    }

    return {
      rows: [],
      columns: [],
      rowCount: 0,
      affectedRows: result.rowCount ?? 0,
    };
  }

  async getTables(): Promise<TableInfo[]> {
    if (!this.pool) {
      throw new Error("Not connected");
    }

    const result = await this.pool.query(`
      SELECT table_name, table_schema
      FROM information_schema.tables
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
        AND table_type = 'BASE TABLE'
      ORDER BY table_schema, table_name
    `);

    return result.rows.map((row) => ({
      name: row.table_name,
      schema: row.table_schema,
    }));
  }

  async getColumns(table: string, schema?: string): Promise<ColumnMeta[]> {
    if (!this.pool) {
      throw new Error("Not connected");
    }

    const targetSchema = schema || "public";

    const pkResult = await this.pool.query(
      `
      SELECT a.attname
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = $1::regclass AND i.indisprimary
    `,
      [`"${targetSchema}"."${table}"`]
    );
    const pkColumns = new Set(pkResult.rows.map((r) => r.attname));

    const result = await this.pool.query(
      `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = $1 AND table_schema = $2
      ORDER BY ordinal_position
    `,
      [table, targetSchema]
    );

    return result.rows.map((row) => ({
      name: row.column_name,
      dataType: row.data_type,
      nullable: row.is_nullable === "YES" && !pkColumns.has(row.column_name),
      isPrimaryKey: pkColumns.has(row.column_name),
    }));
  }

  async getPrimaryKey(table: string, schema?: string): Promise<string[]> {
    if (!this.pool) {
      throw new Error("Not connected");
    }

    const targetSchema = schema || "public";

    const result = await this.pool.query(
      `
      SELECT a.attname
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = $1::regclass AND i.indisprimary
      ORDER BY array_position(i.indkey, a.attnum)
    `,
      [`"${targetSchema}"."${table}"`]
    );

    return result.rows.map((r) => r.attname);
  }
}
