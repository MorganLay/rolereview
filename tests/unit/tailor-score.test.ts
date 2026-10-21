import { describe, expect, it } from "vitest";

import { RESUME_LIMITS } from "@/features/tailor/schemas";
import type { RequirementMatch } from "@/features/tailor/schemas";
import { scoreMatch } from "@/features/tailor/score";

import { baseRequirements, jobAnalysis } from "./tailor-fixture";

function match(
  requirementId: string,
  verdict: RequirementMatch["verdict"],
  note = "Noted.",
): RequirementMatch {
  return { requirementId, verdict, evidenceRefs: ["E1.B1"], note };
}

describe("scoreMatch", () => {
  it("returns null when the posting has no requirements", () => {
    const report = scoreMatch(jobAnalysis([]), [match("r1", "met")]);

    expect(report).toEqual({ verdicts: [], score: null });
  });

  it("scores a met must as 100, a partial must as 50, and a missing must as 0", () => {
    const requirement = baseRequirements[0];
    if (!requirement) throw new Error("missing requirement");
    const must = jobAnalysis([requirement]);

    expect(scoreMatch(must, [match("r1", "met")]).score).toBe(100);
    expect(scoreMatch(must, [match("r1", "partial")]).score).toBe(50);
    expect(scoreMatch(must, [match("r1", "missing")]).score).toBe(0);
  });

  it("weights a must at twice a nice-to-have", () => {
    const report = scoreMatch(jobAnalysis(), [
      match("r1", "met"),
      match("r2", "missing", "No certification."),
    ]);

    expect(report.score).toBe(67);
    expect(report.verdicts.map((verdict) => verdict.requirementId)).toEqual([
      "r1",
      "r2",
    ]);
  });

  it("rounds a score that lands on a half up", () => {
    const eightNice = Array.from({ length: 8 }, (_, index) => ({
      id: `n${index + 1}`,
      text: `Nice ${index + 1}`,
      kind: "other" as const,
      importance: "nice" as const,
    }));
    const matches = eightNice.map((requirement, index) =>
      match(requirement.id, index === 0 ? "met" : "missing"),
    );

    expect(scoreMatch(jobAnalysis(eightNice), matches).score).toBe(13);
  });

  it("follows the analysis order and keeps the first match for a repeated id", () => {
    const report = scoreMatch(jobAnalysis(), [
      match("r2", "partial", "Second requirement first."),
      match("r1", "met", "Kept."),
      match("r1", "missing", "Dropped."),
    ]);

    expect(report.verdicts.map((verdict) => verdict.note)).toEqual([
      "Kept.",
      "Second requirement first.",
    ]);
    expect(report.score).toBe(83);
  });

  it("treats a requirement with no match as not assessed", () => {
    const report = scoreMatch(jobAnalysis(), []);

    expect(report.verdicts).toEqual([
      {
        requirementId: "r1",
        verdict: "missing",
        evidenceRefs: [],
        note: "Not assessed.",
      },
      {
        requirementId: "r2",
        verdict: "missing",
        evidenceRefs: [],
        note: "Not assessed.",
      },
    ]);
    expect(report.score).toBe(0);
  });

  it("cuts a note at 200 characters", () => {
    const note = "n".repeat(RESUME_LIMITS.note + 40);
    const requirement = baseRequirements[0];
    if (!requirement) throw new Error("missing requirement");
    const report = scoreMatch(jobAnalysis([requirement]), [
      match("r1", "met", note),
    ]);

    expect(report.verdicts[0]?.note).toHaveLength(RESUME_LIMITS.note);
  });

  it("ignores a match whose requirement is not on the posting", () => {
    const requirement = baseRequirements[0];
    if (!requirement) throw new Error("missing requirement");
    const report = scoreMatch(jobAnalysis([requirement]), [
      match("r9", "met", "Extra."),
    ]);

    expect(report.verdicts).toHaveLength(1);
    expect(report.verdicts[0]?.requirementId).toBe("r1");
    expect(report.score).toBe(0);
  });
});
