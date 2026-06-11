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
    const requestId = `test-${Date.now()}`;
    sendRequest(
      { type: "test-connection", requestId, config: buildConfig() },
      (msg: any) => {
        if (msg.type === "connection-test-result" && msg.requestId === requestId) {
          setTestResult({ success: msg.success, error: msg.error });
          setTesting(false);
        } else if (msg.type === "error" && msg.requestId === requestId) {
          setTestResult({ success: false, error: msg.message });
          setTesting(false);
        }
      }
    );
  };

  const handleSave = () => {
    setSaving(true);
    setSaveError(null);
    const requestId = `save-${Date.now()}`;
    sendRequest(
      {
        type: "save-connection",
        requestId,
        config: buildConfig(),
        password: driver === "postgres" ? password : undefined,
      },
      (msg: any) => {
        if (msg.type === "connection-saved" && msg.requestId === requestId) {
          setSaving(false);
          // Optionally close the panel or show success
        } else if (msg.type === "error" && msg.requestId === requestId) {
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
                <input type="text" value={caFile} onChange={(e) => setCaFile(e.target.value)} placeholder="/path/to/ca.pem" />
              </div>
              <div className="form-group">
                <label>Client Certificate</label>
                <input
                  type="text"
                  value={clientCertFile}
                  onChange={(e) => setClientCertFile(e.target.value)}
                  placeholder="/path/to/client-cert.pem"
                />
              </div>
              <div className="form-group">
                <label>Client Key</label>
                <input
                  type="text"
                  value={clientKeyFile}
                  onChange={(e) => setClientKeyFile(e.target.value)}
                  placeholder="/path/to/client-key.pem"
                />
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
          <input
            type="text"
            value={filePath}
            onChange={(e) => setFilePath(e.target.value)}
            placeholder="/path/to/database.db"
          />
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
