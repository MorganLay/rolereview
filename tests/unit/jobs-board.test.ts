import { describe, expect, it } from "vitest";

import {
  boardCardTitle,
  boardLocationSummary,
  boardPlaceLabel,
  earlierBoardCue,
  presentBoardCard,
  type BoardCardRecord,
} from "@/features/jobs/format";

function card(partial: Partial<BoardCardRecord> = {}): BoardCardRecord {
  return {
    id: "job-1",
    company: "Acme",
    title: "Analyst",
    location: null,
    workMode: "UNKNOWN",
    status: "SAVED",
    priority: null,
    matchScore: null,
    submitted: false,
    deadline: null,
    archived: false,
    boardOrder: 0,
    nextKind: null,
    nextAt: null,
    analysisReady: true,
    latestReadyResume: null,
    hasOffer: false,
    ...partial,
  };
}

describe("earlierBoardCue", () => {
  it("picks the earlier instant", () => {
    expect(
      earlierBoardCue("2026-05-02T15:00:00.000Z", "2026-05-01T15:00:00.000Z"),
    ).toEqual({ kind: "interview", at: "2026-05-01T15:00:00.000Z" });
    expect(
      earlierBoardCue("2026-05-01T15:00:00.000Z", "2026-05-03T15:00:00.000Z"),
    ).toEqual({ kind: "reminder", at: "2026-05-01T15:00:00.000Z" });
  });

  it("keeps the reminder when both cues share a time", () => {
    const at = "2026-05-01T15:00:00.000Z";
    expect(earlierBoardCue(at, at)).toEqual({ kind: "reminder", at });
  });

  it("uses whichever cue is readable", () => {
    expect(earlierBoardCue(null, "2026-05-01T15:00:00.000Z")?.kind).toBe("interview");
    expect(earlierBoardCue("2026-05-01T15:00:00.000Z", null)?.kind).toBe("reminder");
    expect(earlierBoardCue(null, null)).toBeNull();
    expect(earlierBoardCue("nope", "2026-05-01T15:00:00.000Z")?.kind).toBe("interview");
    expect(earlierBoardCue("nope", "also-nope")).toBeNull();
    expect(earlierBoardCue("", "2026-05-01T15:00:00.000Z")?.kind).toBe("interview");
  });
});

describe("presentBoardCard", () => {
  it("marks a deadline within three days and hides an empty cue", () => {
    const shown = presentBoardCard(
      card({
        matchScore: 72,
        submitted: true,
        deadline: "2026-05-04",
        nextKind: "reminder",
        nextAt: "not-a-time",
      }),
      "America/Toronto",
      "2026-05-02",
    );
    expect(shown.matchLabel).toBe("72");
    expect(shown.submitted).toBe(true);
    expect(shown.deadlineNote).toBe("soon");
    expect(shown.nextLabel).toBeNull();
  });

  it("marks an earlier deadline as past", () => {
    const shown = presentBoardCard(
      card({ deadline: "2026-05-01" }),
      "America/Toronto",
      "2026-05-02",
    );
    expect(shown.deadlineNote).toBe("past");
    expect(shown.matchLabel).toBe("—");
  });

  it("leaves a deadline five days away unmarked", () => {
    const shown = presentBoardCard(
      card({ deadline: "2026-05-07" }),
      "America/Toronto",
      "2026-05-02",
    );
    expect(shown.deadlineNote).toBeNull();
    expect(shown.placeLabel).toBeNull();
  });
});

describe("boardPlaceLabel", () => {
  it("joins a known work mode and a short place", () => {
    expect(boardPlaceLabel("REMOTE", "Canada")).toBe("Remote · Canada");
    expect(boardPlaceLabel("HYBRID", "  Toronto, ON  ")).toBe("Hybrid · Toronto, ON");
  });

  it("keeps a city and country, and leaves the street off", () => {
    expect(boardLocationSummary("Virtual, 80 Aberdeen Street, Ottawa, Ontario, Canada")).toBe(
      "Ottawa, Canada",
    );
    expect(
      boardPlaceLabel("REMOTE", "Virtual, 80 Aberdeen Street, Ottawa, Ontario, Canada"),
    ).toBe("Remote · Ottawa, Canada");
    expect(boardLocationSummary("80 King Street")).toBeNull();
    expect(boardLocationSummary("St. John's, NL")).toBe("St. John's, NL");
  });

  it("drops an unknown mode and a blank location", () => {
    expect(boardPlaceLabel("UNKNOWN", "Ottawa")).toBe("Ottawa");
    expect(boardPlaceLabel("ONSITE", "   ")).toBe("On-site");
    expect(boardPlaceLabel("UNKNOWN", null)).toBeNull();
    expect(boardPlaceLabel(null, "")).toBeNull();
  });
});

describe("boardCardTitle", () => {
  it("drops a trailing note that only restates place, mode, or timezone", () => {
    expect(boardCardTitle("Data Engineer (Canada, EST, Remote)")).toBe("Data Engineer");
    expect(boardCardTitle("Analyst (Remote)")).toBe("Analyst");
  });

  it("keeps a specialty or a seniority", () => {
    expect(boardCardTitle("Product Designer (Platform)")).toBe("Product Designer (Platform)");
    expect(boardCardTitle("Engineer (Senior, Remote)")).toBe("Engineer (Senior, Remote)");
    expect(boardCardTitle("Data Engineer")).toBe("Data Engineer");
  });
});
