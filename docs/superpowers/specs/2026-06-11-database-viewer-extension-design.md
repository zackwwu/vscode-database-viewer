# Database Viewer — VS Code Extension Design Spec

## Overview

A VS Code extension that connects to PostgreSQL and SQLite databases, provides a tree view for browsing schemas/tables, opens table data in editable grid webview panels, and includes a query console with Monaco editor for running complex SQL.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│ VS Code Extension                                                 │
├──────────────────────────┬───────────────────────────────────────┤
│ Extension Host (Node.js) │ Webview Panels (React + Vite)         │
│ - Connection Manager     │ - Table View (AG Grid, editable)      │
│ - Query Executor         │ - Query Console (Monaco + results)    │
│ - Schema Inspector       │ - Connection Form                     │
│ - Tree View Provider     │                                       │
│ - Webview Manager        │                                       │
├──────────────────────────┴───────────────────────────────────────┤
│ IPC: VS Code postMessage API (typed JSON messages)               │
├──────────────────────────────────────────────────────────────────┤
│ Storage: SecretStorage (passwords) + JSON config (metadata)      │
├──────────────────────────────────────────────────────────────────┤
│ Databases: PostgreSQL (pg) | SQLite (better-sqlite3)             │
└──────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
database-viewer/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── extension/
│   │   ├── extension.ts
│   │   ├── connections/
│   │   │   ├── connectionManager.ts
│   │   │   └── connectionConfig.ts
│   │   ├── database/
│   │   │   ├── drivers/
│   │   │   │   ├── postgres.ts
│   │   │   │   ├── sqlite.ts
│   │   │   │   └── types.ts
│   │   │   ├── queryExecutor.ts
│   │   │   └── schemaInspector.ts
│   │   ├── tree/
│   │   │   └── treeProvider.ts
│   │   └── webview/
│   │       └── webviewManager.ts
│   └── webview/
│       ├── index.html
│       ├── main.tsx
│       ├── App.tsx
│       ├── components/
│       │   ├── TableView/
│       │   │   ├── TableView.tsx
│       │   │   ├── FilterToolbar.tsx
│       │   │   └── BatchActions.tsx
│       │   └── QueryConsole/
│       │       ├── QueryConsole.tsx
│       │       └── ResultsGrid.tsx
│       ├── hooks/
│       │   └── useExtensionMessage.ts
│       └── types/
│           └── messages.ts
├── media/
└── test/
    ├── extension/
    └── webview/
```

## Database Driver Interface

```typescript
interface DatabaseDriver {
  connect(config: ConnectionConfig): Promise<void>;
  disconnect(): Promise<void>;
  execute(sql: string, params?: unknown[]): Promise<QueryResult>;
  getTables(): Promise<TableInfo[]>;
  getColumns(table: string): Promise<ColumnInfo[]>;
  getPrimaryKey(table: string): Promise<string[]>;
}

interface QueryResult {
  rows: Record<string, unknown>[];
  columns: ColumnMeta[];
  rowCount: number;
  affectedRows?: number;
}
```

- Both PostgreSQL and SQLite drivers implement this interface
- SQLite driver wraps synchronous `better-sqlite3` in async to match
- All user-facing queries are parameterized to prevent SQL injection

## Connection Management

### Storage

- Connection metadata (host, port, database, username, SSL config) stored in VS Code settings JSON
- Passwords stored in VS Code SecretStorage, keyed by connection ID
- Connections can be workspace-scoped or global

### Connection Config Schema

```typescript
interface ConnectionConfig {
  id: string;
  name: string;
  driver: "postgres" | "sqlite";
  // PostgreSQL
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
  // SQLite
  filePath?: string;
}
```

### Connection Form UI

- Form webview adapts fields based on selected driver
- PostgreSQL: host, port, database, username, password, SSL toggle with file pickers (CA cert, client cert, client key), reject unauthorized checkbox
- SQLite: file picker for .db file
- "Test Connection" button validates before saving

## Tree View

```
DATABASE VIEWER (Activity Bar)
├── production-db (PostgreSQL)
│   ├── public (schema)
│   │   ├── users
│   │   │   ├── id (int4, PK)
│   │   │   ├── name (varchar)
│   │   │   └── email (varchar)
│   │   └── orders
│   └── analytics
│       └── events
├── local-sqlite (SQLite)
│   ├── sessions
│   └── cache
└── + Add Connection...
```

- Lazy loading: schemas/tables/columns fetched on expand
- PostgreSQL shows schema grouping; SQLite is flat
- Connection state indicated by icon (green = connected, gray = disconnected)
- Connects on first expand, not at startup
- Refresh button in tree header to re-fetch schema
- Double-click table → opens Table View tab
- Right-click context menus: Open Table, Open Query Console, Copy Name, Edit, Delete, Disconnect

## Table View

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ Filter Toolbar                                                   │
│ [WHERE: ___________] [ORDER: ___________] [LIMIT: 50]          │
│ [ Apply Filters ]                    Showing 1-50 of [Load Count]│
├─────────────────────────────────────────────────────────────────┤
│ AG Grid (editable)                                               │
│ - Columns from table schema                                      │
│ - Inline cell editing                                            │
│ - Modified cells highlighted                                     │
├─────────────────────────────────────────────────────────────────┤
│ 3 rows modified                         [ Revert ] [ Apply ]    │
└─────────────────────────────────────────────────────────────────┘
```

### Behavior

