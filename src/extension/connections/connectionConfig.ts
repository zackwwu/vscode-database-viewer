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
