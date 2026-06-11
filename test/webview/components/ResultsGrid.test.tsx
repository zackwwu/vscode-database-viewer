import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ResultsGrid } from "../../../src/webview/components/QueryConsole/ResultsGrid";
import { QueryResult } from "../../../src/shared/types";

const singleResult: QueryResult[] = [
  {
    rows: [{ id: 1, name: "Alice" }],
    columns: [
      { name: "id", dataType: "integer", nullable: false, isPrimaryKey: true },
      { name: "name", dataType: "varchar", nullable: true, isPrimaryKey: false },
    ],
    rowCount: 1,
  },
];

const multiResults: QueryResult[] = [
  {
    rows: [{ id: 1, name: "Alice" }],
    columns: [
      { name: "id", dataType: "integer", nullable: false, isPrimaryKey: true },
      { name: "name", dataType: "varchar", nullable: true, isPrimaryKey: false },
    ],
    rowCount: 1,
  },
  {
    rows: [],
    columns: [],
    rowCount: 0,
    affectedRows: 3,
  },
];

describe("ResultsGrid", () => {
  it("renders nothing when results are empty", () => {
    const { container } = render(<ResultsGrid results={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("does not show tabs for single result", () => {
    render(<ResultsGrid results={singleResult} />);
    expect(screen.queryByText("Statement 1")).toBeNull();
  });

  it("shows tabs for multiple results", () => {
    render(<ResultsGrid results={multiResults} />);
    expect(screen.getByText("Statement 1")).toBeTruthy();
    expect(screen.getByText("Statement 2")).toBeTruthy();
  });

  it("shows affected rows for non-SELECT statements", () => {
    render(<ResultsGrid results={multiResults} />);
    fireEvent.click(screen.getByText("Statement 2"));
    expect(screen.getByText("3 row(s) affected")).toBeTruthy();
  });

  it("shows success message for zero-result queries", () => {
    const zeroResult: QueryResult[] = [
      { rows: [], columns: [], rowCount: 0 },
    ];
    render(<ResultsGrid results={zeroResult} />);
    expect(screen.getByText("Query executed successfully (no rows returned)")).toBeTruthy();
  });
});
