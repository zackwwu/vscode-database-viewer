import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PostgresDriver } from "../../../../src/extension/database/drivers/postgres";
import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";

describe("PostgresDriver", () => {
  let container: StartedPostgreSqlContainer;
  let driver: PostgresDriver;

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    driver = new PostgresDriver({
      host: container.getHost(),
      port: container.getPort(),
      database: container.getDatabase(),
      username: container.getUsername(),
      password: container.getPassword(),
    });
  }, 60000);

  afterAll(async () => {
    if (driver.isConnected()) {
      await driver.disconnect();
    }
    await container.stop();
  });

  describe("connect/disconnect", () => {
    it("connects to PostgreSQL", async () => {
      await driver.connect();
      expect(driver.isConnected()).toBe(true);
    });

    it("disconnects cleanly", async () => {
      await driver.disconnect();
      expect(driver.isConnected()).toBe(false);
      await driver.connect();
    });
  });

  describe("execute", () => {
    beforeEach(async () => {
      if (!driver.isConnected()) await driver.connect();
      await driver.execute("DROP TABLE IF EXISTS users");
      await driver.execute(
        "CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL, email VARCHAR(200), age INTEGER)"
      );
      await driver.execute("INSERT INTO users (name, email, age) VALUES ($1, $2, $3)", ["Alice", "alice@test.com", 30]);
      await driver.execute("INSERT INTO users (name, email, age) VALUES ($1, $2, $3)", ["Bob", "bob@test.com", 25]);
    });

    it("returns rows for SELECT", async () => {
      const result = await driver.execute("SELECT * FROM users ORDER BY id");
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].name).toBe("Alice");
      expect(result.columns.length).toBeGreaterThanOrEqual(4);
      expect(result.rowCount).toBe(2);
    });

    it("supports parameterized queries", async () => {
      const result = await driver.execute("SELECT * FROM users WHERE age > $1", [26]);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].name).toBe("Alice");
    });

    it("returns affectedRows for UPDATE", async () => {
      const result = await driver.execute("UPDATE users SET age = $1 WHERE name = $2", [31, "Alice"]);
      expect(result.affectedRows).toBe(1);
    });

    it("returns affectedRows for DELETE", async () => {
      const result = await driver.execute("DELETE FROM users WHERE age < $1", [30]);
      expect(result.affectedRows).toBe(1);
    });
  });

  describe("getTables", () => {
    beforeEach(async () => {
      if (!driver.isConnected()) await driver.connect();
      await driver.execute("DROP TABLE IF EXISTS orders");
      await driver.execute("DROP TABLE IF EXISTS users");
      await driver.execute("CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT)");
      await driver.execute("CREATE TABLE orders (id SERIAL PRIMARY KEY, user_id INTEGER)");
    });

    it("returns tables with schema info", async () => {
      const tables = await driver.getTables();
      const tableNames = tables.map((t) => t.name);
      expect(tableNames).toContain("users");
      expect(tableNames).toContain("orders");
      const usersTable = tables.find((t) => t.name === "users")!;
      expect(usersTable.schema).toBe("public");
    });

    it("excludes system tables", async () => {
      const tables = await driver.getTables();
      const tableNames = tables.map((t) => t.name);
      expect(tableNames).not.toContain("pg_class");
    });
  });

  describe("getColumns", () => {
    beforeEach(async () => {
      if (!driver.isConnected()) await driver.connect();
      await driver.execute("DROP TABLE IF EXISTS users");
      await driver.execute(
        "CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL, email TEXT)"
      );
    });

    it("returns column metadata with types", async () => {
      const columns = await driver.getColumns("users", "public");
      expect(columns).toHaveLength(3);

      const idCol = columns.find((c) => c.name === "id")!;
      expect(idCol.dataType).toBe("integer");
      expect(idCol.nullable).toBe(false);
      expect(idCol.isPrimaryKey).toBe(true);

      const nameCol = columns.find((c) => c.name === "name")!;
      expect(nameCol.dataType).toBe("character varying");
      expect(nameCol.nullable).toBe(false);

      const emailCol = columns.find((c) => c.name === "email")!;
      expect(emailCol.dataType).toBe("text");
      expect(emailCol.nullable).toBe(true);
    });
  });

  describe("getPrimaryKey", () => {
    beforeEach(async () => {
      if (!driver.isConnected()) await driver.connect();
    });

    it("returns single-column primary key", async () => {
      await driver.execute("DROP TABLE IF EXISTS users");
      await driver.execute("CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT)");
      const pk = await driver.getPrimaryKey("users", "public");
      expect(pk).toEqual(["id"]);
    });

    it("returns composite primary key", async () => {
      await driver.execute("DROP TABLE IF EXISTS order_items");
      await driver.execute(
        "CREATE TABLE order_items (order_id INTEGER, item_id INTEGER, qty INTEGER, PRIMARY KEY (order_id, item_id))"
      );
      const pk = await driver.getPrimaryKey("order_items", "public");
      expect(pk.sort()).toEqual(["item_id", "order_id"]);
    });

    it("returns empty array for table without PK", async () => {
      await driver.execute("DROP TABLE IF EXISTS logs");
      await driver.execute("CREATE TABLE logs (message TEXT, ts TIMESTAMP)");
      const pk = await driver.getPrimaryKey("logs", "public");
      expect(pk).toEqual([]);
    });
  });
});
