import { describe, expect, it } from "vitest";

import { assembleResumeContent } from "@/features/tailor/assemble";
import { composeResume } from "@/features/tailor/compose";
import { tailoringOverview } from "@/features/tailor/overview";
import {
  acceptEditorial,
  editorialDoubts,
  revisionRoute,
} from "@/features/tailor/revise";
import type { TailorOutput, ValidatedTailorOutput } from "@/features/tailor/schemas";
import { validateTailorOutput } from "@/features/tailor/validate";

import { analystDraft, developerAnalysis, developerDraft, hootsuiteSnapshot } from "./tailor-hootsuite-fixture";

function plan(evidence: NonNullable<TailorOutput["plan"]>["evidence"]): TailorOutput["plan"] {
  return {
    narrative: "A grounded story.",
    priorities: ["the work this posting asks for"],
    gaps: [],
    hiringFor: "The work in the posting.",
    positioning: "The strongest defensible evidence.",
    evidence,
    closeCall: false,
  };
}

function drafted(): TailorOutput {
  const output = developerDraft();
  output.entries.push(
    {
      ref: "E_cra",
      bullets: [
        {
          sourceRefs: ["E_cra.B1"],
          text: "Prepared operational reports for program teams.",
        },
      ],
    },
    {
      ref: "E_creek",
      bullets: [
        {
          sourceRefs: ["E_creek.B1"],
          text: "Built a small site for a golf course.",
        },
      ],
    },
  );
  return output;
}

