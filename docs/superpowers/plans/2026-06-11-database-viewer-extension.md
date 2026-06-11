# Database Viewer VS Code Extension — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a VS Code extension that connects to PostgreSQL/SQLite databases, browses schemas in a tree view, views/edits table data via AG Grid webview panels, and runs complex queries in a Monaco-based console.

**Architecture:** Extension host (Node.js, esbuild) handles DB connections, query execution, and tree view. Webview panels (React + Vite) render AG Grid for data and Monaco for SQL editing. Communication via VS Code's postMessage IPC with typed messages and request correlation.

**Tech Stack:** TypeScript, VS Code Extension API, React 18, Vite, AG Grid Community, Monaco Editor, pg, better-sqlite3, Vitest

---

### Task 1: Project Scaffolding & Build Pipeline

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.webview.json`
- Create: `vite.config.ts`
- Create: `esbuild.js`
- Create: `.vscodeignore`
- Create: `.gitignore`
- Create: `src/extension/extension.ts`
- Create: `src/webview/index.html`
- Create: `src/webview/main.tsx`
- Create: `src/webview/App.tsx`

- [ ] **Step 1: Initialize package.json**

```json
{
  "name": "database-viewer",
  "displayName": "Database Viewer",
  "description": "Connect to SQL databases, view and edit table data",
  "version": "0.0.1",
  "engines": { "vscode": "^1.85.0" },
  "categories": ["Other"],
  "activationEvents": ["onView:databaseViewer.connections"],
  "main": "./dist/extension.js",
  "contributes": {
    "viewsContainers": {
      "activitybar": [
        {
          "id": "database-viewer",
          "title": "Database Viewer",
          "icon": "media/db-icon.svg"
        }
      ]
    },
    "views": {
      "database-viewer": [
        {
          "id": "databaseViewer.connections",
          "name": "Connections"
        }
      ]
    },
    "commands": [
      { "command": "databaseViewer.addConnection", "title": "Database Viewer: Add Connection" },
      { "command": "databaseViewer.openQuery", "title": "Database Viewer: New Query Console" },
      { "command": "databaseViewer.refresh", "title": "Database Viewer: Refresh" }
    ]
  },
  "scripts": {
    "dev": "concurrently \"npm run dev:extension\" \"npm run dev:webview\"",
    "dev:extension": "node esbuild.js --watch",
    "dev:webview": "vite --config vite.config.ts",
    "build": "npm run build:extension && npm run build:webview",
    "build:extension": "node esbuild.js --production",
    "build:webview": "vite build --config vite.config.ts",
    "package": "vsce package",
    "test": "vitest run",
    "lint": "eslint src/"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@types/vscode": "^1.85.0",
    "@vitejs/plugin-react": "^4.2.0",
    "concurrently": "^8.2.0",
    "esbuild": "^0.20.0",
    "eslint": "^8.56.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "vitest": "^1.2.0"
  },
  "dependencies": {
    "ag-grid-community": "^31.0.0",
    "ag-grid-react": "^31.0.0",
    "better-sqlite3": "^9.4.0",
    "monaco-editor": "^0.45.0",
    "pg": "^8.11.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "uuid": "^9.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json for extension host**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2022",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src/extension",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/extension/**/*"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create tsconfig.webview.json for React app**

```json
{
  "compilerOptions": {
    "module": "ESNext",
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "outDir": "dist/webview",
    "rootDir": "src/webview",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "jsx": "react-jsx",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "noEmit": true
  },
  "include": ["src/webview/**/*"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create esbuild.js for extension bundling**

```javascript
const esbuild = require("esbuild");

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

async function main() {
  const ctx = await esbuild.context({
    entryPoints: ["src/extension/extension.ts"],
    bundle: true,
    format: "cjs",
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: "node",
    outfile: "dist/extension.js",
    external: ["vscode", "better-sqlite3"],
    logLevel: "silent",
  });

  if (watch) {
    await ctx.watch();
    console.log("Watching for changes...");
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 5: Create vite.config.ts**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, "src/webview"),
  build: {
    outDir: path.resolve(__dirname, "dist/webview"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name].[ext]",
      },
    },
  },
  server: {
    port: 3000,
  },
});
```

- [ ] **Step 6: Create minimal extension entry point**

`src/extension/extension.ts`:
```typescript
import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  console.log("Database Viewer extension activated");

  const disposable = vscode.commands.registerCommand(
    "databaseViewer.addConnection",
    () => {
      vscode.window.showInformationMessage("Add Connection - coming soon");
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
```

- [ ] **Step 7: Create minimal webview React app**

`src/webview/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Database Viewer</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/main.tsx"></script>
  </body>
</html>
```

`src/webview/main.tsx`:
```typescript
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

`src/webview/App.tsx`:
```typescript
import React from "react";

export default function App() {
  return <div>Database Viewer - Webview Ready</div>;
}
```

- [ ] **Step 8: Create .gitignore and .vscodeignore**

`.gitignore`:
```
node_modules/
dist/
*.vsix
.vscode-test/
```

`.vscodeignore`:
```
.vscode/**
src/**
node_modules/**
.gitignore
tsconfig*.json
vite.config.ts
esbuild.js
test/**
```

- [ ] **Step 9: Install dependencies and verify build**

Run:
```bash
cd /Users/chenw/Projects/database-viewer
npm install
npm run build
```

Expected: `dist/extension.js` exists and `dist/webview/index.html` exists with bundled assets.

- [ ] **Step 10: Verify extension loads in VS Code**

Run:
```bash
code --extensionDevelopmentPath=/Users/chenw/Projects/database-viewer
```

Expected: "Database Viewer" icon appears in activity bar. Running "Database Viewer: Add Connection" from command palette shows info message.

- [ ] **Step 11: Initialize git and commit**

```bash
git init
git add .
git commit -m "feat: scaffold project with extension host + webview build pipeline"
```

---

### Task 2: Shared Types & IPC Message Protocol

**Files:**
- Create: `src/shared/types.ts`
- Create: `src/shared/messages.ts`
- Create: `src/webview/hooks/useExtensionMessage.ts`
- Create: `src/extension/webview/messageHandler.ts`
- Test: `test/shared/messages.test.ts`

- [ ] **Step 1: Create shared types**

`src/shared/types.ts`:
```typescript
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
```

- [ ] **Step 2: Create message protocol types**

`src/shared/messages.ts`:
```typescript
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
```

- [ ] **Step 3: Create webview IPC hook**

`src/webview/hooks/useExtensionMessage.ts`:
```typescript
import { useCallback, useEffect, useRef } from "react";
import { ExtensionMessage, WebviewMessage, createRequestId } from "../../shared/messages";

declare function acquireVsCodeApi(): { postMessage(msg: unknown): void };

const vscode = acquireVsCodeApi();

type ResponseHandler = (msg: ExtensionMessage) => void;

export function useExtensionMessage() {
  const handlers = useRef<Map<string, ResponseHandler>>(new Map());

  useEffect(() => {
    const listener = (event: MessageEvent<ExtensionMessage>) => {
      const msg = event.data;
      if ("requestId" in msg && msg.requestId) {
        const handler = handlers.current.get(msg.requestId);
        if (handler) {
          handler(msg);
          if (msg.type !== "loading") {
            handlers.current.delete(msg.requestId);
          }
        }
      }
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, []);

  const sendRequest = useCallback(
    <T extends ExtensionMessage>(
      msg: Omit<WebviewMessage, "requestId">,
      onResponse: (msg: T) => void
    ): string => {
      const requestId = createRequestId();
      handlers.current.set(requestId, onResponse as ResponseHandler);
      vscode.postMessage({ ...msg, requestId });
      return requestId;
    },
    []
  );

  const cancelRequest = useCallback((requestId: string) => {
    handlers.current.delete(requestId);
  }, []);

  return { sendRequest, cancelRequest };
}
```

- [ ] **Step 4: Create extension-side message handler skeleton**

`src/extension/webview/messageHandler.ts`:
```typescript
import * as vscode from "vscode";
import { WebviewMessage, ExtensionMessage } from "../../shared/messages";

export class MessageHandler {
  constructor(private panel: vscode.WebviewPanel) {}

  handleMessage(msg: WebviewMessage): void {
    switch (msg.type) {
      case "fetch-table-data":
        this.handleFetchTableData(msg);
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

  private handleFetchTableData(msg: Extract<WebviewMessage, { type: "fetch-table-data" }>): void {
    this.sendResponse({ type: "error", requestId: msg.requestId, message: "Not implemented" });
  }

  private handleUpdateRows(msg: Extract<WebviewMessage, { type: "update-rows" }>): void {
    this.sendResponse({ type: "error", requestId: msg.requestId, message: "Not implemented" });
  }

  private handleExecuteQuery(msg: Extract<WebviewMessage, { type: "execute-query" }>): void {
    this.sendResponse({ type: "error", requestId: msg.requestId, message: "Not implemented" });
  }

  private handleGetSchema(msg: Extract<WebviewMessage, { type: "get-schema" }>): void {
    this.sendResponse({ type: "error", requestId: msg.requestId, message: "Not implemented" });
  }

  private handleCancelQuery(msg: Extract<WebviewMessage, { type: "cancel-query" }>): void {
    // Will be implemented with query executor
  }

  private handleCountRows(msg: Extract<WebviewMessage, { type: "count-rows" }>): void {
    this.sendResponse({ type: "error", requestId: msg.requestId, message: "Not implemented" });
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
```

- [ ] **Step 5: Write test for message protocol**

`test/shared/messages.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { createRequestId, WebviewMessage, ExtensionMessage } from "../../src/shared/messages";

describe("createRequestId", () => {
  it("generates unique IDs", () => {
    const id1 = createRequestId();
    const id2 = createRequestId();
    expect(id1).not.toBe(id2);
  });

  it("generates string IDs", () => {
    const id = createRequestId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });
});

describe("message types", () => {
  it("WebviewMessage fetch-table-data is valid", () => {
    const msg: WebviewMessage = {
      type: "fetch-table-data",
      requestId: "test-1",
      table: "users",
      limit: 50,
      offset: 0,
    };
    expect(msg.type).toBe("fetch-table-data");
  });

  it("ExtensionMessage table-data is valid", () => {
    const msg: ExtensionMessage = {
      type: "table-data",
      requestId: "test-1",
      rows: [{ id: 1, name: "Alice" }],
      columns: [
        { name: "id", dataType: "int4", nullable: false, isPrimaryKey: true },
        { name: "name", dataType: "varchar", nullable: true, isPrimaryKey: false },
      ],
    };
    expect(msg.rows).toHaveLength(1);
  });
});
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run test/shared/messages.test.ts`
Expected: All 4 tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/shared/ src/webview/hooks/useExtensionMessage.ts src/extension/webview/messageHandler.ts test/shared/
git commit -m "feat: add shared types, IPC message protocol, and webview message hook"
```

---

### Task 3: Database Driver Interface & SQLite Driver

**Files:**
- Create: `src/extension/database/drivers/types.ts`
- Create: `src/extension/database/drivers/sqlite.ts`
- Test: `test/extension/database/drivers/sqlite.test.ts`

- [ ] **Step 1: Create driver interface**

`src/extension/database/drivers/types.ts`:
```typescript
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
```

- [ ] **Step 2: Write failing tests for SQLite driver**

`test/extension/database/drivers/sqlite.test.ts`:
```typescript
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run test/extension/database/drivers/sqlite.test.ts`
Expected: FAIL — cannot import `SqliteDriver` (module doesn't exist yet).

- [ ] **Step 4: Implement SQLite driver**

`src/extension/database/drivers/sqlite.ts`:
```typescript
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run test/extension/database/drivers/sqlite.test.ts`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/extension/database/drivers/ test/extension/database/drivers/sqlite.test.ts
git commit -m "feat: add database driver interface and SQLite implementation"
```

---

### Task 4: PostgreSQL Driver

**Files:**
- Create: `src/extension/database/drivers/postgres.ts`
- Test: `test/extension/database/drivers/postgres.test.ts`

**Note:** Tests use testcontainers to spin up a real PostgreSQL instance. Requires Docker running locally. If Docker isn't available, tests can be run manually against a local PostgreSQL.

- [ ] **Step 1: Install testcontainers dev dependency**

Run:
```bash
npm install -D @testcontainers/postgresql
```

- [ ] **Step 2: Write failing tests for PostgreSQL driver**

`test/extension/database/drivers/postgres.test.ts`:
```typescript
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
      if (!driver.isConnected()) {
        await driver.connect();
      }
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
      expect(result.rows[0].email).toBe("alice@test.com");
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
      if (!driver.isConnected()) {
        await driver.connect();
      }
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
      expect(tableNames).not.toContain("pg_namespace");
    });
  });

  describe("getColumns", () => {
    beforeEach(async () => {
      if (!driver.isConnected()) {
        await driver.connect();
      }
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
      expect(nameCol.isPrimaryKey).toBe(false);

      const emailCol = columns.find((c) => c.name === "email")!;
      expect(emailCol.dataType).toBe("text");
      expect(emailCol.nullable).toBe(true);
    });
  });

  describe("getPrimaryKey", () => {
    beforeEach(async () => {
      if (!driver.isConnected()) {
        await driver.connect();
      }
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run test/extension/database/drivers/postgres.test.ts`
Expected: FAIL — cannot import `PostgresDriver`.

- [ ] **Step 4: Implement PostgreSQL driver**

`src/extension/database/drivers/postgres.ts`:
```typescript
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
    // Verify connectivity
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

    const result = await this.pool.query(sql, params);

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
```

- [ ] **Step 5: Install @types/pg**

Run:
```bash
npm install -D @types/pg @types/better-sqlite3
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run test/extension/database/drivers/postgres.test.ts`
Expected: All tests pass (requires Docker running for testcontainers).

- [ ] **Step 7: Commit**

```bash
git add src/extension/database/drivers/postgres.ts test/extension/database/drivers/postgres.test.ts package.json package-lock.json
git commit -m "feat: add PostgreSQL driver with connection pooling and SSL support"
```

---

### Task 5: Connection Manager

**Files:**
- Create: `src/extension/connections/connectionManager.ts`
- Create: `src/extension/connections/connectionConfig.ts`
- Test: `test/extension/connections/connectionManager.test.ts`

- [ ] **Step 1: Create connection config helpers**

`src/extension/connections/connectionConfig.ts`:
```typescript
import { ConnectionConfig } from "../../shared/types";

const CONFIG_KEY = "databaseViewer.connections";

export function getConnectionsFromConfig(
  config: { get<T>(key: string): T | undefined }
): ConnectionConfig[] {
  return config.get<ConnectionConfig[]>(CONFIG_KEY) || [];
}

export function validateConnectionConfig(config: ConnectionConfig): string | null {
  if (!config.name || config.name.trim().length === 0) {
    return "Connection name is required";
  }
  if (!config.driver) {
    return "Driver type is required";
  }
  if (config.driver === "postgres") {
    if (!config.host) return "Host is required for PostgreSQL";
    if (!config.port) return "Port is required for PostgreSQL";
    if (!config.database) return "Database is required for PostgreSQL";
    if (!config.username) return "Username is required for PostgreSQL";
  }
  if (config.driver === "sqlite") {
    if (!config.filePath) return "File path is required for SQLite";
  }
  return null;
}
```

- [ ] **Step 2: Write failing tests for ConnectionManager**

`test/extension/connections/connectionManager.test.ts`:
```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ConnectionManager } from "../../../src/extension/connections/connectionManager";
import { ConnectionConfig } from "../../../src/shared/types";

function createMockContext() {
  const secrets = new Map<string, string>();
  const configConnections: ConnectionConfig[] = [];

  return {
    secrets: {
      get: vi.fn((key: string) => Promise.resolve(secrets.get(key))),
      store: vi.fn((key: string, value: string) => {
        secrets.set(key, value);
        return Promise.resolve();
      }),
      delete: vi.fn((key: string) => {
        secrets.delete(key);
        return Promise.resolve();
      }),
    },
    globalState: {
      get: vi.fn((key: string) => configConnections),
      update: vi.fn((key: string, value: unknown) => {
        configConnections.length = 0;
        if (Array.isArray(value)) {
          configConnections.push(...value);
        }
        return Promise.resolve();
      }),
    },
  };
}

describe("ConnectionManager", () => {
  let manager: ConnectionManager;
  let mockContext: ReturnType<typeof createMockContext>;

  beforeEach(() => {
    mockContext = createMockContext();
    manager = new ConnectionManager(mockContext as any);
  });

  describe("getConnections", () => {
    it("returns empty array initially", () => {
      const connections = manager.getConnections();
      expect(connections).toEqual([]);
    });
  });

  describe("addConnection", () => {
    it("saves connection config and password", async () => {
      const config: ConnectionConfig = {
        id: "test-1",
        name: "test-db",
        driver: "postgres",
        host: "localhost",
        port: 5432,
        database: "mydb",
        username: "user",
      };

      await manager.addConnection(config, "secret123");

      const connections = manager.getConnections();
      expect(connections).toHaveLength(1);
      expect(connections[0].name).toBe("test-db");
      expect(mockContext.secrets.store).toHaveBeenCalledWith("databaseViewer.password.test-1", "secret123");
    });

    it("validates config before saving", async () => {
      const config: ConnectionConfig = {
        id: "test-1",
        name: "",
        driver: "postgres",
      };

      await expect(manager.addConnection(config, "pw")).rejects.toThrow("Connection name is required");
    });
  });

  describe("updateConnection", () => {
    it("updates existing connection", async () => {
      const config: ConnectionConfig = {
        id: "test-1",
        name: "test-db",
        driver: "sqlite",
        filePath: "/tmp/test.db",
      };
      await manager.addConnection(config);

      await manager.updateConnection({ ...config, name: "renamed-db" });

      const connections = manager.getConnections();
      expect(connections[0].name).toBe("renamed-db");
    });

    it("updates password if provided", async () => {
      const config: ConnectionConfig = {
        id: "test-1",
        name: "test-db",
        driver: "postgres",
        host: "localhost",
        port: 5432,
        database: "db",
        username: "user",
      };
      await manager.addConnection(config, "old-pw");

      await manager.updateConnection(config, "new-pw");

      expect(mockContext.secrets.store).toHaveBeenCalledWith("databaseViewer.password.test-1", "new-pw");
    });
  });

  describe("deleteConnection", () => {
    it("removes connection and its password", async () => {
      const config: ConnectionConfig = {
        id: "test-1",
        name: "test-db",
        driver: "sqlite",
        filePath: "/tmp/test.db",
      };
      await manager.addConnection(config);

      await manager.deleteConnection("test-1");

      expect(manager.getConnections()).toHaveLength(0);
      expect(mockContext.secrets.delete).toHaveBeenCalledWith("databaseViewer.password.test-1");
    });
  });

  describe("getPassword", () => {
    it("retrieves stored password", async () => {
      const config: ConnectionConfig = {
        id: "test-1",
        name: "test-db",
        driver: "postgres",
        host: "localhost",
        port: 5432,
        database: "db",
        username: "user",
      };
      await manager.addConnection(config, "secret");

      const password = await manager.getPassword("test-1");
      expect(password).toBe("secret");
    });

    it("returns undefined for SQLite connections", async () => {
      const config: ConnectionConfig = {
        id: "test-1",
        name: "test-db",
        driver: "sqlite",
        filePath: "/tmp/test.db",
      };
      await manager.addConnection(config);

      const password = await manager.getPassword("test-1");
      expect(password).toBeUndefined();
    });
  });

  describe("getDriver", () => {
    it("creates and caches a driver instance", async () => {
      const config: ConnectionConfig = {
        id: "test-1",
        name: "local-sqlite",
        driver: "sqlite",
        filePath: "/tmp/test.db",
      };
      await manager.addConnection(config);

      const driver1 = await manager.getDriver("test-1");
      const driver2 = await manager.getDriver("test-1");
      expect(driver1).toBe(driver2);
    });

    it("throws for unknown connection ID", async () => {
      await expect(manager.getDriver("nonexistent")).rejects.toThrow("Connection not found");
    });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run test/extension/connections/connectionManager.test.ts`
Expected: FAIL — cannot import `ConnectionManager`.

- [ ] **Step 4: Implement ConnectionManager**

`src/extension/connections/connectionManager.ts`:
```typescript
import * as vscode from "vscode";
import { ConnectionConfig } from "../../shared/types";
import { validateConnectionConfig } from "./connectionConfig";
import { DatabaseDriver } from "../database/drivers/types";
import { PostgresDriver } from "../database/drivers/postgres";
import { SqliteDriver } from "../database/drivers/sqlite";

const CONNECTIONS_KEY = "databaseViewer.connections";
const PASSWORD_PREFIX = "databaseViewer.password.";

export class ConnectionManager {
  private context: vscode.ExtensionContext;
  private drivers: Map<string, DatabaseDriver> = new Map();
  private _onDidChangeConnections = new vscode.EventEmitter<void>();
  readonly onDidChangeConnections = this._onDidChangeConnections.event;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  getConnections(): ConnectionConfig[] {
    return this.context.globalState.get<ConnectionConfig[]>(CONNECTIONS_KEY) || [];
  }

  getConnection(id: string): ConnectionConfig | undefined {
    return this.getConnections().find((c) => c.id === id);
  }

  async addConnection(config: ConnectionConfig, password?: string): Promise<void> {
    const error = validateConnectionConfig(config);
    if (error) {
      throw new Error(error);
    }

    const connections = this.getConnections();
    connections.push(config);
    await this.context.globalState.update(CONNECTIONS_KEY, connections);

    if (password) {
      await this.context.secrets.store(`${PASSWORD_PREFIX}${config.id}`, password);
    }

    this._onDidChangeConnections.fire();
  }

  async updateConnection(config: ConnectionConfig, password?: string): Promise<void> {
    const error = validateConnectionConfig(config);
    if (error) {
      throw new Error(error);
    }

    const connections = this.getConnections();
    const index = connections.findIndex((c) => c.id === config.id);
    if (index === -1) {
      throw new Error("Connection not found");
    }

    connections[index] = config;
    await this.context.globalState.update(CONNECTIONS_KEY, connections);

    if (password) {
      await this.context.secrets.store(`${PASSWORD_PREFIX}${config.id}`, password);
    }

    // Invalidate cached driver
    const existingDriver = this.drivers.get(config.id);
    if (existingDriver) {
      await existingDriver.disconnect();
      this.drivers.delete(config.id);
    }

    this._onDidChangeConnections.fire();
  }

  async deleteConnection(id: string): Promise<void> {
    const connections = this.getConnections().filter((c) => c.id !== id);
    await this.context.globalState.update(CONNECTIONS_KEY, connections);
    await this.context.secrets.delete(`${PASSWORD_PREFIX}${id}`);

    const existingDriver = this.drivers.get(id);
    if (existingDriver) {
      await existingDriver.disconnect();
      this.drivers.delete(id);
    }

    this._onDidChangeConnections.fire();
  }

  async getPassword(id: string): Promise<string | undefined> {
    return this.context.secrets.get(`${PASSWORD_PREFIX}${id}`);
  }

  async getDriver(id: string): Promise<DatabaseDriver> {
    const cached = this.drivers.get(id);
    if (cached && cached.isConnected()) {
      return cached;
    }

    const config = this.getConnection(id);
    if (!config) {
      throw new Error("Connection not found");
    }

    const driver = await this.createDriver(config);
    await driver.connect();
    this.drivers.set(id, driver);
    return driver;
  }

  private async createDriver(config: ConnectionConfig): Promise<DatabaseDriver> {
    if (config.driver === "sqlite") {
      return new SqliteDriver({ filePath: config.filePath! });
    }

    const password = await this.getPassword(config.id);
    return new PostgresDriver({
      host: config.host!,
      port: config.port!,
      database: config.database!,
      username: config.username!,
      password: password || "",
      ssl: config.ssl?.enabled
        ? {
            ca: config.ssl.caFile,
            cert: config.ssl.clientCertFile,
            key: config.ssl.clientKeyFile,
            rejectUnauthorized: config.ssl.rejectUnauthorized,
          }
        : undefined,
    });
  }

  async disconnectAll(): Promise<void> {
    for (const driver of this.drivers.values()) {
      await driver.disconnect();
    }
    this.drivers.clear();
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run test/extension/connections/connectionManager.test.ts`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/extension/connections/ test/extension/connections/
git commit -m "feat: add connection manager with SecretStorage and driver caching"
```

---

### Task 6: Tree View Provider

**Files:**
- Create: `src/extension/tree/treeProvider.ts`
- Create: `src/extension/tree/treeNodes.ts`
- Modify: `src/extension/extension.ts`
- Test: `test/extension/tree/treeProvider.test.ts`

- [ ] **Step 1: Create tree node types**

`src/extension/tree/treeNodes.ts`:
```typescript
import * as vscode from "vscode";

export type TreeNodeType = "connection" | "schema" | "table" | "column" | "addConnection";

export class DatabaseTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly nodeType: TreeNodeType,
    public readonly connectionId?: string,
    public readonly schema?: string,
    public readonly tableName?: string,
    collapsibleState?: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState ?? vscode.TreeItemCollapsibleState.None);
    this.contextValue = nodeType;
    this.setIcon();
  }

  private setIcon(): void {
    switch (this.nodeType) {
      case "connection":
        this.iconPath = new vscode.ThemeIcon("database");
        break;
      case "schema":
        this.iconPath = new vscode.ThemeIcon("folder");
        break;
      case "table":
        this.iconPath = new vscode.ThemeIcon("table");
        break;
      case "column":
        this.iconPath = new vscode.ThemeIcon("symbol-field");
        break;
      case "addConnection":
        this.iconPath = new vscode.ThemeIcon("add");
        break;
    }
  }
}

