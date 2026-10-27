import { beforeEach, describe, expect, it } from "vitest";

import {
  noteSuccessfulAnalysis,
  pendingAnalysesFor,
  reconcileAnalysesAdjust,
  rememberAnalyses,
  resetPendingAnalyses,
} from "@/features/jobs/analyses-left";

const NOW = new Date("2026-10-27T15:00:00.000Z");

describe("analyses left", () => {
  beforeEach(() => {
    resetPendingAnalyses();
  });

  it("counts two successful analyses as 2 used and one failure as no extra use", () => {
    let adjust = { base: 10, delta: 0 };
    let visible = 10;
    adjust = noteSuccessfulAnalysis({
      baseAtSubmit: adjust.base,
      visibleAtSubmit: visible,
      baseNow: adjust.base,
    });
    visible = adjust.base - adjust.delta;
    adjust = noteSuccessfulAnalysis({
      baseAtSubmit: adjust.base,
      visibleAtSubmit: visible,
      baseNow: adjust.base,
    });
    visible = adjust.base - adjust.delta;
    expect(adjust.delta).toBe(2);
    expect(visible).toBe(8);

    const caughtUp = reconcileAnalysesAdjust(8, adjust);
    expect(caughtUp.delta).toBe(0);
    expect(caughtUp.base - caughtUp.delta).toBe(8);
  });

  it("does not count a success the server remaining already includes", () => {
    const next = noteSuccessfulAnalysis({
      baseAtSubmit: 10,
      visibleAtSubmit: 10,
      baseNow: 9,
    });
    expect(next).toEqual({ base: 9, delta: 0 });
  });

  it("keeps a success the refreshed count has not absorbed", () => {
    const next = reconcileAnalysesAdjust(9, { base: 10, delta: 2 });
    expect(next.delta).toBe(1);
    expect(next.base - next.delta).toBe(8);
  });

  it("drops a pending use once the server count includes it", () => {
    rememberAnalyses({ base: 10, delta: 2 }, NOW);
    expect(pendingAnalysesFor(10, NOW).delta).toBe(2);
    expect(pendingAnalysesFor(8, NOW).delta).toBe(0);
    expect(pendingAnalysesFor(8, NOW).delta).toBe(0);
  });

  it("forgets pending uses after the UTC day rolls", () => {
    rememberAnalyses({ base: 10, delta: 1 }, NOW);
    const nextDay = new Date("2026-10-28T00:00:00.000Z");
    expect(pendingAnalysesFor(10, nextDay)).toEqual({ base: 10, delta: 0 });
  });
});
