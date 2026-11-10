import { describe, expect, it } from "vitest";

import type { Requirement } from "@/features/jobs/schemas";
import type { LibrarySnapshot } from "@/features/library/schemas";
import { assembleResumeContent } from "@/features/tailor/assemble";
import { applyResumeEdit, preserveUserEdits } from "@/features/tailor/content";
import {
  applyAcceptedRepairs,
  mergeRepair,
  repairTargets,
} from "@/features/tailor/repair";
import { tailoringOverview } from "@/features/tailor/overview";
import { bulletReview, tailorDigest, wordDiff } from "@/features/tailor/review";
import type { TailorOutput } from "@/features/tailor/schemas";
import { validateTailorOutput } from "@/features/tailor/validate";
import type { BulletNote } from "@/features/tailor/variants";

import { jobAnalysis, librarySnapshot } from "./tailor-fixture";

const EXCEL =
  "Merge and transform data across multiple sources in Excel using key-based joins; investigate and resolve discrepancies to ensure integrity and consistency of reporting outputs.";
const EXCEL_REWRITE =
  "Consolidated and transformed multi-source datasets using Excel and key-based joins, resolving data discrepancies to improve reporting accuracy and data reliability.";

function ids() {
  let next = 1;
  return () => `id-${next++}`;
}

function analystLibrary(): LibrarySnapshot {
  const snapshot = librarySnapshot();
  const entry = snapshot.entries[0];
  if (!entry) throw new Error("missing entry");
  entry.bullets[0] = {
    ref: "E1.B1",
    id: "b1",
    text: EXCEL,
  };
  return snapshot;
}

function outputFor(snapshot: LibrarySnapshot, bullets: TailorOutput["entries"][number]["bullets"]): TailorOutput {
  return {
    summary: "Reporting analyst who consolidates multi-source data in Excel and writes Python tools.",
    entries: [
      { ref: "E1", bullets },
      {
        ref: "E2",
        bullets: [{ sourceRefs: ["E2.B1"], text: "Wrote a Python bot that booked rooms." }],
      },
      { ref: "E3", bullets: [] },
      { ref: "E5", bullets: [] },
    ],
    skills: [{ category: "Languages", refs: ["S1", "S2"] }],
    requirementMatches: [],
  };
}

