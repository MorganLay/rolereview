import { describe, expect, it } from "vitest";

import type { Requirement } from "@/features/jobs/schemas";
import {
  includeEvidence,
  requirementState,
} from "@/features/tailor/requirement-state";
import type { ResumeContent, StoredVerdict } from "@/features/tailor/schemas";

import {
  baseRequirements,
  contentBullet,
  librarySnapshot,
  resumeContent,
} from "./tailor-fixture";

const python = baseRequirements[0];
const certification = baseRequirements[1];
if (!python || !certification) throw new Error("missing fixture requirement");

const kubernetes: Requirement = {
  id: "r9",
  text: "Kubernetes",
  kind: "skill",
  importance: "must",
};

const javascript: Requirement = {
  id: "r8",
  text: "Java",
  kind: "skill",
  importance: "must",
};

function verdict(
  value: StoredVerdict,
  evidenceRefs: string[] = [],
  note = "Noted.",
) {
  return { verdict: value, evidenceRefs, note };
}

function pythonResume(options: {
  bulletIncluded: boolean;
  entryIncluded?: boolean;
  skillIncluded?: boolean;
  bulletText?: string;
}): ResumeContent {
  return resumeContent({
    entries: [
      {
        ref: "E2",
        kind: "PROJECT",
        included: options.entryIncluded ?? true,
        bullets: [
          contentBullet({
            id: "bullet-python",
            text: options.bulletText ?? "Wrote a Python bot that booked rooms.",
            included: options.bulletIncluded,
            sourceRefs: ["E2.B1"],
          }),
        ],
      },
    ],
    skills: options.skillIncluded
      ? [{ category: "Languages", names: ["Python"] }]
      : [],
  });
}

