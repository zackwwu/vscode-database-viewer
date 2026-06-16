import { ConnectionManager } from "../connections/connectionManager";
import { QueryResult, RowChange, ColumnMeta } from "../../shared/types";

export class QueryExecutor {
  constructor(private connectionManager: ConnectionManager) {}

  async fetchTableData(
    connectionId: string,
    table: string,
    schema?: string,
    where?: string,
    orderBy?: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ rows: Record<string, unknown>[]; columns: ColumnMeta[] }> {
    const driver = await this.connectionManager.getDriver(connectionId);

    const columns = await driver.getColumns(table, schema);

    const qualifiedTable = schema ? `"${schema}"."${table}"` : `"${table}"`;
    let sql = `SELECT * FROM ${qualifiedTable}`;
    const params: unknown[] = [];

    if (where) sql += ` WHERE ${where}`;
    if (orderBy) sql += ` ORDER BY ${orderBy}`;
    sql += ` LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const result = await driver.execute(sql, params);
    return { rows: result.rows, columns };
  }

  async countRows(
    connectionId: string,
    table: string,
    schema?: string,
    where?: string
  ): Promise<number> {
    const driver = await this.connectionManager.getDriver(connectionId);

    const qualifiedTable = schema ? `"${schema}"."${table}"` : `"${table}"`;
    let sql = `SELECT COUNT(*) as count FROM ${qualifiedTable}`;
    if (where) sql += ` WHERE ${where}`;

    const result = await driver.execute(sql);
    return Number(result.rows[0]?.count ?? 0);
  }

  async updateRows(
    connectionId: string,
    table: string,
    schema: string | undefined,
    changes: RowChange[]
  ): Promise<{ updatedCount: number; errors: { rowKey: Record<string, unknown>; message: string }[] }> {
    const driver = await this.connectionManager.getDriver(connectionId);

    const qualifiedTable = schema ? `"${schema}"."${table}"` : `"${table}"`;
    const errors: { rowKey: Record<string, unknown>; message: string }[] = [];
    let updatedCount = 0;

    // Execute all updates in a transaction
    try {
      await driver.execute("BEGIN");

      for (const change of changes) {
        try {
          const setClauses: string[] = [];
          const whereClause: string[] = [];
          const params: unknown[] = [];

          for (const [col, val] of Object.entries(change.updates)) {
            setClauses.push(`"${col}" = ?`);
            params.push(val);
          }

          for (const [col, val] of Object.entries(change.primaryKey)) {
            whereClause.push(`"${col}" = ?`);
            params.push(val);
          }

          const sql = `UPDATE ${qualifiedTable} SET ${setClauses.join(", ")} WHERE ${whereClause.join(" AND ")}`;
          const result = await driver.execute(sql, params);
          if (result.affectedRows === 0) {
            errors.push({ rowKey: change.primaryKey, message: "Row not found" });
          } else {
            updatedCount++;
          }
        } catch (error) {
          errors.push({
            rowKey: change.primaryKey,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }

      if (errors.length > 0) {
        await driver.execute("ROLLBACK");
        return { updatedCount: 0, errors };
      }

      await driver.execute("COMMIT");
      return { updatedCount, errors: [] };
    } catch (error) {
      try {
        await driver.execute("ROLLBACK");
      } catch {}
      throw error;
    }
  }

  async executeQuery(
    connectionId: string,
    sql: string
  ): Promise<{ results: QueryResult[]; executionTimeMs: number }> {
    const driver = await this.connectionManager.getDriver(connectionId);
    const startTime = Date.now();

    // Split on semicolons for multi-statement support (simple split)
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const results: QueryResult[] = [];
    for (const stmt of statements) {
      const result = await driver.execute(stmt);
      results.push(result);
    }

    return { results, executionTimeMs: Date.now() - startTime };
  }
}
