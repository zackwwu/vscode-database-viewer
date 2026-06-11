import React, { useEffect, useState } from "react";
import { TableView } from "./components/TableView/TableView";
import { QueryConsole } from "./components/QueryConsole/QueryConsole";
import { InitMessage } from "./types/messages";

export default function App() {
  const [initData, setInitData] = useState<InitMessage | null>(null);

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === "init") {
        setInitData(msg as InitMessage);
      }
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, []);

  if (!initData) {
    return <div className="loading">Initializing...</div>;
  }

  if (initData.panelType === "table") {
    return (
      <TableView
        table={initData.table}
        schema={initData.schema}
        connectionId={initData.connectionId}
      />
    );
  }

  if (initData.panelType === "query") {
    return (
      <QueryConsole
        connectionId={initData.connectionId}
        connections={initData.connections}
      />
    );
  }

  return <div className="loading">Unknown panel type</div>;
}
