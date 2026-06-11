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