describe("requirementState", () => {
  it("calls a skill in an included bullet In this resume, and In your library once that bullet is off", () => {
    const onResume = requirementState({
      requirement: python,
      verdict: verdict("missing", [], "No Python listed."),
      content: pythonResume({ bulletIncluded: true }),
      snapshot: librarySnapshot(),
      keywords: ["Python", "SQL"],
    });
    const excluded = requirementState({
      requirement: python,
      verdict: verdict("missing", [], "No Python listed."),
      content: pythonResume({ bulletIncluded: false }),
      snapshot: librarySnapshot(),
      keywords: ["Python", "SQL"],
    });

    expect(onResume.state).toBe("in_resume");
    expect(onResume.state).not.toBe("no_evidence");
    expect(excluded).toEqual({
      state: "in_library",
      includeRefs: ["E2.B1", "S1"],
    });
  });

  it("calls a skill chip on the resume In this resume", () => {
    const placement = requirementState({
      requirement: python,
      verdict: verdict("missing", [], "No Python listed."),
      content: pythonResume({ bulletIncluded: false, skillIncluded: true }),
      snapshot: librarySnapshot(),
      keywords: [],
    });

    expect(placement.state).toBe("in_resume");
  });

  it.each([
    {
      name: "unassessed with nothing placed",
      requirement: certification,
      stored: verdict("unassessed", [], "Not assessed."),
      state: "needs_review" as const,
    },
    {
      name: "an older not-assessed row",
      requirement: certification,
      stored: verdict("missing", [], "Not assessed."),
      state: "needs_review" as const,
    },
    {
      name: "no stored verdict",
      requirement: certification,
      stored: null,
      state: "needs_review" as const,
    },
    {
      name: "partial evidence that is not in the resume or the library",
      requirement: certification,
      stored: verdict("partial"),
      state: "needs_review" as const,
    },
    {
      name: "a missing requirement with no library term",
      requirement: kubernetes,
      stored: verdict("missing", [], "No cluster work."),
      state: "no_evidence" as const,
    },
  ])("$name is $state", ({ requirement, stored, state }) => {
    const placement = requirementState({
      requirement,
      verdict: stored,
      content: resumeContent(),
      snapshot: librarySnapshot(),
      keywords: requirement.id === "r9" ? ["Kubernetes"] : ["Python", "SQL"],
    });

    expect(placement).toEqual({ state, includeRefs: [] });
  });

  it("keeps an included evidence ref In this resume when the model said missing", () => {
    const placement = requirementState({
      requirement: certification,
      verdict: verdict("missing", ["E2.B1"], "No certification is listed."),
      content: pythonResume({ bulletIncluded: true, bulletText: "Booked rooms." }),
      snapshot: librarySnapshot(),
      keywords: [],
    });

    expect(placement.state).toBe("in_resume");
  });

  it("moves an excluded evidence ref to the library", () => {
    const placement = requirementState({
      requirement: certification,
      verdict: verdict("met", ["E2.B1"], "Cited."),
      content: pythonResume({
        bulletIncluded: false,
        bulletText: "Booked rooms.",
        entryIncluded: false,
      }),
      snapshot: librarySnapshot(),
      keywords: [],
    });

    expect(placement).toEqual({ state: "in_library", includeRefs: ["E2.B1"] });
  });

  it("lets included evidence win over a partial verdict", () => {
    const placement = requirementState({
      requirement: python,
      verdict: verdict("partial", ["E2.B1"], "Related."),
      content: pythonResume({ bulletIncluded: true }),
      snapshot: librarySnapshot(),
      keywords: [],
    });

    expect(placement.state).toBe("in_resume");
  });

  it("does not treat Java as JavaScript", () => {
    const placement = requirementState({
      requirement: javascript,
      verdict: verdict("missing", [], "No Java."),
      content: pythonResume({
        bulletIncluded: true,
        bulletText: "Shipped a JavaScript interface.",
      }),
      snapshot: librarySnapshot(),
      keywords: ["Java", "JavaScript"],
    });

    expect(placement.state).toBe("no_evidence");
  });

  it("matches a keyword in included text", () => {
    const placement = requirementState({
      requirement: kubernetes,
      verdict: verdict("missing", [], "No cluster work."),
      content: resumeContent({
        summary: { text: "Ran Kubernetes for the platform team.", included: true },
      }),
      snapshot: librarySnapshot(),
      keywords: ["Kubernetes"],
    });

    expect(placement.state).toBe("in_resume");
  });

  it("offers the excluded bullet when the keyword is only there", () => {
    const placement = requirementState({
      requirement: kubernetes,
      verdict: verdict("missing", [], "No cluster work."),
      content: pythonResume({
        bulletIncluded: false,
        bulletText: "Ran Kubernetes for the platform team.",
      }),
      snapshot: librarySnapshot(),
      keywords: ["Kubernetes"],
    });

    expect(placement.state).toBe("in_library");
    expect(placement.includeRefs).toContain("E2.B1");
  });
});

describe("includeEvidence", () => {
  it("turns the excluded bullet, its entry, and the skill on", () => {
    const content = pythonResume({
      bulletIncluded: false,
      entryIncluded: false,
    });
    const next = includeEvidence(content, librarySnapshot(), ["E2.B1", "S1"]);

    expect(next.entries[0]).toMatchObject({
      included: true,
      bullets: [expect.objectContaining({ id: "bullet-python", included: true })],
    });
    expect(next.skills).toEqual([{ category: "Languages", names: ["Python"] }]);
  });

  it("leaves an unrelated bullet off", () => {
    const content = resumeContent({
      entries: [
        {
          ref: "E1",
          kind: "EXPERIENCE",
          included: true,
          bullets: [
            contentBullet({
              id: "kept-off",
              text: "Shelved returns.",
              included: false,
              sourceRefs: ["E1.B1"],
            }),
            contentBullet({
              id: "turn-on",
              text: "Built reports.",
              included: false,
              sourceRefs: ["E1.B2"],
            }),
          ],
        },
      ],
    });
    const next = includeEvidence(content, librarySnapshot(), ["E1.B2"]);
    const bullets = next.entries[0]?.bullets ?? [];

    expect(bullets.map((bullet) => [bullet.id, bullet.included])).toEqual([
      ["kept-off", false],
      ["turn-on", true],
    ]);
  });
});
