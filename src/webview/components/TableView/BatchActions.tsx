import React from "react";

interface BatchActionsProps {
  modifiedCount: number;
  hasPkChanges: boolean;
  onApply: () => void;
  onRevert: () => void;
  loading: boolean;
  errors: { rowKey: Record<string, unknown>; message: string }[];
}

export function BatchActions({
  modifiedCount,
  hasPkChanges,
  onApply,
  onRevert,
  loading,
  errors,
}: BatchActionsProps) {
  if (modifiedCount === 0 && errors.length === 0) return null;

  return (
    <div className="batch-actions">
      <div className="batch-info">
        {modifiedCount > 0 && (
          <span className="modified-count">{modifiedCount} row(s) modified</span>
        )}
        {errors.length > 0 && (
          <div className="batch-errors">
            {errors.map((err, i) => (
              <div key={i} className="batch-error">
                Row {JSON.stringify(err.rowKey)}: {err.message}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="batch-buttons">
        <button onClick={onRevert} disabled={loading || modifiedCount === 0}>
          Revert
        </button>
        <button onClick={onApply} disabled={loading || modifiedCount === 0} className="apply-button">
          Apply
        </button>
      </div>
      {hasPkChanges && (
        <div className="pk-warning">
          Warning: Primary key changes included. A confirmation will appear on Apply.
        </div>
      )}
    </div>
  );
}
