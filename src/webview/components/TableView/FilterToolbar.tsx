import React, { useState } from "react";

interface FilterToolbarProps {
  onApplyFilters: (where: string, orderBy: string, limit: number, offset: number) => void;
  onLoadCount: () => void;
  totalCount: number | null;
  currentOffset: number;
  currentLimit: number;
  loading: boolean;
}

export function FilterToolbar({
  onApplyFilters,
  onLoadCount,
  totalCount,
  currentOffset,
  currentLimit,
  loading,
}: FilterToolbarProps) {
  const [where, setWhere] = useState("");
  const [orderBy, setOrderBy] = useState("");
  const [limitStr, setLimitStr] = useState(String(currentLimit));
  const limit = parseInt(limitStr) || 0;

  const handleApply = () => {
    onApplyFilters(where, orderBy, limit, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleApply();
  };

  const totalPages = totalCount !== null && limit > 0 ? Math.ceil(totalCount / limit) : null;
  const currentPage = limit > 0 ? Math.floor(currentOffset / limit) + 1 : 1;

  const goToPage = (page: number) => {
    const newOffset = (page - 1) * limit;
    onApplyFilters(where, orderBy, limit, newOffset);
  };

  return (
    <div className="filter-toolbar">
      <div className="filter-inputs">
        <label>
          WHERE:
          <input
            type="text"
            value={where}
            onChange={(e) => setWhere(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. age > 25"
            disabled={loading}
          />
        </label>
        <label>
          ORDER BY:
          <input
            type="text"
            value={orderBy}
            onChange={(e) => setOrderBy(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. name ASC"
            disabled={loading}
          />
        </label>
        <label>
          LIMIT:
          <input
            type="number"
            value={limitStr}
            onChange={(e) => setLimitStr(e.target.value)}
            onKeyDown={handleKeyDown}
            min={0}
            max={10000}
            placeholder="All"
            disabled={loading}
          />
        </label>
        <button onClick={handleApply} disabled={loading}>
          Apply Filters
        </button>
      </div>
      <div className="filter-pagination">
        <span>
          Showing {currentOffset + 1}–{currentOffset + limit} of{" "}
          {totalCount !== null ? (
            totalCount.toLocaleString()
          ) : (
            <button className="link-button" onClick={onLoadCount} disabled={loading}>
              Load Count
            </button>
          )}
        </span>
        {totalPages !== null && (
          <span className="page-controls">
            <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1 || loading}>
              &lt;
            </button>
            <span>Page {currentPage}{totalPages > 0 ? ` of ${totalPages}` : ""}</span>
            <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= (totalPages || 1) || loading}>
              &gt;
            </button>
          </span>
        )}
      </div>
    </div>
  );
}
