import { ConnectionConfig } from "../../shared/types";

export interface TableInitMessage {
  type: "init";
  panelType: "table";
  connectionId: string;
  schema?: string;
  table: string;
}

export interface QueryInitMessage {
  type: "init";
  panelType: "query";
  connectionId: string;
  connections: { id: string; name: string; driver: string }[];
}

export interface ConnectionFormInitMessage {
  type: "init";
  panelType: "connection-form";
  existingConfig?: ConnectionConfig;
}

export type InitMessage = TableInitMessage | QueryInitMessage | ConnectionFormInitMessage;
