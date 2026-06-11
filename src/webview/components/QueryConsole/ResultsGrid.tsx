import React, { useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { ColDef } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { QueryResult } from "../../../shared/types";

interface ResultsGridProps {
  results: QueryResult[];
}

export function ResultsGrid({ results }: ResultsGridProps) {
  const [activeTab, setActiveTab] = useState(0);

  if (results.length === 0) return null;

  const activeResult = results[activeTab] || results[0];

  const colDefs: ColDef[] = activeResult.columns.map((col) => ({
    field: col.name,
    headerName: col.name,
    headerTooltip: col.dataType,
    sortable: true,
    filter: true,
    resizable: true,
  }));

  return (
    <div className="results-grid">
      {results.length > 1 && (
        <div className="results-tabs">
          {results.map((_, idx) => (
            <button
              key={idx}
              className={`results-tab ${idx === activeTab ? "active" : ""}`}
              onClick={() => setActiveTab(idx)}
            >
              Statement {idx + 1}
              <span className="tab-count">({results[idx].rowCount} rows)</span>
            </button>
          ))}
        </div>
      )}
      {activeResult.rows.length > 0 ? (
        <div className="ag-theme-alpine results-grid-container">
          <AgGridReact
            rowData={activeResult.rows}
            columnDefs={colDefs}
            defaultColDef={{ resizable: true, minWidth: 80 }}
            animateRows={false}
            domLayout={activeResult.rows.length <= 20 ? "autoHeight" : "normal"}
          />
        </div>
      ) : (
        <div className="no-rows">
          {activeResult.affectedRows !== undefined
            ? `${activeResult.affectedRows} row(s) affected`
            : "Query executed successfully (no rows returned)"}
        </div>
      )}
    </div>
  );
}
