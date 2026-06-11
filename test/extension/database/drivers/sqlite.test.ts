import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteDriver } from "../../../../src/extension/database/drivers/sqlite";
import fs from "fs";
import path from "path";
import os from "os";

describe("SqliteDriver", () => {
  let driver: SqliteDriver;
  let dbPath: string;

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `test-${Date.now()}.db`);
    driver = new SqliteDriver({ filePath: dbPath });
  });

  afterEach(async () => {
    if (driver.isConnected()) {
      await driver.disconnect();
    }
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  describe("connect/disconnect", () => {
    it("connects to a new database file", async () => {
      await driver.connect();
      expect(driver.isConnected()).toBe(true);
    });

    it("disconnects cleanly", async () => {
      await driver.connect();
      await driver.disconnect();
      expect(driver.isConnected()).toBe(false);
    });
  });

  describe("execute", () => {
    beforeEach(async () => {
      await driver.connect();
      await driver.execute(
        "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT, age INTEGER)"
      );
      await driver.execute("INSERT INTO users (name, email, age) VALUES (?, ?, ?)", ["Alice", "alice@test.com", 30]);
      await driver.execute("INSERT INTO users (name, email, age) VALUES (?, ?, ?)", ["Bob", "bob@test.com", 25]);
    });

    it("returns rows for SELECT", async () => {
      const result = await driver.execute("SELECT * FROM users ORDER BY id");
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]).toEqual({ id: 1, name: "Alice", email: "alice@test.com", age: 30 });
      expect(result.columns).toHaveLength(4);
      expect(result.rowCount).toBe(2);
    });

    it("supports parameterized queries", async () => {
      const result = await driver.execute("SELECT * FROM users WHERE age > ?", [26]);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].name).toBe("Alice");
    });

    it("returns affectedRows for UPDATE", async () => {
      const result = await driver.execute("UPDATE users SET age = ? WHERE name = ?", [31, "Alice"]);
      expect(result.affectedRows).toBe(1);
    });

    it("returns affectedRows for DELETE", async () => {
      const result = await driver.execute("DELETE FROM users WHERE age < ?", [30]);
      expect(result.affectedRows).toBe(1);
    });
  });

  describe("getTables", () => {
    beforeEach(async () => {
      await driver.connect();
      await driver.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)");
      await driver.execute("CREATE TABLE orders (id INTEGER PRIMARY KEY, user_id INTEGER)");
    });

    it("returns all tables", async () => {
      const tables = await driver.getTables();
      expect(tables).toHaveLength(2);
      expect(tables.map((t) => t.name).sort()).toEqual(["orders", "users"]);
      expect(tables[0].schema).toBeUndefined();
    });
  });

  describe("getColumns", () => {
    beforeEach(async () => {
      await driver.connect();
      await driver.execute(
        "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT)"
      );
    });

    it("returns column metadata", async () => {
      const columns = await driver.getColumns("users");
      expect(columns).toHaveLength(3);

      const idCol = columns.find((c) => c.name === "id")!;
      expect(idCol.dataType).toBe("INTEGER");
      expect(idCol.nullable).toBe(false);
      expect(idCol.isPrimaryKey).toBe(true);

      const nameCol = columns.find((c) => c.name === "name")!;
      expect(nameCol.dataType).toBe("TEXT");
      expect(nameCol.nullable).toBe(false);
      expect(nameCol.isPrimaryKey).toBe(false);

      const emailCol = columns.find((c) => c.name === "email")!;
      expect(emailCol.nullable).toBe(true);
    });
  });

  describe("getPrimaryKey", () => {
    beforeEach(async () => {
      await driver.connect();
    });

    it("returns single-column primary key", async () => {
      await driver.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)");
      const pk = await driver.getPrimaryKey("users");
      expect(pk).toEqual(["id"]);
    });

    it("returns composite primary key", async () => {
      await driver.execute(
        "CREATE TABLE order_items (order_id INTEGER, item_id INTEGER, qty INTEGER, PRIMARY KEY (order_id, item_id))"
      );
      const pk = await driver.getPrimaryKey("order_items");
      expect(pk.sort()).toEqual(["item_id", "order_id"]);
    });

    it("returns empty array for table without PK", async () => {
      await driver.execute("CREATE TABLE logs (message TEXT, ts TEXT)");
      const pk = await driver.getPrimaryKey("logs");
      expect(pk).toEqual([]);
    });
  });
});
