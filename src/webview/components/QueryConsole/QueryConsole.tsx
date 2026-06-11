import React, { useCallback, useRef, useState } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import { editor } from "monaco-editor";
import { useExtensionMessage } from "../../hooks/useExtensionMessage";
import { QueryResult } from "../../../shared/types";
import { ResultsGrid } from "./ResultsGrid";

interface QueryConsoleProps {
  connectionId: string;
  connections: { id: string; name: string; driver: string }[];
}

export function QueryConsole({ connectionId, connections }: QueryConsoleProps) {
  const [activeConnectionId, setActiveConnectionId] = useState(connectionId);
  const [results, setResults] = useState<QueryResult[]>([]);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const { sendRequest } = useExtensionMessage();

  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor;
  };

  const getFullText = (): string => {
    return editorRef.current?.getValue() || "";
  };

  const getSelectedText = (): string => {
    const editor = editorRef.current;
    if (!editor) return "";
    const selection = editor.getSelection();
    if (!selection || selection.isEmpty()) return "";
    return editor.getModel()?.getValueInRange(selection) || "";
  };

  const executeQuery = useCallback(
    (sql: string) => {
      if (!sql.trim()) return;
      setLoading(true);
      setError(null);
      setResults([]);
      setExecutionTime(null);

      sendRequest(
        { type: "execute-query", sql, connectionId: activeConnectionId },
        (msg: any) => {
          if (msg.type === "query-results") {
            setResults(msg.results);
            setExecutionTime(msg.executionTimeMs);
            setLoading(false);
          } else if (msg.type === "error") {
            setError(msg.message);
            setLoading(false);
          } else if (msg.type === "loading") {
            setLoading(msg.loading);
          }
        }
      );
    },
    [activeConnectionId, sendRequest]
  );

  const handleRun = () => {
    executeQuery(getFullText());
  };

  const handleRunSelection = () => {
    const selected = getSelectedText();
    if (selected) {
      executeQuery(selected);
    }
  };

  return (
    <div className="query-console">
      <div className="query-toolbar">
        <label>
          Connection:
          <select
            value={activeConnectionId}
            onChange={(e) => setActiveConnectionId(e.target.value)}
            disabled={loading}
          >
            {connections.map((conn) => (
              <option key={conn.id} value={conn.id}>
                {conn.name} ({conn.driver})
              </option>
            ))}
          </select>
        </label>
        <div className="query-buttons">
          <button onClick={handleRun} disabled={loading}>
            Run ▶
          </button>
          <button onClick={handleRunSelection} disabled={loading}>
            Run Selection
          </button>
        </div>
      </div>
      <div className="query-editor">
        <Editor
          height="40%"
          defaultLanguage="sql"
          defaultValue={"-- Write your SQL here\n"}
          theme="vs-dark"
          onMount={handleEditorMount}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            wordWrap: "on",
            automaticLayout: true,
          }}
        />
      </div>
      <div className="query-results">
        {error && <div className="error-banner">{error}</div>}
        {executionTime !== null && (
          <div className="execution-info">
            {results.reduce((sum, r) => sum + r.rowCount, 0)} row(s) returned in {executionTime}ms
          </div>
        )}
        {loading && <div className="loading">Executing query...</div>}
        {results.length > 0 && <ResultsGrid results={results} />}
      </div>
    </div>
  );
}
