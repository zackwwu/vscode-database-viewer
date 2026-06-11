import React, { useCallback, useEffect, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { ColDef } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { FilterToolbar } from "./FilterToolbar";
import { useExtensionMessage } from "../../hooks/useExtensionMessage";
import { ColumnMeta } from "../../../shared/types";

interface TableViewProps {
  table: string;
  schema?: string;
  connectionId: string;
}

export function TableView({ table, schema, connectionId }: TableViewProps) {
  const { sendRequest } = useExtensionMessage();
  const gridRef = useRef<AgGridReact>(null);

  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [columns, setColumns] = useState<ColumnMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(50);

  const colDefs: ColDef[] = columns.map((col) => ({
    field: col.name,
    headerName: col.isPrimaryKey ? `${col.name} 🔑` : col.name,
    headerTooltip: `${col.dataType}${col.isPrimaryKey ? " (PK)" : ""}`,
    sortable: true,
    filter: true,
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
        (response) => {
          if (response.type === "table-data") {
            setRows(response.rows);
            if (response.columns) setColumns(response.columns);
          } else if (response.type === "error") {
            setError(response.message);
          }
          setLoading(false);
        }
      );
    },
    [sendRequest, table, schema, limit, offset]
  );

  useEffect(() => {
    fetchData();
  }, []);

  const handleApplyFilters = (where: string, orderBy: string, newLimit: number, newOffset: number) => {
    setLimit(newLimit);
    setOffset(newOffset);
    setTotalCount(null);
    fetchData(where, orderBy, newLimit, newOffset);
  };

  const loadCount = () => {
    sendRequest(
      {
        type: "count-rows",
        table,
        schema,
      },
      (response) => {
        if (response.type === "row-count") {
          setTotalCount(response.count);
        }
      }
    );
  };

  return (
    <div className="table-view">
      <div className="table-header">
        <h3>{schema ? `${schema}.${table}` : table}</h3>
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
          getRowId={(params) => JSON.stringify(params.data)}
        />
      </div>
    </div>
  );
}
