import React from "react";
import { QueryResult } from "../../../shared/types";

interface ResultsGridProps {
  results: QueryResult[];
}

export function ResultsGrid({ results }: ResultsGridProps) {
  if (results.length === 0) return null;

  return (
    <div className="results-placeholder">
      {results.map((result, i) => (
        <div key={i} className="result-tab">
          <strong>Result {i + 1}:</strong> {result.rowCount} row(s), {result.columns.length} column(s)
          <pre>{JSON.stringify(result.rows.slice(0, 5), null, 2)}</pre>
        </div>
      ))}
    </div>
  );
}