export function createConnectionNode(id: string, name: string, driver: string): DatabaseTreeItem {
  const node = new DatabaseTreeItem(
    `${name} (${driver})`,
    "connection",
    id,
    undefined,
    undefined,
    vscode.TreeItemCollapsibleState.Collapsed
  );
  node.tooltip = `${name} — ${driver}`;
  return node;
}

export function createSchemaNode(connectionId: string, schema: string): DatabaseTreeItem {
  return new DatabaseTreeItem(
    schema,
    "schema",
    connectionId,
    schema,
    undefined,
    vscode.TreeItemCollapsibleState.Collapsed
  );
}

export function createTableNode(connectionId: string, schema: string | undefined, table: string): DatabaseTreeItem {
  const node = new DatabaseTreeItem(
    table,
    "table",
    connectionId,
    schema,
    table,
    vscode.TreeItemCollapsibleState.Collapsed
  );
  node.command = {
    command: "databaseViewer.openTable",
    title: "Open Table",
    arguments: [connectionId, schema, table],
  };
  return node;
}

export function createColumnNode(name: string, dataType: string, isPrimaryKey: boolean): DatabaseTreeItem {
  const suffix = isPrimaryKey ? " (PK)" : "";
  const node = new DatabaseTreeItem(
    `${name} — ${dataType}${suffix}`,
    "column"
  );
  node.tooltip = `${name}: ${dataType}${isPrimaryKey ? " (Primary Key)" : ""}`;
  return node;
}