describe("resume strategy", () => {
  it("keeps a strategy and limits an over-long reason", () => {
    const output = drafted();
    output.plan = plan([
      {
        ref: "E_role",
        use: "lead",
        bullets: 2.4,
        because: "x".repeat(400),
      },
    ]);
    const guard = validateTailorOutput(output, hootsuiteSnapshot(), developerAnalysis());
    const evidence = guard.output.plan?.evidence?.[0];
    expect(evidence?.bullets).toBe(2);
    expect(evidence?.because.length).toBeLessThanOrEqual(240);
    expect(guard.output.plan?.closeCall).toBeUndefined();
  });

  it("follows two different strategies for the same library", () => {
    const snapshot = hootsuiteSnapshot();
    const analysis = developerAnalysis();
    const engineering = drafted();
    engineering.plan = plan([
      { ref: "E_role", use: "lead", bullets: 2, because: "Shipped product is the strongest build evidence." },
      { ref: "E_def", use: "lead", bullets: 2, because: "The internship shows React, testing, and review." },
      { ref: "E_cra", use: "support", bullets: 1, because: "Reporting is secondary for this engineering role." },
      { ref: "E_creek", use: "omit", bullets: 0, because: "The golf site repeats deployed web work." },
    ]);
    const engineeringRefs = composeResume({
      output: validateTailorOutput(engineering, snapshot, analysis).output,
      snapshot,
      analysis,
      length: 1,
    }).output.entries.map((entry) => entry.ref);
    expect(engineeringRefs).toContain("E_role");
    expect(engineeringRefs).toContain("E_def");
    expect(engineeringRefs).toContain("E_cra");
    expect(engineeringRefs).not.toContain("E_creek");

    const reporting = drafted();
    reporting.plan = plan([
      { ref: "E_cra", use: "lead", bullets: 1, because: "The reporting role is the direct evidence." },
      { ref: "E_role", use: "omit", bullets: 0, because: "The product does not show reporting work." },
      { ref: "E_def", use: "omit", bullets: 0, because: "The internship is software delivery, not reporting." },
      { ref: "E_creek", use: "omit", bullets: 0, because: "The golf site is unrelated." },
    ]);
    const reportingComposition = composeResume({
      output: validateTailorOutput(reporting, snapshot, analysis).output,
      snapshot,
      analysis,
      length: 1,
    });
    const reportingRefs = reportingComposition.output.entries.map((entry) => entry.ref);
    expect(reportingRefs).toContain("E_cra");
    expect(reportingRefs).not.toContain("E_role");
    expect(reportingRefs).not.toContain("E_def");
    expect(reportingComposition.review).toContainEqual(
      expect.objectContaining({ ref: "E_role", reason: "strategy_omit" }),
    );
  });

  it("fills a lead up to the strategy's line count with unused library facts", () => {
    const snapshot = hootsuiteSnapshot();
    const output = developerDraft();
    output.entries = output.entries.map((entry) =>
      entry.ref === "E_role"
        ? {
            ref: "E_role",
            bullets: [
              {
                sourceRefs: ["E_role.B4"],
                text: "Designed source-traceable AI resume editing workflows.",
              },
            ],
          }
        : entry,
    );
    output.plan = plan([
      { ref: "E_role", use: "lead", bullets: 2, because: "The product should show the build, not only the workflow." },
      { ref: "E_def", use: "support", bullets: 1, because: "The internship stays shorter." },
    ]);
    const composition = composeResume({
      output: validateTailorOutput(output, snapshot, developerAnalysis()).output,
      snapshot,
      analysis: developerAnalysis(),
      length: 1,
    });
    const role = composition.output.entries.find((entry) => entry.ref === "E_role");
    const refs = role?.bullets.flatMap((bullet) => bullet.sourceRefs) ?? [];
    expect(role?.bullets).toHaveLength(2);
    expect(refs).toContain("E_role.B4");
    expect(refs.some((ref) => ref !== "E_role.B4")).toBe(true);
  });

  it("keeps an education heading when the strategy asks for no bullets", () => {
    const snapshot = hootsuiteSnapshot();
    const output = drafted();
    output.entries = output.entries.map((entry) =>
      entry.ref === "E_edu" ? { ...entry, bullets: [] } : entry,
    );
    output.plan = plan([
      { ref: "E_role", use: "lead", bullets: 1, because: "The product leads." },
      { ref: "E_edu", use: "support", bullets: 0, because: "The degree stays, without coursework lines." },
    ]);
    const refs = composeResume({
      output: validateTailorOutput(output, snapshot, developerAnalysis()).output,
      snapshot,
      analysis: developerAnalysis(),
      length: 1,
    }).output.entries.map((entry) => entry.ref);
    expect(refs).toContain("E_edu");
  });

  it("does not cap a support entry below the line count the strategy asked for", () => {
    const snapshot = hootsuiteSnapshot();
    const output = drafted();
    output.plan = plan([
      { ref: "E_cra", use: "lead", bullets: 1, because: "Reporting leads." },
      { ref: "E_def", use: "support", bullets: 2, because: "The internship still shows testing." },
      { ref: "E_role", use: "omit", bullets: 0, because: "The product is not the reporting evidence." },
      { ref: "E_creek", use: "omit", bullets: 0, because: "Unrelated site." },
    ]);
    const composition = composeResume({
      output: validateTailorOutput(output, snapshot, developerAnalysis()).output,
      snapshot,
      analysis: developerAnalysis(),
      length: 1,
    });
    const internship = composition.output.entries.find((entry) => entry.ref === "E_def");
    expect(internship?.bullets).toHaveLength(2);
  });

  it("names the strategy's lead in the overview", () => {
    const snapshot = hootsuiteSnapshot();
    const output = drafted();
    output.plan = plan([
      { ref: "E_role", use: "lead", bullets: 2, because: "The product leads." },
      { ref: "E_def", use: "support", bullets: 1, because: "The internship supports it." },
      { ref: "E_cra", use: "omit", bullets: 0, because: "Reporting is secondary." },
      { ref: "E_creek", use: "omit", bullets: 0, because: "Repeated web work." },
    ]);
    const validated = validateTailorOutput(output, snapshot, developerAnalysis());
    const composition = composeResume({
      output: validated.output,
      snapshot,
      analysis: developerAnalysis(),
      length: 1,
    });
    const content = assembleResumeContent(composition.output, snapshot, () => "id", new Map(), composition);
    const overview = tailoringOverview({
      jobTitle: "Junior Software Developer",
      content,
      snapshot,
      requirements: developerAnalysis().requirements,
    });
    expect(overview.strategy).toContain("The emphasis for this application is");
    expect(overview.strategy).toContain("RoleRefine");
  });
});

