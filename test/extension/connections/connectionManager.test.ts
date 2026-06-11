import { describe, it, expect, beforeEach, vi } from "vitest";
import { ConnectionManager } from "../../../src/extension/connections/connectionManager";
import { ConnectionConfig } from "../../../src/shared/types";

// Mock vscode module
vi.mock("vscode", () => ({
  EventEmitter: class {
    private listeners: Array<() => void> = [];

    fire() {
      this.listeners.forEach((l) => l());
    }

    event = vi.fn((listener: () => void) => {
      this.listeners.push(listener);
      return () => {
        this.listeners = this.listeners.filter((l) => l !== listener);
      };
    });
  },
}));

function createMockContext() {
  const secrets = new Map<string, string>();
  let configConnections: ConnectionConfig[] = [];

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
      get: vi.fn((key: string) => {
        // Return a fresh copy of the current connections array
        return Array.from(configConnections);
      }),
      update: vi.fn((key: string, value: unknown) => {
        if (Array.isArray(value)) {
          configConnections = Array.from(value);
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
    it("throws for unknown connection ID", async () => {
      await expect(manager.getDriver("nonexistent")).rejects.toThrow("Connection not found");
    });
  });
});
