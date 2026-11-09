import { describe, expect, it } from "vitest";

import { libraryOverview } from "@/features/dashboard/library-overview";

const base = {
  populated: true,
  percent: 100,
  strongOrBetter: 8,
  bulletCount: 15,
  wording: 0,
  evidence: 0,
};

describe("libraryOverview", () => {
  it("asks for a library before it reports quality", () => {
    expect(libraryOverview({ ...base, populated: false, bulletCount: 0, strongOrBetter: 0 }).focus).toBe(
      "empty",
    );
  });

  it("prefers wording, then evidence, then completeness", () => {
    expect(libraryOverview({ ...base, wording: 5, evidence: 2, percent: 60 }).focus).toBe("wording");
    expect(libraryOverview({ ...base, evidence: 2, percent: 60 }).focus).toBe("evidence");
    expect(libraryOverview({ ...base, percent: 80 }).focus).toBe("completeness");
    expect(libraryOverview(base).focus).toBe("ready");
  });

  it("does not treat a complete library as finished writing", () => {
    const overview = libraryOverview({ ...base, percent: 100, wording: 3 });
    expect(overview.focus).toBe("wording");
    expect(overview.percent).toBe(100);
  });
});