describe("autonomous tailoring", () => {
  it("applies a grounded rewrite and leaves the library bullet unchanged", () => {
    const snapshot = analystLibrary();
    const before = snapshot.entries[0]?.bullets[0]?.text;
    const notes = new Map<string, BulletNote>([
      [
        "E1.B1",
        {
          what: "Leads with consolidation and drops the trailing clause.",
          why: "The posting asks for data transformation and reporting accuracy.",
          requirementIds: ["r-transform"],
        },
      ],
    ]);
    const requirements: Requirement[] = [
      {
        id: "r-transform",
        text: "Transform data from more than one source",
        kind: "experience",
        importance: "must",
      },
    ];
    const guard = validateTailorOutput(
      outputFor(snapshot, [{ sourceRefs: ["E1.B1"], text: EXCEL_REWRITE }]),
      snapshot,
      jobAnalysis(requirements),
    );
    const content = assembleResumeContent(guard.output, snapshot, ids(), notes);
    const bullet = content.entries[0]?.bullets[0];

    expect(guard.reverts).toBe(0);
    expect(bullet?.text).toBe(EXCEL_REWRITE);
    expect(bullet?.suggestion).toBe(EXCEL_REWRITE);
    expect(bullet?.originalText).toBe(EXCEL);
    expect(bullet?.suggestionNote).toContain("data transformation");
    expect(bullet?.changeWhat).toContain("consolidation");
    expect(snapshot.entries[0]?.bullets[0]?.text).toBe(before);
    expect(bulletReview(bullet!, EXCEL, requirements)).toMatchObject({
      state: "applied",
      requirements: ["Transform data from more than one source"],
    });
  });

  it("reverts an ETL claim and can accept a later grounded repair", () => {
    const snapshot = analystLibrary();
    const requirements: Requirement[] = [
      {
        id: "r-etl",
        text: "5 years of production ETL",
        kind: "experience",
        importance: "must",
      },
    ];
    const before: TailorOutput = {
      ...outputFor(snapshot, [
        {
          sourceRefs: ["E1.B1"],
          text: "Built production ETL pipelines in Spark for enterprise reporting.",
        },
      ]),
      requirementMatches: [
        {
          requirementId: "r-etl",
          verdict: "met",
          evidenceRefs: ["E1.B1"],
          note: "The spreadsheet work covers ETL.",
        },
      ],
    };
    const guard = validateTailorOutput(before, snapshot, jobAnalysis(requirements));
    const targets = repairTargets(before, guard, snapshot);
    expect(guard.output.entries[0]?.bullets[0]?.text).toBe(EXCEL);
    expect(guard.output.entries[0]?.bullets[0]?.reverted).toBe(true);
    expect(guard.output.requirementMatches[0]?.verdict).toBe("partial");
    expect(targets.map((target) => target.sourceRef)).toEqual(["E1.B1"]);

    const repaired = mergeRepair(
      before,
      [{ sourceRef: "E1.B1", text: EXCEL_REWRITE, what: "Keeps Excel.", why: "Transformation only." }],
      targets,
    );
    const second = validateTailorOutput(repaired, snapshot, jobAnalysis(requirements));
    const chosen = applyAcceptedRepairs(guard.output, second.output, targets);
    expect(chosen.accepted).toEqual(["E1.B1"]);
    expect(chosen.output.entries[0]?.bullets[0]?.text).toBe(EXCEL_REWRITE);
    expect(chosen.output.entries[0]?.bullets[0]?.reverted).toBe(false);

    const stillFalse = validateTailorOutput(
      mergeRepair(
        before,
        [
          {
            sourceRef: "E1.B1",
            text: "Owned production ETL pipelines.",
            what: "Says ETL.",
            why: "The posting asks for ETL.",
          },
        ],
        targets,
      ),
      snapshot,
      jobAnalysis(requirements),
    );
    const rejected = applyAcceptedRepairs(guard.output, stillFalse.output, targets);
    expect(rejected.accepted).toEqual([]);
    expect(rejected.output.entries[0]?.bullets[0]?.text).toBe(EXCEL);
  });

  it("keeps a close role specific without rewriting a line that is already exact", () => {
    const snapshot = librarySnapshot();
    const source = snapshot.entries[0]?.bullets[0]?.text ?? "";
    const guard = validateTailorOutput(
      outputFor(snapshot, [{ sourceRefs: ["E1.B1"], text: source }]),
      snapshot,
      jobAnalysis([
        { id: "r1", text: "Maintain operational reports", kind: "experience", importance: "must" },
      ]),
    );
    const content = assembleResumeContent(guard.output, snapshot, ids());
    const bullet = content.entries[0]?.bullets[0];
    expect(bullet?.text).toBe(source);
    expect(bullet?.suggestion).toBeNull();
    expect(bulletReview(bullet!, source).state).toBe("none");
  });

  it("does not turn reporting into a support desk for a weak match", () => {
    const snapshot = analystLibrary();
    const requirements: Requirement[] = [
      { id: "r-desk", text: "Help desk and ticketing", kind: "experience", importance: "must" },
      { id: "r-years", text: "3 years of customer support", kind: "experience", importance: "must" },
    ];
    const guard = validateTailorOutput(
      {
        ...outputFor(snapshot, [
          {
            sourceRefs: ["E1.B1"],
            text: "Provided customer support on the help desk and closed 12 tickets a week.",
          },
        ]),
        summary: "Technology support specialist with 5 years on a service desk.",
        requirementMatches: [
          {
            requirementId: "r-desk",
            verdict: "met",
            evidenceRefs: ["E1.B1"],
            note: "Reporting users are a help desk.",
          },
          {
            requirementId: "r-years",
            verdict: "met",
            evidenceRefs: ["E1.B1"],
            note: "The role implies support.",
          },
        ],
      },
      snapshot,
      jobAnalysis(requirements),
    );
    const bullet = guard.output.entries[0]?.bullets[0];
    expect(bullet?.reverted).toBe(true);
    expect(bullet?.text).toBe(EXCEL);
    expect(bullet?.text.toLowerCase()).not.toContain("help desk");
    expect(guard.output.requirementMatches.every((match) => match.verdict !== "met")).toBe(true);
    expect(guard.output.summary.toLowerCase()).not.toContain("5 years");
  });

  it("hides a stale explanation after a manual edit and keeps the source", () => {
    const snapshot = analystLibrary();
    const requirements: Requirement[] = [
      {
        id: "r-transform",
        text: "Transform data from more than one source",
        kind: "experience",
        importance: "must",
      },
    ];
    const notes = new Map<string, BulletNote>([
      [
        "E1.B1",
        {
          what: "Leads with consolidation.",
          why: "The posting asks for data transformation.",
          requirementIds: ["r-transform"],
        },
      ],
    ]);
    const guard = validateTailorOutput(
      outputFor(snapshot, [{ sourceRefs: ["E1.B1"], text: EXCEL_REWRITE }]),
      snapshot,
      jobAnalysis(requirements),
    );
    const stored = assembleResumeContent(guard.output, snapshot, ids(), notes);
    const incoming = structuredClone(stored);
    const target = incoming.entries[0]?.bullets[0];
    if (!target) throw new Error("missing bullet");
    target.text = "Joined Excel tables and checked the figures by hand.";
    const saved = applyResumeEdit({
      stored,
      incoming,
      snapshot,
      aiOutput: guard.output,
    });
    if (!saved.ok) throw new Error(saved.issue);
    const bullet = saved.content.entries[0]?.bullets[0];
    expect(bullet?.sourceRefs).toEqual(["E1.B1"]);
    expect(bullet?.suggestion).toBe(EXCEL_REWRITE);
    expect(bulletReview(bullet!, EXCEL, requirements)).toMatchObject({
      state: "edited",
      why: null,
      what: null,
    });

    const restored = { ...bullet!, text: EXCEL };
    expect(bulletReview(restored, EXCEL, requirements).state).toBe("restored");
    const again = { ...bullet!, text: EXCEL_REWRITE };
    expect(bulletReview(again, EXCEL, requirements).state).toBe("applied");
  });

  it("keeps a manual edit on the next tailor", () => {
    const snapshot = analystLibrary();
    const guard = validateTailorOutput(
      outputFor(snapshot, [{ sourceRefs: ["E1.B1"], text: EXCEL_REWRITE }]),
      snapshot,
      jobAnalysis(),
    );
    const previous = assembleResumeContent(guard.output, snapshot, ids());
    const edited = previous.entries[0]?.bullets[0];
    if (!edited) throw new Error("missing bullet");
    edited.text = "Checked Excel joins by hand.";
    edited.edited = true;
    const next = assembleResumeContent(
      validateTailorOutput(
        outputFor(snapshot, [
          {
            sourceRefs: ["E1.B1"],
            text: "Consolidated Excel data with key-based joins.",
          },
        ]),
        snapshot,
        jobAnalysis(),
      ).output,
      snapshot,
      ids(),
    );
    const kept = preserveUserEdits(next, previous, guard.output);
    expect(kept.entries[0]?.bullets[0]?.text).toBe("Checked Excel joins by hand.");
    expect(snapshot.entries[0]?.bullets[0]?.text).toBe(EXCEL);
  });

  it("counts the finished resume without inventing a percentage", () => {
    const snapshot = analystLibrary();
    const requirements: Requirement[] = [
      {
        id: "r-transform",
        text: "Transform data from more than one source",
        kind: "experience",
        importance: "must",
      },
      {
        id: "r-sql",
        text: "SQL",
        kind: "skill",
        importance: "must",
      },
    ];
    const guard = validateTailorOutput(
      {
        ...outputFor(snapshot, [{ sourceRefs: ["E1.B1"], text: EXCEL_REWRITE }]),
        requirementMatches: [
          {
            requirementId: "r-transform",
            verdict: "met",
            evidenceRefs: ["E1.B1"],
            note: "Excel joins transform data.",
          },
          {
            requirementId: "r-sql",
            verdict: "partial",
            evidenceRefs: ["S2"],
            note: "SQL is a skill, not shown in the bullet.",
          },
        ],
      },
      snapshot,
      jobAnalysis(requirements),
    );
    const content = assembleResumeContent(guard.output, snapshot, ids());
    const digest = tailorDigest({
      content,
      snapshot,
      requirements,
      verdicts: guard.output.requirementMatches,
      keywords: ["Excel", "SQL"],
    });
    expect(digest.rewritten).toBeGreaterThan(0);
    expect(digest.summaryUpdated).toBe(true);
    const overview = tailoringOverview({
      jobTitle: "Data Engineer",
      content,
      snapshot,
      requirements,
    });
    expect(overview.strategy.startsWith("The summary was rewritten for Data Engineer")).toBe(true);
    expect(overview.strategy).not.toContain("%");
    const text = JSON.stringify(overview);
    expect(text).toContain("Rewritten from the library bullet.");
    expect(text).not.toMatch(/need review|not demonstrated|match score/i);
  });

  it("highlights words that were added or removed", () => {
    const parts = wordDiff(
      "Merge and transform data in Excel.",
      "Consolidated and transformed data in Excel.",
    );
    expect(parts.some((part) => part.kind === "add" && part.text.includes("Consolidated"))).toBe(
      true,
    );
    expect(parts.some((part) => part.kind === "remove" && part.text.includes("Merge"))).toBe(
      true,
    );
  });
});
