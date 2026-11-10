import { describe, expect, it } from "vitest";

import { nextHeldStage } from "@/components/shell/work-progress";

describe("nextHeldStage", () => {
  it("advances and stays on the last line", () => {
    expect(nextHeldStage(0, 5)).toBe(1);
    expect(nextHeldStage(3, 5)).toBe(4);
    expect(nextHeldStage(4, 5)).toBe(4);
  });

  it("stays put when there is only one line", () => {
    expect(nextHeldStage(0, 1)).toBe(0);
    expect(nextHeldStage(2, 0)).toBe(0);
  });
});