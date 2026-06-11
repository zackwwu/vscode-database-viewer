import React, { useCallback, useEffect, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { ColDef, CellValueChangedEvent } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { FilterToolbar } from "./FilterToolbar";
import { BatchActions } from "./BatchActions";
import { useExtensionMessage } from "../../hooks/useExtensionMessage";
import { ColumnMeta, RowChange } from "../../../shared/types";

interface TableViewProps {
  table: string;
  schema?: string;
  connectionId: string;
}

interface DirtyCell {
  originalValue: unknown;
  currentValue: unknown;
}

type DirtyState = Map<string, Map<string, DirtyCell>>;

export function TableView({ connectionId, schema, table }: TableViewProps) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [columns, setColumns] = useState<ColumnMeta[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(50);
  const [dirtyState, setDirtyState] = useState<DirtyState>(new Map());
  const [updateErrors, setUpdateErrors] = useState<{ rowKey: Record<string, unknown>; message: string }[]>([]);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const gridRef = useRef<AgGridReact>(null);
  const { sendRequest } = useExtensionMessage();
  const originalRowsRef = useRef<Map<string, Record<string, unknown>>>(new Map());

  const primaryKeys = columns.filter((c) => c.isPrimaryKey).map((c) => c.name);
  const hasPkChanges = Array.from(dirtyState.values()).some((cellMap) =>
    Array.from(cellMap.keys()).some((field) => primaryKeys.includes(field))
  );

  const getRowKey = (row: Record<string, unknown>): string => {
    if (primaryKeys.length === 0) return JSON.stringify(row);
    const key: Record<string, unknown> = {};
    for (const pk of primaryKeys) {
      key[pk] = row[pk];
    }
    return JSON.stringify(key);
  };

  const colDefs: ColDef[] = columns.map((col) => ({
    field: col.name,
    headerName: col.isPrimaryKey ? `${col.name} 🔑` : col.name,
    headerTooltip: `${col.dataType}${col.isPrimaryKey ? " (PK)" : ""}`,
    sortable: true,
    filter: true,
    editable: !isReadOnly,
    cellStyle: (params: any) => {
      const rowKey = getRowKey(params.data);
      const cellDirty = dirtyState.get(rowKey)?.get(col.name);
      if (cellDirty) {
        return { backgroundColor: "rgba(255, 200, 0, 0.2)" };
      }
      return undefined;
    },
  }));

  const fetchData = useCallback(
    (where?: string, orderBy?: string, actualLimit?: number, actualOffset?: number) => {
      setLoading(true);
      setError(null);
      const finalLimit = actualLimit ?? limit;
      const finalOffset = actualOffset ?? offset;

      sendRequest(
        {
          type: "fetch-table-data",
          table,
          schema,
          where: where || undefined,
          orderBy: orderBy || undefined,
          limit: finalLimit,
          offset: finalOffset,
        },
        (msg: any) => {
          if (msg.type === "table-data") {
            setRows(msg.rows);
            setColumns(msg.columns);
            setIsReadOnly(msg.columns.filter((c: ColumnMeta) => c.isPrimaryKey).length === 0);
            setLoading(false);
            originalRowsRef.current = new Map();
            for (const row of msg.rows) {
              const key = getRowKey(row);
              originalRowsRef.current.set(key, { ...row });
            }
          } else if (msg.type === "error") {
            setError(msg.message);
            setLoading(false);
          } else if (msg.type === "loading") {
            setLoading(msg.loading);
          }
        }
      );
    },
    [table, schema, limit, offset, sendRequest]
  );

  useEffect(() => {
    fetchData();
  }, []);

  const handleApplyFilters = (where: string, orderBy: string, newLimit: number, newOffset: number) => {
    setLimit(newLimit);
    setOffset(newOffset);
    setTotalCount(null);
    setDirtyState(new Map());
    setUpdateErrors([]);
    fetchData(where, orderBy, newLimit, newOffset);
  };

  const loadCount = () => {
    sendRequest(
      { type: "count-rows", table, schema },
      (response: any) => {
        if (response.type === "row-count") {
          setTotalCount(response.count);
        }
      }
    );
  };

  const handleCellValueChanged = useCallback((event: CellValueChangedEvent) => {
    const rowKey = getRowKey(event.data);
    const field = event.colDef.field!;
    const newValue = event.newValue;

    setDirtyState((prev) => {
      const next = new Map(prev);
      const cellMap = new Map(next.get(rowKey) || new Map());

      const original = originalRowsRef.current.get(rowKey);
      const originalValue = original ? original[field] : event.oldValue;

      if (newValue === originalValue) {
        cellMap.delete(field);
        if (cellMap.size === 0) {
          next.delete(rowKey);
        } else {
          next.set(rowKey, cellMap);
        }
      } else {
        cellMap.set(field, { originalValue, currentValue: newValue });
        next.set(rowKey, cellMap);
      }
      return next;
    });
  }, []);

  const handleRevert = useCallback(() => {
    setDirtyState(new Map());
    setUpdateErrors([]);
    // Restore original values
    const restoredRows = rows.map((row) => {
      const key = getRowKey(row);
      const original = originalRowsRef.current.get(key);
      return original ? { ...original } : row;
    });
    setRows(restoredRows);
    gridRef.current?.api?.refreshCells({ force: true });
  }, [rows]);

  const handleApply = useCallback(() => {
    if (dirtyState.size === 0) return;

    if (hasPkChanges) {
      const confirmed = window.confirm(
        "You are modifying primary key values. This may affect row identity. Continue?"
      );
      if (!confirmed) return;
    }

    const changes: RowChange[] = [];
    for (const [rowKeyStr, cellMap] of dirtyState) {
      const pkValues = JSON.parse(rowKeyStr);
      const updates: Record<string, unknown> = {};
      for (const [field, cell] of cellMap) {
        updates[field] = cell.currentValue;
      }
      changes.push({ primaryKey: pkValues, updates });
    }

    setLoading(true);
    setUpdateErrors([]);
    sendRequest(
      { type: "update-rows", table, schema, changes },
      (msg: any) => {
        if (msg.type === "update-success") {
          setDirtyState(new Map());
          setLoading(false);
          fetchData();
        } else if (msg.type === "update-error") {
          setUpdateErrors(msg.errors);
          setLoading(false);
        } else if (msg.type === "error") {
          setUpdateErrors([{ rowKey: {}, message: msg.message }]);
          setLoading(false);
        } else if (msg.type === "loading") {
          setLoading(msg.loading);
        }
      }
    );
  }, [dirtyState, hasPkChanges, table, schema, sendRequest, fetchData]);

  return (
    <div className="table-view">
      <div className="table-header">
        <h3>{schema ? `${schema}.${table}` : table}</h3>
        {isReadOnly && (
          <span className="read-only-badge">Read-only (no primary key)</span>
        )}
      </div>
      <FilterToolbar
        onApplyFilters={handleApplyFilters}
        onLoadCount={loadCount}
        totalCount={totalCount}
        currentOffset={offset}
        currentLimit={limit}
        loading={loading}
      />
      {error && <div className="error-banner">{error}</div>}
      <div className="ag-theme-alpine grid-container">
        <AgGridReact
          ref={gridRef}
          rowData={rows}
          columnDefs={colDefs}
          defaultColDef={{ resizable: true, minWidth: 100 }}
          animateRows={false}
          loading={loading}
          onCellValueChanged={handleCellValueChanged}
          getRowId={(params) => getRowKey(params.data)}
          stopEditingWhenCellsLoseFocus={true}
        />
      </div>
      <BatchActions
        modifiedCount={dirtyState.size}
        hasPkChanges={hasPkChanges}
        onApply={handleApply}
        onRevert={handleRevert}
        loading={loading}
        errors={updateErrors}
      />
    </div>
  );
}