- **Filtering**: WHERE clause is raw SQL authored by user (trusted — same as GoLand model)
- **Ordering**: ORDER BY clause input
- **Pagination**: LIMIT/OFFSET based. Page size configurable (default 50)
- **Total count**: Not fetched automatically. Clickable "[Load Count]" triggers `SELECT COUNT(*)`. Re-fetches when filters change if previously loaded.
- **Cell editing**: All columns editable, including primary keys
- **PK editing**: Allowed, but "Apply" shows confirmation dialog when PK changes are included. UPDATE uses original PK value in WHERE clause.
- **Cell editors by type**: text (varchar), number (int/float), checkbox (boolean), date picker (timestamp/date)
- **NULL handling**: Displayed as italic gray "NULL". Right-click → "Set NULL" / "Clear NULL"
- **Binary/blob columns**: Displayed as "(binary, 1.2KB)", not editable inline
- **Tables without primary key**: Open as read-only with banner warning

### Batch Save

- Edits accumulate as dirty state (highlighted cells)
- "Apply" commits all changes in a single transaction
- "Revert" discards all pending changes
- On partial failure: full transaction rollback, error messages per failing row, dirty state preserved
- Parameterized UPDATE statements generated from dirty cells

## Query Console

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ Connection: [dropdown]                   [ Run ] [ Run Selection]│
├─────────────────────────────────────────────────────────────────┤
│ Monaco Editor (SQL mode, theme-matched)                          │
├─────────────────────────────────────────────────────────────────┤
│ Results [Tab 1][Tab 2]                          12 rows, 45ms   │
│ AG Grid (read-only)                                              │
└─────────────────────────────────────────────────────────────────┘
```

### Behavior

- Monaco editor with SQL syntax highlighting
- Run executes full editor content; Run Selection executes highlighted text only (disabled when no selection)
- Multi-statement queries produce multiple result tabs
- Results displayed in read-only AG Grid
- Connection picker dropdown to choose target database
- Execution time + row count displayed
- Resizable split between editor and results
- Cancel button for long-running queries (pg_cancel_backend for Postgres)

## IPC Message Protocol

```typescript
// Webview → Extension
type WebviewMessage =
  | { type: "fetch-table-data"; requestId: string; table: string; where?: string; orderBy?: string; limit: number; offset: number }
  | { type: "update-rows"; requestId: string; table: string; changes: RowChange[] }
  | { type: "execute-query"; requestId: string; sql: string; connectionId: string }
  | { type: "get-schema"; requestId: string; connectionId: string }
  | { type: "cancel-query"; queryId: string }
  | { type: "count-rows"; requestId: string; table: string; where?: string }

// Extension → Webview
type ExtensionMessage =
  | { type: "table-data"; requestId: string; rows: Row[]; columns: ColumnMeta[]; totalCount?: number }
  | { type: "query-results"; requestId: string; results: QueryResult[] }
  | { type: "update-success"; requestId: string; updatedCount: number }
  | { type: "update-error"; requestId: string; errors: { rowKey: Record<string, unknown>; message: string }[] }
  | { type: "schema-info"; requestId: string; tables: TableInfo[] }
  | { type: "row-count"; requestId: string; count: number }
  | { type: "error"; requestId: string; message: string }
  | { type: "loading"; requestId: string; loading: boolean }
```

- All requests carry a `requestId` for correlation
- Partial update errors report per-row failure details
- Loading state sent explicitly for spinner control

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Connection timeout | Notification with "Retry" button, tree node error state |
| Auth failure | Prompt to re-enter password |
| SSL handshake failure | Notification with CA file path guidance |
| Query syntax error | Error message in results pane (with line number if available) |
| Query timeout | Configurable timeout (default 30s), cancel button |
| Connection lost mid-query | Notification + auto-reconnect on next action |
| Constraint violation on update | Full transaction rollback, per-row error, dirty state preserved |
| Row deleted externally | "Row not found" error, full rollback |
| Table without PK | Read-only mode, banner warning |
| Binary columns | Display size, non-editable |

## Build & Packaging

```
npm run dev    → tsc --watch (extension) + vite dev (webview HMR)
npm run build  → esbuild (extension) + vite build (webview)
npm run package → vsce package --target <platform>
npm run test   → vitest (all layers)
```

- Extension host compiled with esbuild (single bundle)
- Webview bundled with Vite (React + AG Grid + Monaco)
- Platform-specific builds needed for `better-sqlite3` native addon
- Use `vsce` with `--target` for platform-specific .vsix (linux-x64, darwin-arm64, win32-x64)

## Testing Strategy

| Layer | Tool | Coverage |
|-------|------|----------|
| DB drivers | Vitest + testcontainers (PG) + temp SQLite | Query building, parameterization, schema introspection |
| Extension host | Vitest + mocked VS Code API | Connection manager, message routing, tree provider |
| Webview | Vitest + React Testing Library | Grid rendering, filters, dirty state |
| E2E | VS Code Extension Test runner | Full flow: connect → open → edit → save |

## Extension Manifest

Key contributions in package.json:

- Activity bar view container: "Database Viewer"
- Tree view: "databaseViewer.connections"
- Commands: Add Connection, New Query Console, Refresh
- Activation: `onView:databaseViewer.connections`

## Out of Scope (for v1)

- Database other than PostgreSQL and SQLite
- Schema migration tools
- Table creation/alteration DDL UI
- Auto-complete in query console (beyond basic SQL keywords)
- SSH tunneling
- Import/export (CSV, JSON)
- Stored procedure management
