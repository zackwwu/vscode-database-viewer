import React from "react";
import { TableView } from "./components/TableView/TableView";
import { QueryConsole } from "./components/QueryConsole/QueryConsole";
import { ConnectionForm } from "./components/ConnectionForm/ConnectionForm";
import { InitMessage } from "./types/messages";

function getInitData(): InitMessage {
  const root = document.getElementById("root")!;
  const panelType = root.dataset.panelType as InitMessage["panelType"];
  const context = JSON.parse(root.dataset.context || "{}");
  return { type: "init", panelType, ...context } as InitMessage;
}

export default function App() {
  const initData = getInitData();

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

  if (initData.panelType === "connection-form") {
    return <ConnectionForm existingConfig={initData.existingConfig} />;
  }

  return <div className="loading">Unknown panel type</div>;
}
