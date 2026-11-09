import { describe, expect, it } from "vitest";

import { findOverlappingBullets } from "@/features/library/overlap";

describe("findOverlappingBullets", () => {
  it("flags materially similar reporting bullets", () => {
    const pairs = findOverlappingBullets([
      {
        id: "a",
        text: "Produced monthly executive reporting for the operations leadership team.",
      },
      {
        id: "b",
        text: "Produced monthly executive reporting decks for operations leadership.",
      },
      {
        id: "c",
        text: "Trained three new analysts on the warehouse intake checklist.",
      },
    ]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.leftId).toBe("a");
    expect(pairs[0]?.rightId).toBe("b");
    expect(pairs[0]?.shared.length).toBeGreaterThanOrEqual(3);
  });

  it("does not flag bullets that only share common verbs", () => {
    const pairs = findOverlappingBullets([
      {
        id: "a",
        text: "Managed inventory counts across three store locations each week.",
      },
      {
        id: "b",
        text: "Managed customer escalations for the evening service desk.",
      },
    ]);
    expect(pairs).toEqual([]);
  });

  it("returns at most three pairs", () => {
    const bullets = Array.from({ length: 6 }, (_, index) => ({
      id: `b${index}`,
      text: `Prepared quarterly revenue forecasting models for finance stakeholders ${index}.`,
    }));
    expect(findOverlappingBullets(bullets).length).toBeLessThanOrEqual(3);
  });
});
