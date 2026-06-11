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

export type InitMessage = TableInitMessage | QueryInitMessage;
