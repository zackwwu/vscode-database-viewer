import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FilterToolbar } from "../../../src/webview/components/TableView/FilterToolbar";

const defaultProps = {
  onApplyFilters: vi.fn(),
  onLoadCount: vi.fn(),
  totalCount: null,
  currentOffset: 0,
  currentLimit: 50,
  loading: false,
};

describe("FilterToolbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders filter inputs", () => {
    render(<FilterToolbar {...defaultProps} />);
    expect(screen.getByPlaceholderText("e.g. age > 25")).toBeDefined();
    expect(screen.getByPlaceholderText("e.g. name ASC")).toBeDefined();
  });

  it("calls onApplyFilters when button clicked", () => {
    render(<FilterToolbar {...defaultProps} />);
    const whereInput = screen.getByPlaceholderText("e.g. age > 25");
    fireEvent.change(whereInput, { target: { value: "age > 25" } });
    fireEvent.click(screen.getByText("Apply Filters"));
    expect(defaultProps.onApplyFilters).toHaveBeenCalledWith("age > 25", "", 50, 0);
  });

  it("shows Load Count button when totalCount is null", () => {
    render(<FilterToolbar {...defaultProps} />);
    expect(screen.getByText("Load Count")).toBeDefined();
  });

  it("shows total count when available", () => {
    render(<FilterToolbar {...defaultProps} totalCount={1000} />);
    expect(screen.getByText(/1,000/)).toBeDefined();
  });

  it("shows pagination when count is known", () => {
    render(<FilterToolbar {...defaultProps} totalCount={200} />);
    expect(screen.getByText(/Page 1/)).toBeDefined();
  });

  it("disables inputs when loading", () => {
    render(<FilterToolbar {...defaultProps} loading={true} />);
    const whereInput = screen.getByPlaceholderText("e.g. age > 25") as HTMLInputElement;
    expect(whereInput.disabled).toBe(true);
  });
});
