import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BatchActions } from "../../../src/webview/components/TableView/BatchActions";

const defaultProps = {
  modifiedCount: 0,
  hasPkChanges: false,
  onApply: vi.fn(),
  onRevert: vi.fn(),
  loading: false,
  errors: [] as { rowKey: Record<string, unknown>; message: string }[],
};

describe("BatchActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when no modifications and no errors", () => {
    const { container } = render(<BatchActions {...defaultProps} />);
    expect(container.innerHTML).toBe("");
  });

  it("shows modified count when rows are dirty", () => {
    render(<BatchActions {...defaultProps} modifiedCount={3} />);
    expect(screen.getByText("3 row(s) modified")).toBeDefined();
  });

  it("shows errors when present", () => {
    render(
      <BatchActions
        {...defaultProps}
        errors={[{ rowKey: { id: 1 }, message: "Constraint violation" }]}
      />
    );
    expect(screen.getByText(/Constraint violation/)).toBeDefined();
  });

  it("calls onApply when Apply clicked", () => {
    render(<BatchActions {...defaultProps} modifiedCount={2} />);
    fireEvent.click(screen.getByText("Apply"));
    expect(defaultProps.onApply).toHaveBeenCalledTimes(1);
  });

  it("calls onRevert when Revert clicked", () => {
    render(<BatchActions {...defaultProps} modifiedCount={2} />);
    fireEvent.click(screen.getByText("Revert"));
    expect(defaultProps.onRevert).toHaveBeenCalledTimes(1);
  });

  it("disables buttons when loading", () => {
    render(<BatchActions {...defaultProps} modifiedCount={1} loading={true} />);
    expect((screen.getByText("Apply") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByText("Revert") as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows PK warning when primary key changes exist", () => {
    render(<BatchActions {...defaultProps} modifiedCount={1} hasPkChanges={true} />);
    expect(screen.getByText(/Primary key changes included/)).toBeDefined();
  });
});
