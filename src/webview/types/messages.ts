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
}

export type InitMessage = TableInitMessage | QueryInitMessage;
