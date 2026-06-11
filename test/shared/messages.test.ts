import { describe, it, expect } from "vitest";
import { createRequestId, WebviewMessage, ExtensionMessage } from "../../src/shared/messages";

describe("createRequestId", () => {
  it("generates unique IDs", () => {
    const id1 = createRequestId();
    const id2 = createRequestId();
    expect(id1).not.toBe(id2);
  });

  it("generates string IDs", () => {
    const id = createRequestId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });
});

describe("message types", () => {
  it("WebviewMessage fetch-table-data is valid", () => {
    const msg: WebviewMessage = {
      type: "fetch-table-data",
      requestId: "test-1",
      table: "users",
      limit: 50,
      offset: 0,
    };
    expect(msg.type).toBe("fetch-table-data");
  });

  it("ExtensionMessage table-data is valid", () => {
    const msg: ExtensionMessage = {
      type: "table-data",
      requestId: "test-1",
      rows: [{ id: 1, name: "Alice" }],
      columns: [
        { name: "id", dataType: "int4", nullable: false, isPrimaryKey: true },
        { name: "name", dataType: "varchar", nullable: true, isPrimaryKey: false },
      ],
    };
    expect(msg.rows).toHaveLength(1);
  });
});
