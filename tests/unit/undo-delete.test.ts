import { describe, expect, it } from "vitest";

import { settleUndo, UNDO_DELETE_MS, type UndoSignal } from "@/lib/undo-delete";

describe("undo delete", () => {
  it("waits 8 seconds", () => {
    expect(UNDO_DELETE_MS).toBe(8_000);
    expect(UNDO_DELETE_MS).toBeGreaterThanOrEqual(5_000);
    expect(UNDO_DELETE_MS).toBeLessThanOrEqual(10_000);
  });

  it("undo restores and every other ending commits", () => {
    const signals: UndoSignal[] = ["undo", "expire", "dismiss", "unmount"];
    expect(signals.map((signal) => settleUndo("pending", signal))).toEqual([
      "restore",
      "commit",
      "commit",
      "commit",
    ]);
  });

  it("keeps the first outcome", () => {
    expect(settleUndo("restore", "expire")).toBe("restore");
    expect(settleUndo("restore", "unmount")).toBe("restore");
    expect(settleUndo("commit", "undo")).toBe("commit");
    expect(settleUndo("commit", "dismiss")).toBe("commit");
  });
});
