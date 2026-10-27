import { describe, expect, it } from "vitest";

import { boardCardSecondaryLine } from "@/features/jobs/components/board-card-line";

describe("boardCardSecondaryLine", () => {
  it("prefers a deadline that is soon or past over the match score", () => {
    expect(boardCardSecondaryLine("soon")).toEqual({ kind: "deadline", note: "soon" });
    expect(boardCardSecondaryLine("past")).toEqual({ kind: "deadline", note: "past" });
  });

  it("uses the match line when there is no deadline", () => {
    expect(boardCardSecondaryLine(null)).toEqual({ kind: "match" });
  });
});
