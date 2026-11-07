import { describe, expect, it } from "vitest";

import { boardCardMatchText, boardCardSecondaryLine } from "@/features/jobs/components/board-card-line";
import { strings } from "@/copy/strings";

describe("boardCardSecondaryLine", () => {
  it("prefers a deadline that is soon or past over the match score", () => {
    expect(boardCardSecondaryLine("soon")).toEqual({ kind: "deadline", note: "soon" });
    expect(boardCardSecondaryLine("past")).toEqual({ kind: "deadline", note: "past" });
  });

  it("uses the match line when there is no deadline", () => {
    expect(boardCardSecondaryLine(null)).toEqual({ kind: "match" });
  });
});

describe("boardCardMatchText", () => {
  it("says a missing score has not been assessed", () => {
    expect(boardCardMatchText(strings.jobs.board.emptyValue)).toBe("Not assessed");
    expect(boardCardMatchText("72")).toBe("Match 72 of 100");
  });
});