export function createAddConnectionNode(): DatabaseTreeItem {
  const node = new DatabaseTreeItem(
    "Add Connection...",
    "addConnection"
  );
  node.command = {
    command: "databaseViewer.addConnection",
    title: "Add Connection",
  };
  return node;
}
```

- [ ] **Step 2: Write failing tests for TreeProvider**

`test/extension/tree/treeProvider.test.ts`:
```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { DatabaseTreeProvider } from "../../../src/extension/tree/treeProvider";
import { DatabaseTreeItem } from "../../../src/extension/tree/treeNodes";

const mockConnectionManager = {
  getConnections: vi.fn(),
  getDriver: vi.fn(),
  onDidChangeConnections: vi.fn(() => ({ dispose: vi.fn() })),
};

vi.mock("vscode", () => ({
  TreeItem: class {
    label: string;
    collapsibleState: number;
    contextValue?: string;
    iconPath?: unknown;
    tooltip?: string;
    command?: unknown;
    constructor(label: string, collapsibleState?: number) {
      this.label = label;
      this.collapsibleState = collapsibleState ?? 0;
    }
  },
  TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
  ThemeIcon: class { constructor(public id: string) {} },
  EventEmitter: class {
    event = vi.fn();
    fire = vi.fn();
    dispose = vi.fn();
  },
}));

