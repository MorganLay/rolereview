import { describe, expect, it } from "vitest";

import {
  recoverRequirementText,
  recoverRequirements,
  restoreGapText,
} from "@/features/jobs/requirement-text";

const FULL =
  "3+ years of experience in hockey analytics and/or professional software development.";
const CUT = FULL.slice(0, 80);
const POSTING = `What you bring\n- ${FULL}\n- SQL reporting experience.`;

describe("requirement text", () => {
  it("restores a mid-word cut from the one sentence that continues it", () => {
    expect(CUT.endsWith("developm")).toBe(true);
    expect(recoverRequirementText(CUT, POSTING)).toBe(FULL);
  });

  it("keeps a complete requirement, and does not guess when the posting has two matches", () => {
    expect(recoverRequirementText(FULL, POSTING)).toBe(FULL);
    expect(recoverRequirementText("SQL", POSTING)).toBe("SQL");
    const doubled = `${POSTING}\n${POSTING}`;
    expect(recoverRequirementText(CUT, doubled)).toBe(CUT);
  });

  it("leaves a cut alone when the posting has no continuation", () => {
    expect(recoverRequirementText(CUT, "A different posting with no shared sentence.")).toBe(CUT);
  });

  it("recovers stored requirements without changing their ids", () => {
    const [requirement] = recoverRequirements(
      [{ id: "r1", text: CUT, kind: "experience", importance: "must" }],
      POSTING,
    );
    expect(requirement).toEqual({
      id: "r1",
      text: FULL,
      kind: "experience",
      importance: "must",
    });
  });

  it("expands a saved gap that is a prefix of the full requirement", () => {
    expect(
      restoreGapText(CUT, [
        { id: "r1", text: FULL, kind: "experience", importance: "must" },
      ]),
    ).toBe(FULL);
    expect(
      restoreGapText("SQL", [{ id: "r1", text: FULL, kind: "experience", importance: "must" }]),
    ).toBe("SQL");
  });
});
