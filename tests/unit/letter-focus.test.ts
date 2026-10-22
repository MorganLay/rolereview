import { describe, expect, it } from "vitest";

import { focusRefsForLibrary, includedBulletRefs } from "@/features/letters/focus";
import { writeLetterSchema } from "@/features/letters/schemas";
import { displayedLetterStatus, LETTER_STALE_MS } from "@/features/letters/status";
import type { ContentEntry } from "@/features/tailor/schemas";

import { contentBullet, librarySnapshot, resumeContent } from "./tailor-fixture";

const JOB_ID = "00000000-0000-4000-8000-000000000001";
const RESUME_ID = "00000000-0000-4000-8000-000000000002";

function entry(
  ref: string,
  included: boolean,
  bullets: ContentEntry["bullets"],
): ContentEntry {
  return { ref, kind: "EXPERIENCE", included, bullets };
}

describe("includedBulletRefs", () => {
  it("keeps included bullet refs in order and drops duplicates", () => {
    const content = resumeContent({
      entries: [
        entry("E1", false, [
          contentBullet({ id: "off", text: "Hidden", sourceRefs: ["E9.B1"] }),
        ]),
        entry("E2", true, [
          contentBullet({
            id: "a",
            text: "First",
            included: false,
            sourceRefs: ["E2.B9"],
          }),
          contentBullet({
            id: "b",
            text: "Second",
            sourceRefs: ["E1.B1", "S1", "E1.B1"],
          }),
          contentBullet({ id: "c", text: "Third", sourceRefs: ["E2.B1", "S1"] }),
        ]),
      ],
    });

    expect(includedBulletRefs(content)).toEqual(["E1.B1", "S1", "E2.B1"]);
  });

  it("returns nothing when every bullet is excluded", () => {
    expect(includedBulletRefs(resumeContent())).toEqual([]);
  });
});

describe("focusRefsForLibrary", () => {
  it("keeps the same refs when the library has not changed", () => {
    const snapshot = librarySnapshot();
    expect(focusRefsForLibrary(["E1.B2", "S1", "E2"], snapshot, snapshot)).toEqual([
      "E1.B2",
      "S1",
      "E2",
    ]);
  });

  it("renames refs after an entry moves, and drops a deleted bullet", () => {
    const previous = librarySnapshot();
    const current = librarySnapshot();
    const moved = current.entries[0]!;
    current.entries[0] = current.entries[1]!;
    current.entries[1] = moved;
    current.entries[0]!.ref = "E1";
    current.entries[0]!.bullets[0]!.ref = "E1.B1";
    current.entries[1]!.ref = "E2";
    current.entries[1]!.bullets = [
      { ...current.entries[1]!.bullets[1]!, ref: "E2.B1" },
    ];
    current.skills[0]!.ref = "S2";
    current.skills[1]!.ref = "S1";

    expect(
      focusRefsForLibrary(["E1.B2", "S1", "E1.B9"], previous, current),
    ).toEqual(["E2.B1", "S2"]);
  });
});

describe("writeLetterSchema", () => {
  it("defaults tone and length and keeps a blank reason", () => {
    const parsed = writeLetterSchema.parse({ jobId: JOB_ID });
    expect(parsed.tone).toBe("professional");
    expect(parsed.length).toBe("standard");
    expect(parsed.recipientName).toBeUndefined();
    expect(parsed.whyCompany).toBeUndefined();
  });

  it("trims the recipient and accepts the length caps", () => {
    const parsed = writeLetterSchema.parse({
      jobId: JOB_ID,
      tone: "warm",
      length: "short",
      recipientName: "  Ms. Chen  ",
      whyCompany: "x".repeat(600),
      resumeId: RESUME_ID,
    });
    expect(parsed.recipientName).toBe("Ms. Chen");
    expect(parsed.whyCompany).toHaveLength(600);
    expect(parsed.resumeId).toBe(RESUME_ID);
  });

  it("rejects a recipient or reason past the cap, and a bad resume id", () => {
    const recipient = writeLetterSchema.safeParse({
      jobId: JOB_ID,
      recipientName: "x".repeat(81),
    });
    const why = writeLetterSchema.safeParse({
      jobId: JOB_ID,
      whyCompany: "x".repeat(601),
    });
    const resume = writeLetterSchema.safeParse({
      jobId: JOB_ID,
      resumeId: "not-a-resume",
    });

    expect(recipient.success).toBe(false);
    expect(why.success).toBe(false);
    expect(resume.success).toBe(false);
    if (!recipient.success) {
      expect(recipient.error.issues.some((issue) => issue.path[0] === "recipientName")).toBe(
        true,
      );
    }
    if (!why.success) {
      expect(why.error.issues.some((issue) => issue.path[0] === "whyCompany")).toBe(true);
    }
  });
});

describe("displayedLetterStatus", () => {
  const now = new Date("2026-10-22T12:00:00.000Z");

  it("treats a pending letter as failed at five minutes", () => {
    const fresh = new Date(now.getTime() - LETTER_STALE_MS + 1);
    const stale = new Date(now.getTime() - LETTER_STALE_MS);
    expect(displayedLetterStatus("PENDING", fresh, now)).toBe("PENDING");
    expect(displayedLetterStatus("PENDING", stale, now)).toBe("FAILED");
    expect(displayedLetterStatus("READY", stale, now)).toBe("READY");
  });
});
