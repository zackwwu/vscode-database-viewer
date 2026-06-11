import { describe, it, expect, beforeEach, vi, Mocked } from "vitest";
import { DatabaseTreeProvider } from "../../../src/extension/tree/treeProvider";
import { DatabaseTreeItem } from "../../../src/extension/tree/treeNodes";

// Mock only the parts we need
vi.mock("vscode", () => {
  const EventEmitter = class {
    private listeners: Function[] = [];
    event = (listener: Function) => {
      this.listeners.push(listener);
      return { dispose: () => {} };
    };
    fire = (data: any) => {
      this.listeners.forEach(listener => listener(data));
    };
    dispose = () => {};
  };

  return {
    TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
    EventEmitter,
    ThemeIcon: class {
      constructor(public id: string) {}
    },
    window: {
      createTreeView: vi.fn(() => ({ dispose: vi.fn() })),
    },
    commands: {
      registerCommand: vi.fn(),
    },
  };
});

function createMockConnectionManager() {
  const onDidChangeConnections = vi.fn();
  return {
    getConnections: vi.fn().mockReturnValue([]),
    getDriver: vi.fn(),
    isConnected: vi.fn().mockReturnValue(false),
    onDidChangeConnections,
  };
}

describe("DatabaseTreeProvider", () => {
  let provider: DatabaseTreeProvider;
  let mockManager: ReturnType<typeof createMockConnectionManager>;

  beforeEach(() => {
    mockManager = createMockConnectionManager();
    provider = new DatabaseTreeProvider(mockManager as any);
  });

  describe("getChildren (root)", () => {
    it("returns add-connection node when no connections", async () => {
      const children = await provider.getChildren();
      expect(children).toHaveLength(1);
      expect(children[0].nodeType).toBe("addConnection");
    });

    it("returns connection nodes plus add-connection", async () => {
      mockManager.getConnections.mockReturnValue([
        { id: "pg1", name: "production-db", driver: "postgres" },
        { id: "sq1", name: "local-sqlite", driver: "sqlite" },
      ]);

      const children = await provider.getChildren();
      expect(children).toHaveLength(3);
      expect(children[0].nodeType).toBe("connection");
      expect(children[0].label).toBe("production-db");
      expect(children[1].nodeType).toBe("connection");
      expect(children[1].label).toBe("local-sqlite");
      expect(children[2].nodeType).toBe("addConnection");
    });
  });

  describe("getChildren (connection with schemas)", () => {
    it("returns schema nodes for postgres", async () => {
      const mockDriver = {
        getTables: vi.fn().mockResolvedValue([
          { name: "users", schema: "public" },
          { name: "orders", schema: "public" },
          { name: "events", schema: "analytics" },
        ]),
      };
      mockManager.getDriver.mockResolvedValue(mockDriver);

      const connectionNode: DatabaseTreeItem = {
        label: "pg",
        nodeType: "connection",
        connectionId: "pg1",
        collapsibleState: 1,
      } as any;

      const children = await provider.getChildren(connectionNode);
      expect(children).toHaveLength(2);
      expect(children.map((c) => c.label)).toContain("public");
      expect(children.map((c) => c.label)).toContain("analytics");
    });
  });

  describe("getChildren (connection without schemas — SQLite)", () => {
    it("returns table nodes directly", async () => {
      const mockDriver = {
        getTables: vi.fn().mockResolvedValue([
          { name: "users", schema: undefined },
          { name: "sessions", schema: undefined },
        ]),
      };
      mockManager.getDriver.mockResolvedValue(mockDriver);

      const connectionNode: DatabaseTreeItem = {
        label: "sqlite",
        nodeType: "connection",
        connectionId: "sq1",
        collapsibleState: 1,
      } as any;

      const children = await provider.getChildren(connectionNode);
      expect(children).toHaveLength(2);
      expect(children[0].nodeType).toBe("table");
      expect(children[0].label).toBe("users");
      expect(children[1].label).toBe("sessions");
    });
  });

  describe("getChildren (schema)", () => {
    it("returns tables for schema", async () => {
      const mockDriver = {
        getTables: vi.fn().mockResolvedValue([
          { name: "users", schema: "public" },
          { name: "orders", schema: "public" },
          { name: "events", schema: "analytics" },
        ]),
      };
      mockManager.getDriver.mockResolvedValue(mockDriver);

      const schemaNode: DatabaseTreeItem = {
        label: "public",
        nodeType: "schema",
        connectionId: "pg1",
        schema: "public",
        collapsibleState: 1,
      } as any;

      const children = await provider.getChildren(schemaNode);
      expect(children).toHaveLength(2);
      expect(children[0].label).toBe("users");
      expect(children[0].nodeType).toBe("table");
      expect(children[1].label).toBe("orders");
      expect(children[1].nodeType).toBe("table");
    });
  });

  describe("getChildren (table)", () => {
    it("returns column nodes", async () => {
      const mockDriver = {
        getColumns: vi.fn().mockResolvedValue([
          { name: "id", dataType: "int4", isPrimaryKey: true, nullable: false },
          { name: "name", dataType: "varchar", isPrimaryKey: false, nullable: false },
          { name: "email", dataType: "varchar", isPrimaryKey: false, nullable: true },
        ]),
      };
      mockManager.getDriver.mockResolvedValue(mockDriver);

      const tableNode: DatabaseTreeItem = {
        label: "users",
        nodeType: "table",
        connectionId: "pg1",
        schema: "public",
        tableName: "users",
        collapsibleState: 1,
      } as any;

      const children = await provider.getChildren(tableNode);
      expect(children).toHaveLength(3);
      expect(children[0].label).toBe("id (PK)");
      expect(children[0].description).toBe("int4");
      expect(children[1].label).toBe("name");
      expect(children[1].description).toBe("varchar");
      expect(children[2].label).toBe("email");
    });
  });

  describe("getChildren (error handling)", () => {
    it("returns empty array on driver error", async () => {
      mockManager.getDriver.mockRejectedValue(new Error("Connection failed"));

      const connectionNode: DatabaseTreeItem = {
        label: "broken",
        nodeType: "connection",
        connectionId: "bad1",
        collapsibleState: 1,
      } as any;

      const children = await provider.getChildren(connectionNode);
      expect(children).toHaveLength(0);
    });
  });

  describe("getTreeItem", () => {
    it("returns the element itself", () => {
      const item: DatabaseTreeItem = {
        label: "test",
        nodeType: "table",
        connectionId: "test1",
        collapsibleState: 0,
      } as any;

      const result = provider.getTreeItem(item);
      expect(result).toBe(item);
    });
  });
});