describe("editorial doubts", () => {
  it("asks for an edit when a lead is missing and stays quiet when the draft matches", () => {
    const snapshot = hootsuiteSnapshot();
    const missing = developerDraft();
    missing.entries = missing.entries.filter((entry) => entry.ref !== "E_role");
    missing.plan = plan([
      { ref: "E_role", use: "lead", bullets: 2, because: "The product is the lead." },
      { ref: "E_def", use: "support", bullets: 1, because: "The internship supports it." },
    ]);
    const missingGuard = validateTailorOutput(missing, snapshot, developerAnalysis());
    expect(editorialDoubts({ output: missingGuard.output, snapshot }).map((item) => item.code)).toContain(
      "lead_missing",
    );
    expect(revisionRoute({ output: missingGuard.output, snapshot, analysis: developerAnalysis() }).kind).toBe(
      "editorial",
    );

    const matched = developerDraft();
    matched.plan = plan([
      { ref: "E_role", use: "lead", bullets: 2, because: "The product is the lead." },
      { ref: "E_def", use: "lead", bullets: 2, because: "The internship is also direct evidence." },
    ]);
    const matchedGuard = validateTailorOutput(matched, snapshot, developerAnalysis());
    const doubts = editorialDoubts({ output: matchedGuard.output, snapshot });
    expect(doubts.filter((item) => item.code !== "close_call")).toEqual([]);

    const thin = developerDraft();
    thin.entries = thin.entries.map((entry) =>
      entry.ref === "E_role"
        ? { ref: "E_role", bullets: [{ sourceRefs: ["E_role.B1"], text: "Built a live full-stack SaaS product." }] }
        : entry,
    );
    thin.plan = plan([
      { ref: "E_role", use: "lead", bullets: 2, because: "The product should keep a second implementation line." },
      { ref: "E_def", use: "support", bullets: 2, because: "The internship supports it." },
    ]);
    const thinGuard = validateTailorOutput(thin, snapshot, developerAnalysis());
    expect(editorialDoubts({ output: thinGuard.output, snapshot }).map((item) => item.code)).toContain(
      "lead_thin",
    );
  });

  it("flags a close call and a support entry that crowds the lead", () => {
    const snapshot = hootsuiteSnapshot();
    const crowded = developerDraft();
    crowded.entries = [
      {
        ref: "E_role",
        bullets: [{ sourceRefs: ["E_role.B1"], text: "Built and deployed the product." }],
      },
      {
        ref: "E_def",
        bullets: [
          { sourceRefs: ["E_def.B1"], text: "Developed React features." },
          { sourceRefs: ["E_def.B2"], text: "Tested those features." },
          { sourceRefs: ["E_def.B3"], text: "Reviewed pull requests." },
        ],
      },
    ];
    crowded.plan = plan([
      { ref: "E_role", use: "lead", bullets: 1, because: "The product leads." },
      { ref: "E_def", use: "support", bullets: 1, because: "The internship is support." },
    ]);
    crowded.plan = { ...crowded.plan!, closeCall: true };
    const guard = validateTailorOutput(crowded, snapshot, developerAnalysis());
    const codes = editorialDoubts({ output: guard.output, snapshot }).map((item) => item.code);
    expect(codes).toContain("support_crowds");
    expect(codes).toContain("close_call");
  });

  it("does not treat a shared keyword as a doubt when no strategy was returned", () => {
    const snapshot = hootsuiteSnapshot();
    const output = developerDraft();
    const guard = validateTailorOutput(output, snapshot, developerAnalysis());
    expect(editorialDoubts({ output: guard.output, snapshot })).toEqual([]);
  });

  it("keeps the narrow revision path when the draft has no strategy", () => {
    const snapshot = hootsuiteSnapshot();
    const guard = validateTailorOutput(analystDraft(), snapshot, developerAnalysis());
    expect(revisionRoute({ output: guard.output, snapshot, analysis: developerAnalysis() }).kind).toBe("entries");
  });

  it("rejects an editorial pass that the guard reverted", () => {
    const first = validateTailorOutput(developerDraft(), hootsuiteSnapshot(), developerAnalysis()).output;
    const reverted: ValidatedTailorOutput = {
      ...first,
      entries: [
        {
          ref: "E_role",
          bullets: [
            {
              sourceRefs: ["E_role.B1"],
              text: "Built the product for 40 teams.",
              reverted: true,
            },
          ],
        },
      ],
    };
    expect(acceptEditorial(first, reverted).accepted).toBe(false);

    const swapped: ValidatedTailorOutput = {
      ...first,
      summary: first.summary,
      entries: first.entries.filter((entry) => entry.ref !== "E_edu"),
    };
    const accepted = acceptEditorial(first, swapped);
    expect(accepted.accepted).toBe(true);
    expect(accepted.output.entries.map((entry) => entry.ref)).not.toContain("E_edu");
  });
});
