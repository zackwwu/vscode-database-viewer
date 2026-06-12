import React, { useState } from "react";
import { useExtensionMessage } from "../../hooks/useExtensionMessage";
import { ConnectionConfig } from "../../../shared/types";

interface ConnectionFormProps {
  existingConfig?: ConnectionConfig;
}

export function ConnectionForm({ existingConfig }: ConnectionFormProps) {
  const [driver, setDriver] = useState<"postgres" | "sqlite">(existingConfig?.driver || "postgres");
  const [name, setName] = useState(existingConfig?.name || "");
  const [host, setHost] = useState(existingConfig?.host || "localhost");
  const [port, setPort] = useState(existingConfig?.port || 5432);
  const [database, setDatabase] = useState(existingConfig?.database || "");
  const [username, setUsername] = useState(existingConfig?.username || "");
  const [password, setPassword] = useState("");
  const [filePath, setFilePath] = useState(existingConfig?.filePath || "");
  const [sslEnabled, setSslEnabled] = useState(existingConfig?.ssl?.enabled || false);
  const [caFile, setCaFile] = useState(existingConfig?.ssl?.caFile || "");
  const [clientCertFile, setClientCertFile] = useState(existingConfig?.ssl?.clientCertFile || "");
  const [clientKeyFile, setClientKeyFile] = useState(existingConfig?.ssl?.clientKeyFile || "");
  const [rejectUnauthorized, setRejectUnauthorized] = useState(existingConfig?.ssl?.rejectUnauthorized ?? true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { sendRequest } = useExtensionMessage();

  const pickFile = (title: string, filterName?: string, filterExtensions?: string[]) => {
    return new Promise<string | null>((resolve) => {
      sendRequest(
        { type: "pick-file", title, filterName, filterExtensions } as any,
        (msg: any) => {
          resolve(msg.type === "file-picked" ? msg.path : null);
        }
      );
    });
  };

  const buildConfig = (): ConnectionConfig => {
    const config: any = {
      id: existingConfig?.id || crypto.randomUUID(),
      name,
      driver,
    };
    if (driver === "postgres") {
      config.host = host;
      config.port = port;
      config.database = database;
      config.username = username;
      if (sslEnabled) {
        config.ssl = {
          enabled: true,
          caFile: caFile || undefined,
          clientCertFile: clientCertFile || undefined,
          clientKeyFile: clientKeyFile || undefined,
          rejectUnauthorized,
        };
      }
    } else {
      config.filePath = filePath;
    }
    return config;
  };

  const handleTest = () => {
    setTesting(true);
    setTestResult(null);
    sendRequest(
      { type: "test-connection", config: buildConfig() } as any,
      (msg: any) => {
        if (msg.type === "connection-test-result") {
          setTestResult({ success: msg.success, error: msg.error });
          setTesting(false);
        } else if (msg.type === "error") {
          setTestResult({ success: false, error: msg.message });
          setTesting(false);
        }
      }
    );
  };

  const handleSave = () => {
    setSaving(true);
    setSaveError(null);
    sendRequest(
      {
        type: "save-connection",
        config: buildConfig(),
        password: driver === "postgres" ? password : undefined,
      } as any,
      (msg: any) => {
        if (msg.type === "connection-saved") {
          setSaving(false);
        } else if (msg.type === "error") {
          setSaveError(msg.message);
          setSaving(false);
        }
      }
    );
  };

  return (
    <div className="connection-form">
      <h2>{existingConfig ? "Edit Connection" : "New Connection"}</h2>

      <div className="form-group">
        <label>Driver</label>
        <select value={driver} onChange={(e) => setDriver(e.target.value as "postgres" | "sqlite")}>
          <option value="postgres">PostgreSQL</option>
          <option value="sqlite">SQLite</option>
        </select>
      </div>

      <div className="form-group">
        <label>Connection Name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="My Database" />
      </div>

      {driver === "postgres" && (
        <>
          <div className="form-row">
            <div className="form-group">
              <label>Host</label>
              <input type="text" value={host} onChange={(e) => setHost(e.target.value)} />
            </div>
            <div className="form-group form-group-small">
              <label>Port</label>
              <input type="number" value={port} onChange={(e) => setPort(parseInt(e.target.value) || 5432)} />
            </div>
          </div>
          <div className="form-group">
            <label>Database</label>
            <input type="text" value={database} onChange={(e) => setDatabase(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Username</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={existingConfig ? "(unchanged)" : ""}
            />
          </div>
          <div className="form-group">
            <label className="checkbox-label">
              <input type="checkbox" checked={sslEnabled} onChange={(e) => setSslEnabled(e.target.checked)} />
              Enable SSL
            </label>
          </div>
          {sslEnabled && (
            <div className="ssl-fields">
              <div className="form-group">
                <label>CA File</label>
                <div className="file-input-row">
                  <input type="text" value={caFile} onChange={(e) => setCaFile(e.target.value)} placeholder="/path/to/ca.pem" />
                  <button type="button" className="browse-button" onClick={async () => {
                    const path = await pickFile("Select CA Certificate", "PEM", ["pem", "crt", "cer"]);
                    if (path) setCaFile(path);
                  }}>Browse...</button>
                </div>
              </div>
              <div className="form-group">
                <label>Client Certificate</label>
                <div className="file-input-row">
                  <input type="text" value={clientCertFile} onChange={(e) => setClientCertFile(e.target.value)} placeholder="/path/to/client-cert.pem" />
                  <button type="button" className="browse-button" onClick={async () => {
                    const path = await pickFile("Select Client Certificate", "PEM", ["pem", "crt", "cer"]);
                    if (path) setClientCertFile(path);
                  }}>Browse...</button>
                </div>
              </div>
              <div className="form-group">
                <label>Client Key</label>
                <div className="file-input-row">
                  <input type="text" value={clientKeyFile} onChange={(e) => setClientKeyFile(e.target.value)} placeholder="/path/to/client-key.pem" />
                  <button type="button" className="browse-button" onClick={async () => {
                    const path = await pickFile("Select Client Key", "PEM", ["pem", "key"]);
                    if (path) setClientKeyFile(path);
                  }}>Browse...</button>
                </div>
              </div>
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={rejectUnauthorized}
                    onChange={(e) => setRejectUnauthorized(e.target.checked)}
                  />
                  Reject Unauthorized
                </label>
              </div>
            </div>
          )}
        </>
      )}

      {driver === "sqlite" && (
        <div className="form-group">
          <label>Database File</label>
          <div className="file-input-row">
            <input
              type="text"
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
              placeholder="/path/to/database.db"
            />
            <button
              type="button"
              className="browse-button"
              onClick={async () => {
                const path = await pickFile("Select SQLite Database", "SQLite", ["db", "sqlite", "sqlite3"]);
                if (path) setFilePath(path);
              }}
            >
              Browse...
            </button>
          </div>
        </div>
      )}

      {testResult && (
        <div className={`test-result ${testResult.success ? "success" : "error"}`}>
          {testResult.success ? "Connection successful!" : `Connection failed: ${testResult.error}`}
        </div>
      )}

      {saveError && <div className="test-result error">{saveError}</div>}

      <div className="form-actions">
        <button onClick={handleTest} disabled={testing || saving}>
          {testing ? "Testing..." : "Test Connection"}
        </button>
        <button onClick={handleSave} disabled={testing || saving} className="apply-button">
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