describe("DatabaseTreeProvider", () => {
  let provider: DatabaseTreeProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConnectionManager.getConnections.mockReturnValue([]);
    provider = new DatabaseTreeProvider(mockConnectionManager as any);
  });

  describe("getChildren (root)", () => {
    it("returns Add Connection node when no connections exist", async () => {
      const children = await provider.getChildren(undefined);
      expect(children).toHaveLength(1);
      expect(children[0].nodeType).toBe("addConnection");
    });

    it("returns connection nodes plus Add Connection", async () => {
      mockConnectionManager.getConnections.mockReturnValue([
        { id: "c1", name: "my-db", driver: "postgres" },
        { id: "c2", name: "local", driver: "sqlite" },
      ]);

      const children = await provider.getChildren(undefined);
      expect(children).toHaveLength(3);
      expect(children[0].nodeType).toBe("connection");
      expect(children[1].nodeType).toBe("connection");
      expect(children[2].nodeType).toBe("addConnection");
    });
  });

  describe("getChildren (connection — postgres)", () => {
    it("returns schema nodes for PostgreSQL", async () => {
      const mockDriver = {
        getTables: vi.fn().mockResolvedValue([
          { name: "users", schema: "public" },
          { name: "events", schema: "analytics" },
        ]),
      };
      mockConnectionManager.getDriver.mockResolvedValue(mockDriver);

      const connectionNode = new DatabaseTreeItem(
        "my-db (postgres)",
        "connection",
        "c1",
        undefined,
        undefined,
        1
      );

      const children = await provider.getChildren(connectionNode);
      const schemas = children.map((c) => c.label);
      expect(schemas).toContain("public");
      expect(schemas).toContain("analytics");
      expect(children[0].nodeType).toBe("schema");
    });
  });

  describe("getChildren (connection — sqlite)", () => {
    it("returns table nodes directly for SQLite", async () => {
      mockConnectionManager.getConnections.mockReturnValue([
        { id: "c2", name: "local", driver: "sqlite" },
      ]);
      const mockDriver = {
        getTables: vi.fn().mockResolvedValue([
          { name: "users" },
          { name: "sessions" },
        ]),
      };
      mockConnectionManager.getDriver.mockResolvedValue(mockDriver);

      const connectionNode = new DatabaseTreeItem(
        "local (sqlite)",
        "connection",
        "c2",
        undefined,
        undefined,
        1
      );

      const children = await provider.getChildren(connectionNode);
      expect(children).toHaveLength(2);
      expect(children[0].nodeType).toBe("table");
      expect(children[0].label).toBe("users");
    });
  });

  describe("getChildren (table)", () => {
    it("returns column nodes", async () => {
      const mockDriver = {
        getColumns: vi.fn().mockResolvedValue([
          { name: "id", dataType: "integer", nullable: false, isPrimaryKey: true },
          { name: "name", dataType: "varchar", nullable: false, isPrimaryKey: false },
        ]),
      };
      mockConnectionManager.getDriver.mockResolvedValue(mockDriver);

      const tableNode = new DatabaseTreeItem(
        "users",
        "table",
        "c1",
        "public",
        "users",
        1
      );

      const children = await provider.getChildren(tableNode);
      expect(children).toHaveLength(2);
      expect(children[0].nodeType).toBe("column");
      expect(children[0].label).toContain("id");
      expect(children[0].label).toContain("PK");
    });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run test/extension/tree/treeProvider.test.ts`
Expected: FAIL — cannot import `DatabaseTreeProvider`.

- [ ] **Step 4: Implement TreeProvider**

`src/extension/tree/treeProvider.ts`:
```typescript
import * as vscode from "vscode";
import { ConnectionManager } from "../connections/connectionManager";
import {
  DatabaseTreeItem,
  createAddConnectionNode,
  createColumnNode,
  createConnectionNode,
  createSchemaNode,
  createTableNode,
} from "./treeNodes";

export class DatabaseTreeProvider implements vscode.TreeDataProvider<DatabaseTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<DatabaseTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private connectionManager: ConnectionManager) {
    connectionManager.onDidChangeConnections(() => this.refresh());
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: DatabaseTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: DatabaseTreeItem): Promise<DatabaseTreeItem[]> {
    if (!element) {
      return this.getRootChildren();
    }

    switch (element.nodeType) {
      case "connection":
        return this.getConnectionChildren(element);
      case "schema":
        return this.getSchemaChildren(element);
      case "table":
        return this.getTableChildren(element);
      default:
        return [];
    }
  }

  private getRootChildren(): DatabaseTreeItem[] {
    const connections = this.connectionManager.getConnections();
    const nodes = connections.map((conn) =>
      createConnectionNode(conn.id, conn.name, conn.driver)
    );
    nodes.push(createAddConnectionNode());
    return nodes;
  }

  private async getConnectionChildren(node: DatabaseTreeItem): Promise<DatabaseTreeItem[]> {
    if (!node.connectionId) return [];

    try {
      const driver = await this.connectionManager.getDriver(node.connectionId);
      const tables = await driver.getTables();

      const config = this.connectionManager.getConnection(node.connectionId);
      if (config?.driver === "sqlite") {
        return tables.map((t) => createTableNode(node.connectionId!, undefined, t.name));
      }

      const schemas = [...new Set(tables.map((t) => t.schema).filter(Boolean))] as string[];
      return schemas.map((schema) => createSchemaNode(node.connectionId!, schema));
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to connect: ${error instanceof Error ? error.message : String(error)}`
      );
      return [];
    }
  }

  private async getSchemaChildren(node: DatabaseTreeItem): Promise<DatabaseTreeItem[]> {
    if (!node.connectionId || !node.schema) return [];

    try {
      const driver = await this.connectionManager.getDriver(node.connectionId);
      const tables = await driver.getTables();
      return tables
        .filter((t) => t.schema === node.schema)
        .map((t) => createTableNode(node.connectionId!, node.schema, t.name));
    } catch (error) {
      return [];
    }
  }

  private async getTableChildren(node: DatabaseTreeItem): Promise<DatabaseTreeItem[]> {
    if (!node.connectionId || !node.tableName) return [];

    try {
      const driver = await this.connectionManager.getDriver(node.connectionId);
      const columns = await driver.getColumns(node.tableName, node.schema);
      return columns.map((col) => createColumnNode(col.name, col.dataType, col.isPrimaryKey));
    } catch (error) {
      return [];
    }
  }
}
```

- [ ] **Step 5: Update extension.ts to register tree view**

`src/extension/extension.ts`:
```typescript
import * as vscode from "vscode";
import { ConnectionManager } from "./connections/connectionManager";
import { DatabaseTreeProvider } from "./tree/treeProvider";

export function activate(context: vscode.ExtensionContext) {
  const connectionManager = new ConnectionManager(context);
  const treeProvider = new DatabaseTreeProvider(connectionManager);

  const treeView = vscode.window.createTreeView("databaseViewer.connections", {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });

  context.subscriptions.push(
    treeView,
    vscode.commands.registerCommand("databaseViewer.addConnection", () => {
      vscode.window.showInformationMessage("Add Connection - coming soon");
    }),
    vscode.commands.registerCommand("databaseViewer.refresh", () => {
      treeProvider.refresh();
    }),
    vscode.commands.registerCommand("databaseViewer.openTable", (connectionId: string, schema: string | undefined, table: string) => {
      vscode.window.showInformationMessage(`Open table: ${table} - coming soon`);
    }),
    vscode.commands.registerCommand("databaseViewer.openQuery", () => {
      vscode.window.showInformationMessage("Query Console - coming soon");
    })
  );
}

export function deactivate() {}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run test/extension/tree/treeProvider.test.ts`
Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/extension/tree/ src/extension/extension.ts test/extension/tree/
git commit -m "feat: add tree view provider with lazy-loading connections, schemas, tables, columns"
```

---

### Task 7: Webview Manager

**Files:**
- Create: `src/extension/webview/webviewManager.ts`
- Modify: `src/extension/extension.ts`

- [ ] **Step 1: Implement WebviewManager**

`src/extension/webview/webviewManager.ts`:
```typescript
import * as vscode from "vscode";
import path from "path";
import { ConnectionManager } from "../connections/connectionManager";
import { WebviewMessage, ExtensionMessage } from "../../shared/messages";
import { QueryExecutor } from "../database/queryExecutor";

export type WebviewPanelType = "table" | "query";

interface PanelInfo {
  panel: vscode.WebviewPanel;
  type: WebviewPanelType;
  connectionId: string;
  tableKey?: string;
}

export class WebviewManager {
  private panels: Map<string, PanelInfo> = new Map();
  private extensionUri: vscode.Uri;
  private queryExecutor: QueryExecutor;

  constructor(
    extensionUri: vscode.Uri,
    private connectionManager: ConnectionManager
  ) {
    this.extensionUri = extensionUri;
    this.queryExecutor = new QueryExecutor(connectionManager);
  }

  openTableView(connectionId: string, schema: string | undefined, table: string): void {
    const panelKey = `table:${connectionId}:${schema || ""}:${table}`;

    const existing = this.panels.get(panelKey);
    if (existing) {
      existing.panel.reveal();
      return;
    }

    const panel = this.createPanel(`${table}`, panelKey, "table", connectionId);

    panel.webview.postMessage({
      type: "init-table",
      connectionId,
      schema,
      table,
    });

    this.panels.set(panelKey, { panel, type: "table", connectionId, tableKey: panelKey });
  }

  openQueryConsole(connectionId: string): void {
    const panelKey = `query:${connectionId}:${Date.now()}`;
    const connConfig = this.connectionManager.getConnection(connectionId);
    const title = `Query — ${connConfig?.name || connectionId}`;

    const panel = this.createPanel(title, panelKey, "query", connectionId);

    panel.webview.postMessage({
      type: "init-query",
      connectionId,
      connections: this.connectionManager.getConnections(),
    });

    this.panels.set(panelKey, { panel, type: "query", connectionId });
  }

  private createPanel(
    title: string,
    panelKey: string,
    panelType: WebviewPanelType,
    connectionId: string
  ): vscode.WebviewPanel {
    const panel = vscode.window.createWebviewPanel(
      `databaseViewer.${panelType}`,
      title,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.extensionUri, "dist", "webview"),
        ],
      }
    );

    panel.webview.html = this.getWebviewHtml(panel.webview);

    panel.webview.onDidReceiveMessage((msg: WebviewMessage) => {
      this.handleMessage(msg, panel, connectionId);
    });

    panel.onDidDispose(() => {
      this.panels.delete(panelKey);
    });

    return panel;
  }

  private getWebviewHtml(webview: vscode.Webview): string {
    const distUri = vscode.Uri.joinPath(this.extensionUri, "dist", "webview");
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(distUri, "assets", "main.js"));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(distUri, "assets", "main.css"));
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};">
  <link rel="stylesheet" href="${styleUri}">
  <title>Database Viewer</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private async handleMessage(
    msg: WebviewMessage,
    panel: vscode.WebviewPanel,
    connectionId: string
  ): Promise<void> {
    const sendResponse = (response: ExtensionMessage) => {
      panel.webview.postMessage(response);
    };

    try {
      switch (msg.type) {
        case "fetch-table-data": {
          sendResponse({ type: "loading", requestId: msg.requestId, loading: true });
          const result = await this.queryExecutor.fetchTableData(
            connectionId,
            msg.table,
            msg.schema,
            msg.where,
            msg.orderBy,
            msg.limit,
            msg.offset
          );
          sendResponse({
            type: "table-data",
            requestId: msg.requestId,
            rows: result.rows,
            columns: result.columns,
          });
          sendResponse({ type: "loading", requestId: msg.requestId, loading: false });
          break;
        }

        case "update-rows": {
          sendResponse({ type: "loading", requestId: msg.requestId, loading: true });
          const updateResult = await this.queryExecutor.updateRows(
            connectionId,
            msg.table,
            msg.schema,
            msg.changes
          );
          if (updateResult.errors.length > 0) {
            sendResponse({ type: "update-error", requestId: msg.requestId, errors: updateResult.errors });
          } else {
            sendResponse({ type: "update-success", requestId: msg.requestId, updatedCount: updateResult.updatedCount });
          }
          sendResponse({ type: "loading", requestId: msg.requestId, loading: false });
          break;
        }

        case "execute-query": {
          sendResponse({ type: "loading", requestId: msg.requestId, loading: true });
          const targetConnectionId = msg.connectionId || connectionId;
          const queryResult = await this.queryExecutor.executeRawQuery(targetConnectionId, msg.sql);
          sendResponse({
            type: "query-results",
            requestId: msg.requestId,
            results: queryResult.results,
            executionTimeMs: queryResult.executionTimeMs,
          });
          sendResponse({ type: "loading", requestId: msg.requestId, loading: false });
          break;
        }

        case "count-rows": {
          const count = await this.queryExecutor.countRows(
            connectionId,
            msg.table,
            msg.schema,
            msg.where
          );
          sendResponse({ type: "row-count", requestId: msg.requestId, count });
          break;
        }

        case "get-schema": {
          const targetId = msg.connectionId || connectionId;
          const driver = await this.connectionManager.getDriver(targetId);
          const tables = await driver.getTables();
          sendResponse({ type: "schema-info", requestId: msg.requestId, tables });
          break;
        }

        default:
          sendResponse({ type: "error", requestId: (msg as any).requestId, message: `Unknown message type: ${(msg as any).type}` });
      }
    } catch (error) {
      sendResponse({
        type: "error",
        requestId: (msg as any).requestId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  dispose(): void {
    for (const { panel } of this.panels.values()) {
      panel.dispose();
    }
    this.panels.clear();
  }
}

function getNonce(): string {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
```

- [ ] **Step 2: Create QueryExecutor stub**

`src/extension/database/queryExecutor.ts`:
```typescript
import { ConnectionManager } from "../connections/connectionManager";
import { ColumnMeta, QueryResult, RowChange } from "../../shared/types";

export interface UpdateResult {
  updatedCount: number;
  errors: { rowKey: Record<string, unknown>; message: string }[];
}

export interface RawQueryResult {
  results: QueryResult[];
  executionTimeMs: number;
}

export class QueryExecutor {
  constructor(private connectionManager: ConnectionManager) {}

  async fetchTableData(
    connectionId: string,
    table: string,
    schema?: string,
    where?: string,
    orderBy?: string,
    limit?: number,
    offset?: number
  ): Promise<{ rows: Record<string, unknown>[]; columns: ColumnMeta[] }> {
    const driver = await this.connectionManager.getDriver(connectionId);
    const qualifiedTable = schema ? `"${schema}"."${table}"` : `"${table}"`;

    let sql = `SELECT * FROM ${qualifiedTable}`;
    if (where && where.trim().length > 0) {
      sql += ` WHERE ${where}`;
    }
    if (orderBy && orderBy.trim().length > 0) {
      sql += ` ORDER BY ${orderBy}`;
    }
    sql += ` LIMIT ${limit || 50} OFFSET ${offset || 0}`;

    const result = await driver.execute(sql);

    const columns = await driver.getColumns(table, schema);

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
    if (where && where.trim().length > 0) {
      sql += ` WHERE ${where}`;
    }

    const result = await driver.execute(sql);
    return Number(result.rows[0]?.count ?? 0);
  }

  async updateRows(
    connectionId: string,
    table: string,
    schema: string | undefined,
    changes: RowChange[]
  ): Promise<UpdateResult> {
    const driver = await this.connectionManager.getDriver(connectionId);
    const qualifiedTable = schema ? `"${schema}"."${table}"` : `"${table}"`;
    const errors: { rowKey: Record<string, unknown>; message: string }[] = [];

    try {
      await driver.execute("BEGIN");

      for (const change of changes) {
        const setClauses: string[] = [];
        const whereClause: string[] = [];
        const params: unknown[] = [];
        let paramIndex = 1;

        for (const [col, value] of Object.entries(change.updates)) {
          setClauses.push(`"${col}" = $${paramIndex}`);
          params.push(value);
          paramIndex++;
        }

        for (const [col, value] of Object.entries(change.primaryKey)) {
          whereClause.push(`"${col}" = $${paramIndex}`);
          params.push(value);
          paramIndex++;
        }

        const sql = `UPDATE ${qualifiedTable} SET ${setClauses.join(", ")} WHERE ${whereClause.join(" AND ")}`;
        const result = await driver.execute(sql, params);

        if (result.affectedRows === 0) {
          throw new Error(`Row not found: ${JSON.stringify(change.primaryKey)}`);
        }
      }

      await driver.execute("COMMIT");
      return { updatedCount: changes.length, errors };
    } catch (error) {
      await driver.execute("ROLLBACK");
      errors.push({
        rowKey: changes[0]?.primaryKey || {},
        message: error instanceof Error ? error.message : String(error),
      });
      return { updatedCount: 0, errors };
    }
  }

  async executeRawQuery(connectionId: string, sql: string): Promise<RawQueryResult> {
    const driver = await this.connectionManager.getDriver(connectionId);
    const startTime = Date.now();

    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const results: QueryResult[] = [];
    for (const statement of statements) {
      const result = await driver.execute(statement);
      results.push(result);
    }

    return { results, executionTimeMs: Date.now() - startTime };
  }
}
```

- [ ] **Step 3: Update extension.ts to wire up WebviewManager**

Replace `src/extension/extension.ts`:
```typescript
import * as vscode from "vscode";
import { ConnectionManager } from "./connections/connectionManager";
import { DatabaseTreeProvider } from "./tree/treeProvider";
import { WebviewManager } from "./webview/webviewManager";

export function activate(context: vscode.ExtensionContext) {
  const connectionManager = new ConnectionManager(context);
  const treeProvider = new DatabaseTreeProvider(connectionManager);
  const webviewManager = new WebviewManager(context.extensionUri, connectionManager);

  const treeView = vscode.window.createTreeView("databaseViewer.connections", {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });

  context.subscriptions.push(
    treeView,
    vscode.commands.registerCommand("databaseViewer.addConnection", () => {
      vscode.window.showInformationMessage("Add Connection form - coming in Task 12");
    }),
    vscode.commands.registerCommand("databaseViewer.refresh", () => {
      treeProvider.refresh();
    }),
    vscode.commands.registerCommand(
      "databaseViewer.openTable",
      (connectionId: string, schema: string | undefined, table: string) => {
        webviewManager.openTableView(connectionId, schema, table);
      }
    ),
    vscode.commands.registerCommand("databaseViewer.openQuery", (connectionId?: string) => {
      const connections = connectionManager.getConnections();
      if (connections.length === 0) {
        vscode.window.showWarningMessage("No connections configured. Add a connection first.");
        return;
      }
      const targetId = connectionId || connections[0].id;
      webviewManager.openQueryConsole(targetId);
    })
  );

  context.subscriptions.push({ dispose: () => webviewManager.dispose() });
  context.subscriptions.push({ dispose: () => connectionManager.disconnectAll() });
}

export function deactivate() {}
```

- [ ] **Step 4: Verify build compiles**

Run:
```bash
npm run build:extension
```

Expected: `dist/extension.js` produced without errors.

- [ ] **Step 5: Commit**

```bash
git add src/extension/webview/webviewManager.ts src/extension/database/queryExecutor.ts src/extension/extension.ts
git commit -m "feat: add webview manager with panel lifecycle, query executor, and IPC routing"
```

---

### Task 8: Table View — AG Grid + Filter Toolbar (Read-Only)

**Files:**
- Create: `src/webview/components/TableView/TableView.tsx`
- Create: `src/webview/components/TableView/FilterToolbar.tsx`
- Modify: `src/webview/App.tsx`
- Create: `src/webview/types/messages.ts`
- Test: `test/webview/components/TableView.test.tsx`

- [ ] **Step 1: Create webview-side message types**

`src/webview/types/messages.ts`:
```typescript
export interface TableInitMessage {
  type: "init-table";
  connectionId: string;
  schema?: string;
  table: string;
}

export interface QueryInitMessage {
  type: "init-query";
  connectionId: string;
  connections: { id: string; name: string; driver: string }[];
}

export type InitMessage = TableInitMessage | QueryInitMessage;
```

- [ ] **Step 2: Update App.tsx to route between views**

`src/webview/App.tsx`:
```typescript
import React, { useEffect, useState } from "react";
import { TableView } from "./components/TableView/TableView";
import { InitMessage } from "./types/messages";

export default function App() {
  const [initData, setInitData] = useState<InitMessage | null>(null);

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === "init-table" || msg.type === "init-query") {
        setInitData(msg);
      }
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, []);

  if (!initData) {
    return <div className="loading">Loading...</div>;
  }

  if (initData.type === "init-table") {
    return (
      <TableView
        connectionId={initData.connectionId}
        schema={initData.schema}
        table={initData.table}
      />
    );
  }

  // Query console will be added in Task 10
  return <div>Query Console - coming soon</div>;
}
```

- [ ] **Step 3: Create FilterToolbar component**

`src/webview/components/TableView/FilterToolbar.tsx`:
```typescript
import React, { useState } from "react";

interface FilterToolbarProps {
  onApplyFilters: (where: string, orderBy: string, limit: number, offset: number) => void;
  onLoadCount: () => void;
  totalCount: number | null;
  currentOffset: number;
  currentLimit: number;
  loading: boolean;
}

export function FilterToolbar({
  onApplyFilters,
  onLoadCount,
  totalCount,
  currentOffset,
  currentLimit,
  loading,
}: FilterToolbarProps) {
  const [where, setWhere] = useState("");
  const [orderBy, setOrderBy] = useState("");
  const [limit, setLimit] = useState(currentLimit);

  const handleApply = () => {
    onApplyFilters(where, orderBy, limit, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleApply();
    }
  };

  const currentPage = Math.floor(currentOffset / limit) + 1;
  const totalPages = totalCount !== null ? Math.ceil(totalCount / limit) : null;

  const goToPage = (page: number) => {
    const newOffset = (page - 1) * limit;
    onApplyFilters(where, orderBy, limit, newOffset);
  };

  return (
    <div className="filter-toolbar">
      <div className="filter-inputs">
        <label>
          WHERE:
          <input
            type="text"
            value={where}
            onChange={(e) => setWhere(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. age > 25"
            disabled={loading}
          />
        </label>
        <label>
          ORDER BY:
          <input
            type="text"
            value={orderBy}
            onChange={(e) => setOrderBy(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. name ASC"
            disabled={loading}
          />
        </label>
        <label>
          LIMIT:
          <input
            type="number"
            value={limit}
            onChange={(e) => setLimit(Math.max(1, parseInt(e.target.value) || 50))}
            onKeyDown={handleKeyDown}
            min={1}
            max={10000}
            disabled={loading}
          />
        </label>
        <button onClick={handleApply} disabled={loading}>
          Apply Filters
        </button>
      </div>
      <div className="filter-pagination">
        <span>
          Showing {currentOffset + 1}–{currentOffset + limit} of{" "}
          {totalCount !== null ? (
            totalCount.toLocaleString()
          ) : (
            <button className="link-button" onClick={onLoadCount} disabled={loading}>
              Load Count
            </button>
          )}
        </span>
        {totalPages !== null && (
          <span className="page-controls">
            <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1 || loading}>
              &lt;
            </button>
            <span>Page {currentPage}{totalPages > 0 ? ` of ${totalPages}` : ""}</span>
            <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= (totalPages || 1) || loading}>
              &gt;
            </button>
          </span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create TableView component with AG Grid**

`src/webview/components/TableView/TableView.tsx`:
```typescript
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { ColDef } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { FilterToolbar } from "./FilterToolbar";
import { useExtensionMessage } from "../../hooks/useExtensionMessage";
import { ColumnMeta } from "../../../shared/types";

interface TableViewProps {
  connectionId: string;
  schema?: string;
  table: string;
}

export function TableView({ connectionId, schema, table }: TableViewProps) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [columns, setColumns] = useState<ColumnMeta[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(50);
  const gridRef = useRef<AgGridReact>(null);
  const { sendRequest } = useExtensionMessage();

  const fetchData = useCallback(
    (where?: string, orderBy?: string, newLimit?: number, newOffset?: number) => {
      const actualLimit = newLimit ?? limit;
      const actualOffset = newOffset ?? offset;
      setLimit(actualLimit);
      setOffset(actualOffset);
      setLoading(true);
      setError(null);

      sendRequest(
        {
          type: "fetch-table-data",
          table,
          schema,
          where: where || undefined,
          orderBy: orderBy || undefined,
          limit: actualLimit,
          offset: actualOffset,
        },
        (msg: any) => {
          if (msg.type === "table-data") {
            setRows(msg.rows);
            setColumns(msg.columns);
            setLoading(false);
          } else if (msg.type === "error") {
            setError(msg.message);
            setLoading(false);
          } else if (msg.type === "loading") {
            setLoading(msg.loading);
          }
        }
      );
    },
    [table, schema, limit, offset, sendRequest]
  );

  const loadCount = useCallback(() => {
    sendRequest(
      { type: "count-rows", table, schema },
      (msg: any) => {
        if (msg.type === "row-count") {
          setTotalCount(msg.count);
        }
      }
    );
  }, [table, schema, sendRequest]);

  useEffect(() => {
    fetchData();
  }, []);

  const colDefs: ColDef[] = columns.map((col) => ({
    field: col.name,
    headerName: col.name,
    sortable: false,
    filter: false,
    resizable: true,
    headerTooltip: `${col.dataType}${col.isPrimaryKey ? " (PK)" : ""}${col.nullable ? " (nullable)" : ""}`,
    cellStyle: col.isPrimaryKey ? { fontWeight: "bold" } : undefined,
    valueFormatter: (params: any) => {
      if (params.value === null) return "NULL";
      if (params.value instanceof Object) return JSON.stringify(params.value);
      return params.value;
    },
    cellClass: (params: any) => (params.value === null ? "null-cell" : ""),
  }));

  const handleApplyFilters = (where: string, orderBy: string, newLimit: number, newOffset: number) => {
    setTotalCount(null);
    fetchData(where, orderBy, newLimit, newOffset);
  };

  return (
    <div className="table-view">
      <div className="table-header">
        <h3>{schema ? `${schema}.${table}` : table}</h3>
      </div>
      <FilterToolbar
        onApplyFilters={handleApplyFilters}
        onLoadCount={loadCount}
        totalCount={totalCount}
        currentOffset={offset}
        currentLimit={limit}
        loading={loading}
      />
      {error && <div className="error-banner">{error}</div>}
      <div className="ag-theme-alpine grid-container">
        <AgGridReact
          ref={gridRef}
          rowData={rows}
          columnDefs={colDefs}
          defaultColDef={{ resizable: true, minWidth: 100 }}
          animateRows={false}
          loading={loading}
          getRowId={(params) => JSON.stringify(params.data)}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Add basic CSS**

Create `src/webview/styles.css`:
```css
:root {
  --bg: var(--vscode-editor-background, #1e1e1e);
  --fg: var(--vscode-editor-foreground, #cccccc);
  --input-bg: var(--vscode-input-background, #3c3c3c);
  --input-border: var(--vscode-input-border, #555555);
  --button-bg: var(--vscode-button-background, #0e639c);
  --button-fg: var(--vscode-button-foreground, #ffffff);
  --error-bg: var(--vscode-inputValidation-errorBackground, #5a1d1d);
}

body {
  margin: 0;
  padding: 8px;
  background: var(--bg);
  color: var(--fg);
  font-family: var(--vscode-font-family, sans-serif);
  font-size: var(--vscode-font-size, 13px);
}

.loading {
  padding: 20px;
  text-align: center;
}

.table-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.table-header h3 {
  margin: 0 0 8px 0;
}

.filter-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
  padding: 8px;
  border: 1px solid var(--input-border);
  border-radius: 4px;
}

.filter-inputs {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.filter-inputs label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
}

.filter-inputs input {
  background: var(--input-bg);
  color: var(--fg);
  border: 1px solid var(--input-border);
  padding: 4px 8px;
  border-radius: 2px;
}

.filter-inputs input[type="number"] {
  width: 60px;
}

button {
  background: var(--button-bg);
  color: var(--button-fg);
  border: none;
  padding: 4px 12px;
  border-radius: 2px;
  cursor: pointer;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.link-button {
  background: none;
  color: var(--vscode-textLink-foreground, #3794ff);
  padding: 0;
  text-decoration: underline;
  cursor: pointer;
}

.filter-pagination {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.page-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.page-controls button {
  padding: 2px 6px;
  font-size: 12px;
}

.error-banner {
  background: var(--error-bg);
  padding: 8px;
  margin-bottom: 8px;
  border-radius: 4px;
}

.grid-container {
  flex: 1;
  min-height: 300px;
}

.null-cell {
  color: #888;
  font-style: italic;
}
```

- [ ] **Step 6: Import styles in main.tsx**

Update `src/webview/main.tsx`:
```typescript
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 7: Write component test**

`test/webview/components/TableView.test.tsx`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FilterToolbar } from "../../../src/webview/components/TableView/FilterToolbar";

describe("FilterToolbar", () => {
  const defaultProps = {
    onApplyFilters: vi.fn(),
    onLoadCount: vi.fn(),
    totalCount: null,
    currentOffset: 0,
    currentLimit: 50,
    loading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders filter inputs", () => {
    render(<FilterToolbar {...defaultProps} />);
    expect(screen.getByPlaceholderText("e.g. age > 25")).toBeTruthy();
    expect(screen.getByPlaceholderText("e.g. name ASC")).toBeTruthy();
    expect(screen.getByText("Apply Filters")).toBeTruthy();
  });

  it("calls onApplyFilters when button clicked", () => {
    render(<FilterToolbar {...defaultProps} />);
    const whereInput = screen.getByPlaceholderText("e.g. age > 25");
    fireEvent.change(whereInput, { target: { value: "age > 25" } });
    fireEvent.click(screen.getByText("Apply Filters"));
    expect(defaultProps.onApplyFilters).toHaveBeenCalledWith("age > 25", "", 50, 0);
  });

  it("shows Load Count link when totalCount is null", () => {
    render(<FilterToolbar {...defaultProps} />);
    expect(screen.getByText("Load Count")).toBeTruthy();
  });

  it("shows total count when loaded", () => {
    render(<FilterToolbar {...defaultProps} totalCount={1234} />);
    expect(screen.getByText("1,234")).toBeTruthy();
  });

  it("shows pagination when count is loaded", () => {
    render(<FilterToolbar {...defaultProps} totalCount={200} />);
    expect(screen.getByText("Page 1 of 4")).toBeTruthy();
  });

  it("disables inputs when loading", () => {
    render(<FilterToolbar {...defaultProps} loading={true} />);
    const whereInput = screen.getByPlaceholderText("e.g. age > 25") as HTMLInputElement;
    expect(whereInput.disabled).toBe(true);
  });
});
```

- [ ] **Step 8: Install test dependencies**

Run:
```bash
npm install -D @testing-library/react @testing-library/jest-dom jsdom
```

Add to `vite.config.ts` or create `vitest.config.ts` with test environment:
```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
  },
});
```

- [ ] **Step 9: Run tests**

Run: `npx vitest run test/webview/components/TableView.test.tsx`
Expected: All 6 tests pass.

- [ ] **Step 10: Verify webview build**

Run:
```bash
npm run build:webview
```

Expected: `dist/webview/` contains `index.html`, `assets/main.js`, `assets/main.css`.

- [ ] **Step 11: Commit**

```bash
git add src/webview/ test/webview/ vitest.config.ts
git commit -m "feat: add table view with AG Grid, filter toolbar, and pagination"
```

---

### Task 9: Table View — Inline Editing + Batch Save

**Files:**
- Create: `src/webview/components/TableView/BatchActions.tsx`
- Modify: `src/webview/components/TableView/TableView.tsx`
- Test: `test/webview/components/BatchActions.test.tsx`

- [ ] **Step 1: Create BatchActions component**

`src/webview/components/TableView/BatchActions.tsx`:
```typescript
import React from "react";

interface BatchActionsProps {
  modifiedCount: number;
  hasPkChanges: boolean;
  onApply: () => void;
  onRevert: () => void;
  loading: boolean;
  errors: { rowKey: Record<string, unknown>; message: string }[];
}

export function BatchActions({
  modifiedCount,
  hasPkChanges,
  onApply,
  onRevert,
  loading,
  errors,
}: BatchActionsProps) {
  if (modifiedCount === 0 && errors.length === 0) return null;

  return (
    <div className="batch-actions">
      <div className="batch-info">
        {modifiedCount > 0 && (
          <span className="modified-count">{modifiedCount} row(s) modified</span>
        )}
        {errors.length > 0 && (
          <div className="batch-errors">
            {errors.map((err, i) => (
              <div key={i} className="batch-error">
                Row {JSON.stringify(err.rowKey)}: {err.message}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="batch-buttons">
        <button onClick={onRevert} disabled={loading || modifiedCount === 0}>
          Revert
        </button>
        <button onClick={onApply} disabled={loading || modifiedCount === 0} className="apply-button">
          Apply
        </button>
      </div>
      {hasPkChanges && (
        <div className="pk-warning">
          Warning: Primary key changes included. A confirmation will appear on Apply.
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add dirty state tracking and editing to TableView**

Replace `src/webview/components/TableView/TableView.tsx` with the full editable version:
```typescript
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { ColDef, CellValueChangedEvent } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { FilterToolbar } from "./FilterToolbar";
import { BatchActions } from "./BatchActions";
import { useExtensionMessage } from "../../hooks/useExtensionMessage";
import { ColumnMeta, RowChange } from "../../../shared/types";

interface TableViewProps {
  connectionId: string;
  schema?: string;
  table: string;
}

interface DirtyCell {
  originalValue: unknown;
  newValue: unknown;
}

type DirtyState = Map<string, Map<string, DirtyCell>>;

export function TableView({ connectionId, schema, table }: TableViewProps) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [columns, setColumns] = useState<ColumnMeta[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(50);
  const [dirtyState, setDirtyState] = useState<DirtyState>(new Map());
  const [updateErrors, setUpdateErrors] = useState<{ rowKey: Record<string, unknown>; message: string }[]>([]);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const gridRef = useRef<AgGridReact>(null);
  const { sendRequest } = useExtensionMessage();
  const originalRowsRef = useRef<Map<string, Record<string, unknown>>>(new Map());

  const primaryKeys = columns.filter((c) => c.isPrimaryKey).map((c) => c.name);

  const getRowKey = useCallback(
    (row: Record<string, unknown>): string => {
      if (primaryKeys.length === 0) return JSON.stringify(row);
      const key: Record<string, unknown> = {};
      for (const pk of primaryKeys) {
        key[pk] = row[pk];
      }
      return JSON.stringify(key);
    },
    [primaryKeys]
  );

  const fetchData = useCallback(
    (where?: string, orderBy?: string, newLimit?: number, newOffset?: number) => {
      const actualLimit = newLimit ?? limit;
      const actualOffset = newOffset ?? offset;
      setLimit(actualLimit);
      setOffset(actualOffset);
      setLoading(true);
      setError(null);
      setDirtyState(new Map());
      setUpdateErrors([]);

      sendRequest(
        {
          type: "fetch-table-data",
          table,
          schema,
          where: where || undefined,
          orderBy: orderBy || undefined,
          limit: actualLimit,
          offset: actualOffset,
        },
        (msg: any) => {
          if (msg.type === "table-data") {
            setRows(msg.rows);
            setColumns(msg.columns);
            setIsReadOnly(msg.columns.filter((c: ColumnMeta) => c.isPrimaryKey).length === 0);
            setLoading(false);
            originalRowsRef.current = new Map();
            for (const row of msg.rows) {
              const key = JSON.stringify(row);
              originalRowsRef.current.set(key, { ...row });
            }
          } else if (msg.type === "error") {
            setError(msg.message);
            setLoading(false);
          } else if (msg.type === "loading") {
            setLoading(msg.loading);
          }
        }
      );
    },
    [table, schema, limit, offset, sendRequest]
  );

  const loadCount = useCallback(() => {
    sendRequest(
      { type: "count-rows", table, schema },
      (msg: any) => {
        if (msg.type === "row-count") {
          setTotalCount(msg.count);
        }
      }
    );
  }, [table, schema, sendRequest]);

  useEffect(() => {
    fetchData();
  }, []);

  const handleCellValueChanged = useCallback(
    (event: CellValueChangedEvent) => {
      const rowKey = getRowKey(event.data);
      const colName = event.colDef.field!;
      const originalValue = event.oldValue;
      const newValue = event.newValue;

      setDirtyState((prev) => {
        const next = new Map(prev);
        if (!next.has(rowKey)) {
          next.set(rowKey, new Map());
        }
        const rowDirty = next.get(rowKey)!;

        if (originalValue === newValue) {
          rowDirty.delete(colName);
          if (rowDirty.size === 0) {
            next.delete(rowKey);
          }
        } else {
          rowDirty.set(colName, { originalValue, newValue });
        }
        return next;
      });
    },
    [getRowKey]
  );

  const hasPkChanges = Array.from(dirtyState.values()).some((rowDirty) =>
    primaryKeys.some((pk) => rowDirty.has(pk))
  );

  const handleApply = useCallback(() => {
    if (hasPkChanges) {
      const confirmed = window.confirm(
        "You are modifying primary key values. This may affect referential integrity. Continue?"
      );
      if (!confirmed) return;
    }

    const changes: RowChange[] = [];
    for (const [rowKeyStr, rowDirty] of dirtyState.entries()) {
      const pkValues = JSON.parse(rowKeyStr);
      const updates: Record<string, unknown> = {};
      for (const [col, cell] of rowDirty.entries()) {
        updates[col] = cell.newValue;
      }
      changes.push({ primaryKey: pkValues, updates });
    }

    setLoading(true);
    setUpdateErrors([]);

    sendRequest(
      { type: "update-rows", table, schema, changes },
      (msg: any) => {
        if (msg.type === "update-success") {
          setDirtyState(new Map());
          fetchData();
        } else if (msg.type === "update-error") {
          setUpdateErrors(msg.errors);
          setLoading(false);
        } else if (msg.type === "error") {
          setUpdateErrors([{ rowKey: {}, message: msg.message }]);
          setLoading(false);
        } else if (msg.type === "loading") {
          setLoading(msg.loading);
        }
      }
    );
  }, [dirtyState, hasPkChanges, table, schema, sendRequest, fetchData]);

  const handleRevert = useCallback(() => {
    setDirtyState(new Map());
    setUpdateErrors([]);
    fetchData();
  }, [fetchData]);

  const colDefs: ColDef[] = columns.map((col) => ({
    field: col.name,
    headerName: col.name,
    sortable: false,
    filter: false,
    resizable: true,
    editable: !isReadOnly,
    headerTooltip: `${col.dataType}${col.isPrimaryKey ? " (PK)" : ""}${col.nullable ? " (nullable)" : ""}`,
    cellStyle: (params: any) => {
      const rowKey = getRowKey(params.data);
      const rowDirty = dirtyState.get(rowKey);
      if (rowDirty?.has(col.name)) {
        return { backgroundColor: "rgba(255, 165, 0, 0.2)", fontWeight: "bold" };
      }
      if (col.isPrimaryKey) {
        return { fontWeight: "bold" };
      }
      return undefined;
    },
    valueFormatter: (params: any) => {
      if (params.value === null) return "NULL";
      if (params.value instanceof Object) return JSON.stringify(params.value);
      return params.value;
    },
    cellClass: (params: any) => (params.value === null ? "null-cell" : ""),
  }));

  const handleApplyFilters = (where: string, orderBy: string, newLimit: number, newOffset: number) => {
    setTotalCount(null);
    fetchData(where, orderBy, newLimit, newOffset);
  };

  return (
    <div className="table-view">
      <div className="table-header">
        <h3>{schema ? `${schema}.${table}` : table}</h3>
        {isReadOnly && (
          <span className="read-only-badge">Read-only (no primary key)</span>
        )}
      </div>
      <FilterToolbar
        onApplyFilters={handleApplyFilters}
        onLoadCount={loadCount}
        totalCount={totalCount}
        currentOffset={offset}
        currentLimit={limit}
        loading={loading}
      />
      {error && <div className="error-banner">{error}</div>}
      <div className="ag-theme-alpine grid-container">
        <AgGridReact
          ref={gridRef}
          rowData={rows}
          columnDefs={colDefs}
          defaultColDef={{ resizable: true, minWidth: 100 }}
          animateRows={false}
          loading={loading}
          onCellValueChanged={handleCellValueChanged}
          getRowId={(params) => getRowKey(params.data)}
          stopEditingWhenCellsLoseFocus={true}
        />
      </div>
      <BatchActions
        modifiedCount={dirtyState.size}
        hasPkChanges={hasPkChanges}
        onApply={handleApply}
        onRevert={handleRevert}
        loading={loading}
        errors={updateErrors}
      />
    </div>
  );
}
```

- [ ] **Step 3: Add batch actions CSS**

Append to `src/webview/styles.css`:
```css
.batch-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  border-top: 1px solid var(--input-border);
  margin-top: 8px;
  flex-wrap: wrap;
  gap: 8px;
}

.batch-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.modified-count {
  font-size: 12px;
  color: orange;
}

.batch-errors {
  max-height: 80px;
  overflow-y: auto;
}

.batch-error {
  font-size: 11px;
  color: var(--vscode-errorForeground, #f48771);
}

.batch-buttons {
  display: flex;
  gap: 8px;
}

.apply-button {
  background: var(--vscode-button-background, #0e639c);
}

.pk-warning {
  width: 100%;
  font-size: 11px;
  color: orange;
  font-style: italic;
}

.read-only-badge {
  font-size: 11px;
  background: var(--vscode-badge-background, #4d4d4d);
  color: var(--vscode-badge-foreground, #ffffff);
  padding: 2px 6px;
  border-radius: 3px;
  margin-left: 8px;
}

.table-header {
  display: flex;
  align-items: center;
}
```

- [ ] **Step 4: Write BatchActions test**

`test/webview/components/BatchActions.test.tsx`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BatchActions } from "../../../src/webview/components/TableView/BatchActions";

describe("BatchActions", () => {
  const defaultProps = {
    modifiedCount: 0,
    hasPkChanges: false,
    onApply: vi.fn(),
    onRevert: vi.fn(),
    loading: false,
    errors: [] as { rowKey: Record<string, unknown>; message: string }[],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when no modifications and no errors", () => {
    const { container } = render(<BatchActions {...defaultProps} />);
    expect(container.innerHTML).toBe("");
  });

  it("shows modified count", () => {
    render(<BatchActions {...defaultProps} modifiedCount={3} />);
    expect(screen.getByText("3 row(s) modified")).toBeTruthy();
  });

  it("calls onApply when Apply clicked", () => {
    render(<BatchActions {...defaultProps} modifiedCount={2} />);
    fireEvent.click(screen.getByText("Apply"));
    expect(defaultProps.onApply).toHaveBeenCalledTimes(1);
  });

  it("calls onRevert when Revert clicked", () => {
    render(<BatchActions {...defaultProps} modifiedCount={2} />);
    fireEvent.click(screen.getByText("Revert"));
    expect(defaultProps.onRevert).toHaveBeenCalledTimes(1);
  });

  it("shows PK warning when hasPkChanges is true", () => {
    render(<BatchActions {...defaultProps} modifiedCount={1} hasPkChanges={true} />);
    expect(screen.getByText(/primary key/i)).toBeTruthy();
  });

  it("shows errors", () => {
    const errors = [{ rowKey: { id: 1 }, message: "Constraint violation" }];
    render(<BatchActions {...defaultProps} errors={errors} />);
    expect(screen.getByText(/Constraint violation/)).toBeTruthy();
  });

  it("disables buttons when loading", () => {
    render(<BatchActions {...defaultProps} modifiedCount={2} loading={true} />);
    expect((screen.getByText("Apply") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByText("Revert") as HTMLButtonElement).disabled).toBe(true);
  });
});
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run test/webview/components/BatchActions.test.tsx`
Expected: All 7 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/webview/components/TableView/ src/webview/styles.css test/webview/components/BatchActions.test.tsx
git commit -m "feat: add inline cell editing with dirty state tracking and batch save"
```

---

### Task 10: Query Console — Monaco Editor + Run

**Files:**
- Create: `src/webview/components/QueryConsole/QueryConsole.tsx`
- Modify: `src/webview/App.tsx`
- Modify: `vite.config.ts` (Monaco worker config)

- [ ] **Step 1: Install Monaco editor for React**

Run:
```bash
npm install @monaco-editor/react
```

- [ ] **Step 2: Create QueryConsole component**

`src/webview/components/QueryConsole/QueryConsole.tsx`:
```typescript
import React, { useCallback, useRef, useState } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import { editor } from "monaco-editor";
import { useExtensionMessage } from "../../hooks/useExtensionMessage";
import { QueryResult } from "../../../shared/types";
import { ResultsGrid } from "./ResultsGrid";

interface QueryConsoleProps {
  connectionId: string;
  connections: { id: string; name: string; driver: string }[];
}

export function QueryConsole({ connectionId, connections }: QueryConsoleProps) {
  const [activeConnectionId, setActiveConnectionId] = useState(connectionId);
  const [results, setResults] = useState<QueryResult[]>([]);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const { sendRequest } = useExtensionMessage();

  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor;
  };

  const getSelectedText = (): string | null => {
    if (!editorRef.current) return null;
    const selection = editorRef.current.getSelection();
    if (!selection || selection.isEmpty()) return null;
    return editorRef.current.getModel()?.getValueInRange(selection) || null;
  };

  const getFullText = (): string => {
    return editorRef.current?.getValue() || "";
  };

  const executeQuery = useCallback(
    (sql: string) => {
      if (!sql.trim()) return;

      setLoading(true);
      setError(null);
      setResults([]);
      setExecutionTime(null);

      sendRequest(
        { type: "execute-query", sql, connectionId: activeConnectionId },
        (msg: any) => {
          if (msg.type === "query-results") {
            setResults(msg.results);
            setExecutionTime(msg.executionTimeMs);
            setLoading(false);
          } else if (msg.type === "error") {
            setError(msg.message);
            setLoading(false);
          } else if (msg.type === "loading") {
            setLoading(msg.loading);
          }
        }
      );
    },
    [activeConnectionId, sendRequest]
  );

  const handleRun = () => {
    executeQuery(getFullText());
  };

  const handleRunSelection = () => {
    const selected = getSelectedText();
    if (selected) {
      executeQuery(selected);
    }
  };

  const hasSelection = (): boolean => {
    if (!editorRef.current) return false;
    const selection = editorRef.current.getSelection();
    return !!selection && !selection.isEmpty();
  };

  return (
    <div className="query-console">
      <div className="query-toolbar">
        <label>
          Connection:
          <select
            value={activeConnectionId}
            onChange={(e) => setActiveConnectionId(e.target.value)}
            disabled={loading}
          >
            {connections.map((conn) => (
              <option key={conn.id} value={conn.id}>
                {conn.name} ({conn.driver})
              </option>
            ))}
          </select>
        </label>
        <div className="query-buttons">
          <button onClick={handleRun} disabled={loading}>
            Run ▶
          </button>
          <button onClick={handleRunSelection} disabled={loading}>
            Run Selection
          </button>
        </div>
      </div>
      <div className="query-editor">
        <Editor
          height="40%"
          defaultLanguage="sql"
          defaultValue="-- Write your SQL here\n"
          theme="vs-dark"
          onMount={handleEditorMount}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            wordWrap: "on",
            automaticLayout: true,
          }}
        />
      </div>
      <div className="query-results">
        {error && <div className="error-banner">{error}</div>}
        {executionTime !== null && (
          <div className="execution-info">
            {results.reduce((sum, r) => sum + r.rowCount, 0)} row(s) returned in {executionTime}ms
          </div>
        )}
        {loading && <div className="loading">Executing query...</div>}
        {results.length > 0 && <ResultsGrid results={results} />}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update App.tsx to render QueryConsole**

Update the query branch in `src/webview/App.tsx`:
```typescript
import React, { useEffect, useState } from "react";
import { TableView } from "./components/TableView/TableView";
import { QueryConsole } from "./components/QueryConsole/QueryConsole";
import { InitMessage } from "./types/messages";

export default function App() {
  const [initData, setInitData] = useState<InitMessage | null>(null);

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === "init-table" || msg.type === "init-query") {
        setInitData(msg);
      }
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, []);

  if (!initData) {
    return <div className="loading">Loading...</div>;
  }

  if (initData.type === "init-table") {
    return (
      <TableView
        connectionId={initData.connectionId}
        schema={initData.schema}
        table={initData.table}
      />
    );
  }

  if (initData.type === "init-query") {
    return (
      <QueryConsole
        connectionId={initData.connectionId}
        connections={initData.connections}
      />
    );
  }

  return <div>Unknown view</div>;
}
```

- [ ] **Step 4: Add query console CSS**

Append to `src/webview/styles.css`:
```css
.query-console {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.query-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  border-bottom: 1px solid var(--input-border);
}

.query-toolbar label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
}

.query-toolbar select {
  background: var(--input-bg);
  color: var(--fg);
  border: 1px solid var(--input-border);
  padding: 4px 8px;
  border-radius: 2px;
}

.query-buttons {
  display: flex;
  gap: 8px;
}

.query-editor {
  flex: 0 0 40%;
  border-bottom: 1px solid var(--input-border);
}

.query-results {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 8px;
}

.execution-info {
  font-size: 12px;
  padding: 4px 0;
  color: var(--vscode-descriptionForeground, #999);
}
```

- [ ] **Step 5: Verify build**

Run:
```bash
npm run build:webview
```

Expected: Builds without errors. Monaco editor is bundled.

- [ ] **Step 6: Commit**

```bash
git add src/webview/components/QueryConsole/QueryConsole.tsx src/webview/App.tsx src/webview/styles.css package.json package-lock.json
git commit -m "feat: add query console with Monaco SQL editor and connection picker"
```

---

### Task 11: Query Console — Results Grid + Multi-Statement

**Files:**
- Create: `src/webview/components/QueryConsole/ResultsGrid.tsx`
- Test: `test/webview/components/ResultsGrid.test.tsx`

- [ ] **Step 1: Create ResultsGrid component**

`src/webview/components/QueryConsole/ResultsGrid.tsx`:
```typescript
import React, { useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { ColDef } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { QueryResult } from "../../../shared/types";

interface ResultsGridProps {
  results: QueryResult[];
}

export function ResultsGrid({ results }: ResultsGridProps) {
  const [activeTab, setActiveTab] = useState(0);

  if (results.length === 0) return null;

  const activeResult = results[activeTab];

  const colDefs: ColDef[] = activeResult.columns.map((col) => ({
    field: col.name,
    headerName: col.name,
    sortable: true,
    filter: false,
    resizable: true,
    valueFormatter: (params: any) => {
      if (params.value === null) return "NULL";
      if (params.value instanceof Object) return JSON.stringify(params.value);
      return params.value;
    },
    cellClass: (params: any) => (params.value === null ? "null-cell" : ""),
  }));

  return (
    <div className="results-grid">
      {results.length > 1 && (
        <div className="results-tabs">
          {results.map((_, idx) => (
            <button
              key={idx}
              className={`results-tab ${idx === activeTab ? "active" : ""}`}
              onClick={() => setActiveTab(idx)}
            >
              Statement {idx + 1}
              <span className="tab-count">({results[idx].rowCount} rows)</span>
            </button>
          ))}
        </div>
      )}
      {activeResult.rows.length > 0 ? (
        <div className="ag-theme-alpine results-grid-container">
          <AgGridReact
            rowData={activeResult.rows}
            columnDefs={colDefs}
            defaultColDef={{ resizable: true, minWidth: 80 }}
            animateRows={false}
            domLayout={activeResult.rows.length <= 20 ? "autoHeight" : "normal"}
          />
        </div>
      ) : (
        <div className="no-rows">
          {activeResult.affectedRows !== undefined
            ? `${activeResult.affectedRows} row(s) affected`
            : "Query executed successfully (no rows returned)"}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add results grid CSS**

Append to `src/webview/styles.css`:
```css
.results-grid {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.results-tabs {
  display: flex;
  gap: 2px;
  padding: 4px 0;
  border-bottom: 1px solid var(--input-border);
}

.results-tab {
  background: transparent;
  color: var(--fg);
  border: 1px solid var(--input-border);
  border-bottom: none;
  padding: 4px 12px;
  border-radius: 4px 4px 0 0;
  font-size: 12px;
  cursor: pointer;
}

.results-tab.active {
  background: var(--input-bg);
  border-bottom: 2px solid var(--button-bg);
}

.tab-count {
  margin-left: 4px;
  opacity: 0.7;
  font-size: 11px;
}

.results-grid-container {
  flex: 1;
  min-height: 200px;
}

.no-rows {
  padding: 16px;
  font-size: 12px;
  color: var(--vscode-descriptionForeground, #999);
  text-align: center;
}
```

- [ ] **Step 3: Write test for ResultsGrid**

`test/webview/components/ResultsGrid.test.tsx`:
```typescript
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ResultsGrid } from "../../../src/webview/components/QueryConsole/ResultsGrid";
import { QueryResult } from "../../../src/shared/types";

describe("ResultsGrid", () => {
  const singleResult: QueryResult[] = [
    {
      rows: [{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }],
      columns: [
        { name: "id", dataType: "integer", nullable: false, isPrimaryKey: true },
        { name: "name", dataType: "varchar", nullable: true, isPrimaryKey: false },
      ],
      rowCount: 2,
    },
  ];

  const multiResults: QueryResult[] = [
    {
      rows: [{ id: 1, name: "Alice" }],
      columns: [
        { name: "id", dataType: "integer", nullable: false, isPrimaryKey: true },
        { name: "name", dataType: "varchar", nullable: true, isPrimaryKey: false },
      ],
      rowCount: 1,
    },
    {
      rows: [{ count: 42 }],
      columns: [
        { name: "count", dataType: "bigint", nullable: false, isPrimaryKey: false },
      ],
      rowCount: 1,
    },
  ];

  it("renders nothing when results are empty", () => {
    const { container } = render(<ResultsGrid results={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("does not show tabs for single result", () => {
    render(<ResultsGrid results={singleResult} />);
    expect(screen.queryByText("Statement 1")).toBeNull();
  });

  it("shows tabs for multiple results", () => {
    render(<ResultsGrid results={multiResults} />);
    expect(screen.getByText("Statement 1")).toBeTruthy();
    expect(screen.getByText("Statement 2")).toBeTruthy();
  });

  it("switches active tab on click", () => {
    render(<ResultsGrid results={multiResults} />);
    const tab2 = screen.getByText("Statement 2");
    fireEvent.click(tab2);
    expect(tab2.className).toContain("active");
  });

  it("shows affected rows message for non-SELECT", () => {
    const updateResult: QueryResult[] = [
      { rows: [], columns: [], rowCount: 0, affectedRows: 5 },
    ];
    render(<ResultsGrid results={updateResult} />);
    expect(screen.getByText("5 row(s) affected")).toBeTruthy();
  });
});
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run test/webview/components/ResultsGrid.test.tsx`
Expected: All 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/webview/components/QueryConsole/ResultsGrid.tsx src/webview/styles.css test/webview/components/ResultsGrid.test.tsx
git commit -m "feat: add results grid with multi-statement tab support"
```

---

### Task 12: Connection Form Webview

**Files:**
- Create: `src/webview/components/ConnectionForm/ConnectionForm.tsx`
- Modify: `src/webview/App.tsx`
- Modify: `src/webview/types/messages.ts`
- Modify: `src/extension/webview/webviewManager.ts`
- Modify: `src/extension/extension.ts`

- [ ] **Step 1: Add connection form init message type**

Update `src/webview/types/messages.ts`:
```typescript
export interface TableInitMessage {
  type: "init-table";
  connectionId: string;
  schema?: string;
  table: string;
}

export interface QueryInitMessage {
  type: "init-query";
  connectionId: string;
  connections: { id: string; name: string; driver: string }[];
}

export interface ConnectionFormInitMessage {
  type: "init-connection-form";
  existingConfig?: {
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
  };
}

export type InitMessage = TableInitMessage | QueryInitMessage | ConnectionFormInitMessage;
```

- [ ] **Step 2: Create ConnectionForm component**

`src/webview/components/ConnectionForm/ConnectionForm.tsx`:
```typescript
import React, { useState } from "react";
import { useExtensionMessage } from "../../hooks/useExtensionMessage";
import { ConnectionConfig } from "../../../shared/types";

interface ConnectionFormProps {
  existingConfig?: ConnectionConfig;
}

export function ConnectionForm({ existingConfig }: ConnectionFormProps) {
  const [driver, setDriver] = useState<"postgres" | "sqlite">(existingConfig?.driver || "postgres");
  const [name, setName] = useState(existingConfig?.name || "");
  const [host, setHost] = useState(existingConfig?.host || "localhost");
  const [port, setPort] = useState(existingConfig?.port || 5432);
  const [database, setDatabase] = useState(existingConfig?.database || "");
  const [username, setUsername] = useState(existingConfig?.username || "");
  const [password, setPassword] = useState("");
  const [filePath, setFilePath] = useState(existingConfig?.filePath || "");
  const [sslEnabled, setSslEnabled] = useState(existingConfig?.ssl?.enabled || false);
  const [caFile, setCaFile] = useState(existingConfig?.ssl?.caFile || "");
  const [clientCertFile, setClientCertFile] = useState(existingConfig?.ssl?.clientCertFile || "");
  const [clientKeyFile, setClientKeyFile] = useState(existingConfig?.ssl?.clientKeyFile || "");
  const [rejectUnauthorized, setRejectUnauthorized] = useState(existingConfig?.ssl?.rejectUnauthorized ?? true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { sendRequest } = useExtensionMessage();

  const buildConfig = (): ConnectionConfig => {
    const config: ConnectionConfig = {
      id: existingConfig?.id || crypto.randomUUID(),
      name,
      driver,
    };

    if (driver === "postgres") {
      config.host = host;
      config.port = port;
      config.database = database;
      config.username = username;
      if (sslEnabled) {
        config.ssl = {
          enabled: true,
          caFile: caFile || undefined,
          clientCertFile: clientCertFile || undefined,
          clientKeyFile: clientKeyFile || undefined,
          rejectUnauthorized,
        };
      }
    } else {
      config.filePath = filePath;
    }

    return config;
  };

  const handleTest = () => {
    setTesting(true);
    setTestResult(null);

    sendRequest(
      { type: "test-connection", config: buildConfig() },
      (msg: any) => {
        if (msg.type === "connection-test-result") {
          setTestResult({ success: msg.success, error: msg.error });
        } else if (msg.type === "error") {
          setTestResult({ success: false, error: msg.message });
        }
        setTesting(false);
      }
    );
  };

  const handleSave = () => {
    setSaving(true);
    setSaveError(null);

    sendRequest(
      { type: "save-connection", config: buildConfig(), password: driver === "postgres" ? password : undefined },
      (msg: any) => {
        if (msg.type === "connection-saved") {
          setSaving(false);
          // Panel will be closed by extension host
        } else if (msg.type === "error") {
          setSaveError(msg.message);
          setSaving(false);
        }
      }
    );
  };

  return (
    <div className="connection-form">
      <h2>{existingConfig ? "Edit Connection" : "New Connection"}</h2>

      <div className="form-group">
        <label>Driver</label>
        <select value={driver} onChange={(e) => setDriver(e.target.value as "postgres" | "sqlite")}>
          <option value="postgres">PostgreSQL</option>
          <option value="sqlite">SQLite</option>
        </select>
      </div>

      <div className="form-group">
        <label>Connection Name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="My Database" />
      </div>

      {driver === "postgres" && (
        <>
          <div className="form-row">
            <div className="form-group">
              <label>Host</label>
              <input type="text" value={host} onChange={(e) => setHost(e.target.value)} />
            </div>
            <div className="form-group form-group-small">
              <label>Port</label>
              <input type="number" value={port} onChange={(e) => setPort(parseInt(e.target.value) || 5432)} />
            </div>
          </div>
          <div className="form-group">
            <label>Database</label>
            <input type="text" value={database} onChange={(e) => setDatabase(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Username</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={existingConfig ? "(unchanged)" : ""} />
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input type="checkbox" checked={sslEnabled} onChange={(e) => setSslEnabled(e.target.checked)} />
              Enable SSL
            </label>
          </div>

          {sslEnabled && (
            <div className="ssl-fields">
              <div className="form-group">
                <label>CA Certificate File</label>
                <input type="text" value={caFile} onChange={(e) => setCaFile(e.target.value)} placeholder="/path/to/ca-cert.pem" />
              </div>
              <div className="form-group">
                <label>Client Certificate File (optional)</label>
                <input type="text" value={clientCertFile} onChange={(e) => setClientCertFile(e.target.value)} placeholder="/path/to/client-cert.pem" />
              </div>
              <div className="form-group">
                <label>Client Key File (optional)</label>
                <input type="text" value={clientKeyFile} onChange={(e) => setClientKeyFile(e.target.value)} placeholder="/path/to/client-key.pem" />
              </div>
              <div className="form-group">
                <label className="checkbox-label">
                  <input type="checkbox" checked={rejectUnauthorized} onChange={(e) => setRejectUnauthorized(e.target.checked)} />
                  Reject Unauthorized (verify server certificate)
                </label>
              </div>
            </div>
          )}
        </>
      )}

      {driver === "sqlite" && (
        <div className="form-group">
          <label>Database File Path</label>
          <input type="text" value={filePath} onChange={(e) => setFilePath(e.target.value)} placeholder="/path/to/database.db" />
        </div>
      )}

      {testResult && (
        <div className={`test-result ${testResult.success ? "success" : "failure"}`}>
          {testResult.success ? "Connection successful!" : `Connection failed: ${testResult.error}`}
        </div>
      )}

      {saveError && <div className="error-banner">{saveError}</div>}

      <div className="form-actions">
        <button onClick={handleTest} disabled={testing || saving}>
          {testing ? "Testing..." : "Test Connection"}
        </button>
        <button onClick={handleSave} disabled={testing || saving} className="apply-button">
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update App.tsx to handle connection form**

Add to `src/webview/App.tsx` imports and routing:
```typescript
import { ConnectionForm } from "./components/ConnectionForm/ConnectionForm";

// In the render function, add before the final return:
if (initData.type === "init-connection-form") {
  return <ConnectionForm existingConfig={initData.existingConfig} />;
}
```

- [ ] **Step 4: Add openConnectionForm to WebviewManager**

Add this method to `src/extension/webview/webviewManager.ts`:
```typescript
openConnectionForm(existingConfig?: ConnectionConfig): void {
  const panelKey = existingConfig ? `conn-form:${existingConfig.id}` : `conn-form:new-${Date.now()}`;
  const title = existingConfig ? `Edit: ${existingConfig.name}` : "New Connection";

  const panel = this.createPanel(title, panelKey, "table", "");

  panel.webview.postMessage({
    type: "init-connection-form",
    existingConfig,
  });

  // Override message handler for connection form
  panel.webview.onDidReceiveMessage(async (msg: WebviewMessage) => {
    if (msg.type === "test-connection") {
      try {
        const driver = msg.config.driver === "sqlite"
          ? new (await import("../database/drivers/sqlite")).SqliteDriver({ filePath: msg.config.filePath! })
          : new (await import("../database/drivers/postgres")).PostgresDriver({
              host: msg.config.host!,
              port: msg.config.port!,
              database: msg.config.database!,
              username: msg.config.username!,
              password: (msg as any).password || "",
            });
        await driver.connect();
        await driver.disconnect();
        panel.webview.postMessage({ type: "connection-test-result", requestId: msg.requestId, success: true });
      } catch (error) {
        panel.webview.postMessage({
          type: "connection-test-result",
          requestId: msg.requestId,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } else if (msg.type === "save-connection") {
      try {
        const existing = this.connectionManager.getConnection(msg.config.id);
        if (existing) {
          await this.connectionManager.updateConnection(msg.config, msg.password);
        } else {
          await this.connectionManager.addConnection(msg.config, msg.password);
        }
        panel.webview.postMessage({ type: "connection-saved", requestId: msg.requestId });
        panel.dispose();
      } catch (error) {
        panel.webview.postMessage({
          type: "error",
          requestId: msg.requestId,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  });

  this.panels.set(panelKey, { panel, type: "table", connectionId: "" });
}
```

- [ ] **Step 5: Wire up addConnection command**

Update `src/extension/extension.ts` command registration:
```typescript
vscode.commands.registerCommand("databaseViewer.addConnection", () => {
  webviewManager.openConnectionForm();
}),
```

- [ ] **Step 6: Add connection form CSS**

Append to `src/webview/styles.css`:
```css
.connection-form {
  max-width: 500px;
  margin: 0 auto;
  padding: 20px;
}

.connection-form h2 {
  margin: 0 0 16px 0;
}

.form-group {
  margin-bottom: 12px;
}

.form-group label {
  display: block;
  font-size: 12px;
  margin-bottom: 4px;
}

.form-group input[type="text"],
.form-group input[type="password"],
.form-group input[type="number"],
.form-group select {
  width: 100%;
  background: var(--input-bg);
  color: var(--fg);
  border: 1px solid var(--input-border);
  padding: 6px 8px;
  border-radius: 2px;
  box-sizing: border-box;
}

.form-row {
  display: flex;
  gap: 12px;
}

.form-row .form-group {
  flex: 1;
}

.form-group-small {
  max-width: 100px;
}

.checkbox-label {
  display: flex !important;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.ssl-fields {
  margin-left: 16px;
  padding-left: 12px;
  border-left: 2px solid var(--input-border);
}

.test-result {
  padding: 8px;
  border-radius: 4px;
  margin-bottom: 12px;
  font-size: 12px;
}

.test-result.success {
  background: rgba(0, 180, 0, 0.15);
  color: #4ec94e;
}

.test-result.failure {
  background: var(--error-bg);
  color: var(--vscode-errorForeground, #f48771);
}

.form-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 16px;
}
```

- [ ] **Step 7: Verify build**

Run:
```bash
npm run build
```

Expected: Both extension and webview build successfully.

- [ ] **Step 8: Commit**

```bash
git add src/webview/components/ConnectionForm/ src/webview/App.tsx src/webview/types/messages.ts src/webview/styles.css src/extension/webview/webviewManager.ts src/extension/extension.ts
git commit -m "feat: add connection form with driver-specific fields, SSL config, and test button"
```

---

### Task 13: Error Handling, Polish & Final Wiring

**Files:**
- Modify: `src/extension/webview/webviewManager.ts`
- Modify: `src/extension/tree/treeProvider.ts`
- Modify: `src/extension/connections/connectionManager.ts`
- Modify: `package.json` (context menus)
- Create: `media/db-icon.svg`

- [ ] **Step 1: Add context menu contributions to package.json**

Add to `contributes` in `package.json`:
```json
"menus": {
  "view/item/context": [
    {
      "command": "databaseViewer.openTable",
      "when": "viewItem == table",
      "group": "navigation"
    },
    {
      "command": "databaseViewer.openQuery",
      "when": "viewItem == connection",
      "group": "navigation"
    },
    {
      "command": "databaseViewer.editConnection",
      "when": "viewItem == connection",
      "group": "1_modify"
    },
    {
      "command": "databaseViewer.deleteConnection",
      "when": "viewItem == connection",
      "group": "1_modify"
    },
    {
      "command": "databaseViewer.disconnect",
      "when": "viewItem == connection",
      "group": "2_connection"
    }
  ],
  "view/title": [
    {
      "command": "databaseViewer.refresh",
      "when": "view == databaseViewer.connections",
      "group": "navigation"
    },
    {
      "command": "databaseViewer.addConnection",
      "when": "view == databaseViewer.connections",
      "group": "navigation"
    }
  ]
},
"commands": [
  { "command": "databaseViewer.addConnection", "title": "Database Viewer: Add Connection", "icon": "$(add)" },
  { "command": "databaseViewer.openQuery", "title": "Database Viewer: New Query Console", "icon": "$(terminal)" },
  { "command": "databaseViewer.refresh", "title": "Database Viewer: Refresh", "icon": "$(refresh)" },
  { "command": "databaseViewer.openTable", "title": "Open Table" },
  { "command": "databaseViewer.editConnection", "title": "Edit Connection" },
  { "command": "databaseViewer.deleteConnection", "title": "Delete Connection" },
  { "command": "databaseViewer.disconnect", "title": "Disconnect" }
]
```

- [ ] **Step 2: Register new commands in extension.ts**

Add to `src/extension/extension.ts`:
```typescript
vscode.commands.registerCommand("databaseViewer.editConnection", (node: DatabaseTreeItem) => {
  if (node.connectionId) {
    const config = connectionManager.getConnection(node.connectionId);
    if (config) {
      webviewManager.openConnectionForm(config);
    }
  }
}),
vscode.commands.registerCommand("databaseViewer.deleteConnection", async (node: DatabaseTreeItem) => {
  if (node.connectionId) {
    const config = connectionManager.getConnection(node.connectionId);
    const confirm = await vscode.window.showWarningMessage(
      `Delete connection "${config?.name}"?`,
      { modal: true },
      "Delete"
    );
    if (confirm === "Delete") {
      await connectionManager.deleteConnection(node.connectionId);
    }
  }
}),
vscode.commands.registerCommand("databaseViewer.disconnect", async (node: DatabaseTreeItem) => {
  if (node.connectionId) {
    const driver = await connectionManager.getDriver(node.connectionId);
    await driver.disconnect();
    treeProvider.refresh();
    vscode.window.showInformationMessage("Disconnected.");
  }
}),
```

- [ ] **Step 3: Add auto-reconnect logic to ConnectionManager**

Add to `src/extension/connections/connectionManager.ts` `getDriver` method, wrapping the cached driver check:
```typescript
async getDriver(id: string): Promise<DatabaseDriver> {
  const cached = this.drivers.get(id);
  if (cached) {
    if (cached.isConnected()) {
      return cached;
    }
    // Auto-reconnect
    this.drivers.delete(id);
  }

  const config = this.getConnection(id);
  if (!config) {
    throw new Error("Connection not found");
  }

  const driver = await this.createDriver(config);
  try {
    await driver.connect();
  } catch (error) {
    throw new Error(
      `Failed to connect to "${config.name}": ${error instanceof Error ? error.message : String(error)}`
    );
  }
  this.drivers.set(id, driver);
  return driver;
}
```

- [ ] **Step 4: Create activity bar icon**

`media/db-icon.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <ellipse cx="12" cy="5" rx="9" ry="3"/>
  <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
  <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
</svg>
```

- [ ] **Step 5: Add query timeout configuration**

Add to `package.json` contributes:
```json
"configuration": {
  "title": "Database Viewer",
  "properties": {
    "databaseViewer.queryTimeout": {
      "type": "number",
      "default": 30000,
      "description": "Query timeout in milliseconds"
    },
    "databaseViewer.defaultPageSize": {
      "type": "number",
      "default": 50,
      "description": "Default number of rows to display per page"
    }
  }
}
```

- [ ] **Step 6: Add import for DatabaseTreeItem in extension.ts**

```typescript
import { DatabaseTreeItem } from "./tree/treeNodes";
```

- [ ] **Step 7: Final build and verify**

Run:
```bash
npm run build
```

Expected: Both extension host and webview build without errors.

- [ ] **Step 8: Manual smoke test**

Run:
```bash
code --extensionDevelopmentPath=/Users/chenw/Projects/database-viewer
```

Verify:
1. Activity bar icon shows "Database Viewer"
2. "Add Connection..." appears in tree
3. Click it → connection form opens
4. Add a SQLite connection → appears in tree
5. Expand connection → tables listed
6. Double-click table → data grid loads
7. Edit cells → Apply saves
8. Open query console → Monaco editor works
9. Run a SELECT → results display

- [ ] **Step 9: Commit**

```bash
git add .
git commit -m "feat: add context menus, connection management commands, auto-reconnect, and configuration"
```
