import mammoth from "mammoth";
import { describe, expect, it } from "vitest";

import { assembleResumeContent } from "@/features/tailor/assemble";
import { canonicalizeCareer } from "@/features/tailor/canonical";
import { applyResumeEdit, preserveUserEdits } from "@/features/tailor/content";
import { composeResume } from "@/features/tailor/compose";
import { resumePlainText } from "@/features/tailor/plainText";
import { resumeQuality } from "@/features/tailor/quality";
import { ResumeContent } from "@/features/tailor/schemas";
import { tailoringOverview } from "@/features/tailor/overview";
import { validateTailorOutput } from "@/features/tailor/validate";
import type { LibrarySnapshot } from "@/features/library/schemas";
import { renderResumeDocx } from "@/lib/docx/resume";
import { fitResumePdf } from "@/lib/pdf/render";
import { resumePdfLines, resumePdfModel } from "@/lib/pdf/model";

import {
  dataEngineerAnalysis,
  defHacksConfirmation,
  editorialSnapshot,
  intuitAnalysis,
  intuitOutput,
  retailAnalysis,
  retailOutput,
  stuffedDataOutput,
} from "./tailor-editorial-fixture";

function ids() {
  let next = 1;
  return () => `id-${next++}`;
}

function composeCase(
  output: ReturnType<typeof stuffedDataOutput>,
  analysis: ReturnType<typeof dataEngineerAnalysis>,
  confirmations = [defHacksConfirmation],
) {
  const snapshot = editorialSnapshot();
  const guard = validateTailorOutput(output, snapshot, analysis);
  const composition = composeResume({
    output: guard.output,
    snapshot,
    analysis,
    length: 2,
    confirmations,
  });
  const content = assembleResumeContent(composition.output, snapshot, ids(), new Map(), composition);
  return { snapshot, guard, composition, content };
}

function included(content: ReturnType<typeof assembleResumeContent>, ref: string) {
  return content.entries.find((entry) => entry.ref === ref && entry.included);
}

describe("editorial scenarios", () => {
  it("builds one data-engineering resume from duplicate and irrelevant records", async () => {
    const { snapshot, guard, content } = composeCase(stuffedDataOutput(), dataEngineerAnalysis());
    const text = resumePlainText(content, snapshot);
    const cra = included(content, "E_cra");
    const craBullets = cra?.bullets.filter((bullet) => bullet.included) ?? [];

    expect(included(content, "E_cra_long")).toBeUndefined();
    expect(cra?.displayTitle).toBe("Junior Program Officer");
    expect(cra?.displayOrganization).toBe("Canada Revenue Agency");
    expect(text).toContain("Junior Program Officer");
    expect(text).not.toContain("Special Business Returns Processing");
    expect(craBullets.filter((bullet) => bullet.text.includes("20"))).toHaveLength(1);
    expect(craBullets.some((bullet) => bullet.sourceRefs.includes("E_cra.B2"))).toBe(true);
    expect(craBullets.some((bullet) => bullet.sourceRefs.includes("E_cra_long.B2"))).toBe(true);
    expect(cra?.evidenceEntryRefs).toContain("E_cra_long");
    const edited = structuredClone(content);
    const kept = edited.entries
      .find((entry) => entry.ref === "E_cra")
      ?.bullets.find((bullet) => bullet.sourceRefs.includes("E_cra_long.B2"));
    if (kept) kept.text = "Kept the special-returns reconciliation line.";
    const saved = applyResumeEdit({
      stored: content,
      incoming: edited,
      snapshot,
      aiOutput: guard.output,
    });
    expect(saved.ok).toBe(true);
    if (saved.ok) {
      expect(saved.content.headline).toBe(content.headline);
      expect(
        saved.content.entries
          .find((entry) => entry.ref === "E_cra")
          ?.bullets.some((bullet) => bullet.text.startsWith("Kept the special-returns")),
      ).toBe(true);
    }
    expect(text.toLowerCase()).not.toContain("etl");
    expect(text.toLowerCase()).not.toContain("erp");
    expect(guard.reverts).toBeGreaterThan(0);

    expect(included(content, "E_def_copy")).toBeUndefined();
    expect(included(content, "E_def")?.displayStart).toBe("2020-03");
    expect(included(content, "E_def")?.displayEnd).toBe("2021-03");
    expect(text).toContain("Mar 2020 \u2013 Mar 2021");

    expect(included(content, "E_lcbo")).toBeUndefined();
    expect(included(content, "E_py")).toBeDefined();
    expect(included(content, "E_role")?.displayTitle).toBe("RoleRefine");
    expect(text).toContain("RoleRefine");
    expect(text).not.toContain("Creator, Product Owner");
    expect(included(content, "E_forge")).toBeUndefined();
    expect(included(content, "E_jobwise")).toBeUndefined();
    expect(text).not.toContain("Google Maps");

    const quality = resumeQuality(content, snapshot);
    expect(quality.duplicateEmployers).toBe(0);
    expect(quality.awkwardHeadings).toBe(0);
    expect(quality.repeatedQuantities).toBe(0);
    expect(quality.includedBullets).toBeLessThan(16);
    expect(content.headline).toBe("Reporting and reconciliation");
    expect(content.pageLimit).toBe(2);
    expect(content.headline).not.toBe(snapshot.profile.headline);

    const model = resumePdfModel(content, snapshot);
    const lines = resumePdfLines(model);
    expect(resumePlainText(content, snapshot).split("\n")).toEqual(lines);
    const docx = await mammoth.extractRawText({ buffer: await renderResumeDocx(model) });
    expect(docx.value).toContain("RoleRefine");
    expect(docx.value).toContain("Junior Program Officer");
    expect(docx.value).not.toContain("Creator, Product Owner");
    const fit = await fitResumePdf(model, "classic");
    expect(fit.pageCount).toBeLessThanOrEqual(2);
    expect(fit.pageCount).toBe(1);

    const overview = tailoringOverview({
      jobTitle: "Data Engineer",
      content,
      snapshot,
      requirements: dataEngineerAnalysis().requirements,
    });
    expect(overview.decisions.some((item) => item.id === "length")).toBe(true);
    expect(overview.decisions.some((item) => item.body.includes("ETL") || item.id === "gaps")).toBe(true);
  });

  it("tells a different story for a software role and keeps retail when the job is retail", () => {
    const data = composeCase(stuffedDataOutput(), dataEngineerAnalysis());
    const software = composeCase(intuitOutput(), intuitAnalysis());
    const retail = composeCase(retailOutput(), retailAnalysis());

    const dataRole = included(data.content, "E_role")?.bullets.filter((bullet) => bullet.included).length ?? 0;
    const softwareRole =
      included(software.content, "E_role")?.bullets.filter((bullet) => bullet.included).length ?? 0;
    expect(softwareRole).toBeGreaterThan(dataRole);
    expect(software.content.headline).toBe("Application developer");
    expect(software.content.headline).not.toBe(data.content.headline);
    expect(included(software.content, "E_lcbo")).toBeUndefined();
    expect(included(software.content, "E_def_copy")).toBeUndefined();
    expect(included(software.content, "E_forge")).toBeUndefined();
    expect(included(software.content, "E_jobwise")).toBeDefined();
    expect(resumePlainText(software.content, software.snapshot).toLowerCase()).not.toContain("etl");

    expect(included(retail.content, "E_lcbo")).toBeDefined();
    expect(included(retail.content, "E_cra")).toBeUndefined();
    expect(resumeQuality(software.content, software.snapshot).duplicateEmployers).toBe(0);
  });

  it("keeps distinct evidence from duplicate imports and leaves a promotion split", () => {
    const snapshot = duplicateSnapshot();
    const analysis = dataEngineerAnalysis();
    analysis.requirements = [
      { id: "r1", text: "Reconcile ledger files", kind: "experience", importance: "must" },
    ];
    analysis.keywords = ["ledger", "reconcile"];
    const output: ReturnType<typeof stuffedDataOutput> = {
      summary: "Analyst who reconciles files.",
      plan: {
        narrative: "Two uploads describe one analyst role.",
        priorities: ["ledger"],
        gaps: [],
        headline: "Ledger reconciliation",
        evidence: [
          { ref: "E_a", use: "lead", bullets: 3, because: "The two uploads are one stint and both facts belong on it." },
          { ref: "E_junior", use: "support", bullets: 1, because: "The earlier title is a separate job." },
          { ref: "E_senior", use: "support", bullets: 1, because: "The promotion is not the same stint as the junior title." },
        ],
        closeCall: false,
      },
      entries: [
        {
          ref: "E_a",
          bullets: [
            { sourceRefs: ["E_a.B1"], text: "Reconciled 12 weekly ledger files." },
            { sourceRefs: ["E_b.B2"], text: "Closed the month-end ledger." },
          ],
        },
        {
          ref: "E_b",
          bullets: [{ sourceRefs: ["E_b.B1"], text: "Reconciled 12 weekly ledger files by hand." }],
        },
        {
          ref: "E_junior",
          bullets: [{ sourceRefs: ["E_junior.B1"], text: "Filed junior case notes." }],
        },
        {
          ref: "E_senior",
          bullets: [{ sourceRefs: ["E_senior.B1"], text: "Reviewed senior case notes." }],
        },
      ],
      skills: [],
      requirementMatches: [
        {
          requirementId: "r1",
          verdict: "partial",
          evidenceRefs: ["E_a.B1"],
          note: "The analyst role reconciles a ledger.",
        },
      ],
    };
    const without = validateTailorOutput(output, snapshot, analysis);
    const open = composeResume({
      output: without.output,
      snapshot,
      analysis,
      length: 1,
    });
    expect(open.output.entries.map((entry) => entry.ref)).toEqual(
      expect.arrayContaining(["E_a", "E_b"]),
    );
    expect(open.review).toEqual(
      expect.arrayContaining([expect.objectContaining({ reason: "unresolved_dates" })]),
    );

    const guard = validateTailorOutput(output, snapshot, analysis, [["E_a", "E_b"]]);
    const composition = composeResume({
      output: guard.output,
      snapshot,
      analysis,
      length: 1,
      confirmations: [{ members: ["E_a", "E_b"], startDate: "2019-01", endDate: "2019-06" }],
    });
    const refs = composition.output.entries.map((entry) => entry.ref);
    const analystRefs = refs.filter((ref) => ref === "E_a" || ref === "E_b");
    expect(analystRefs).toHaveLength(1);
    const analyst = composition.output.entries.find(
      (entry) => entry.ref === "E_a" || entry.ref === "E_b",
    );
    const texts = analyst?.bullets.map((bullet) => bullet.text) ?? [];
    expect(texts.some((text) => text.includes("month-end"))).toBe(true);
    expect(texts.filter((text) => text.includes("12"))).toHaveLength(1);
    expect(refs).toEqual(expect.arrayContaining(["E_junior", "E_senior"]));
    const rejected = canonicalizeCareer(snapshot.entries, snapshot.takenAt, [
      { members: ["E_junior", "E_senior"], title: "Software Engineer" },
    ]);
    expect(rejected.rejected).toEqual([["E_junior", "E_senior"]]);
    expect(rejected.stints.some((stint) => stint.members.includes("E_junior") && stint.members.includes("E_senior"))).toBe(
      false,
    );
  });

  it("keeps an older saved resume readable and does not overwrite an edit", () => {
    const older = ResumeContent.parse({
      schemaVersion: 1,
      summary: { text: "Kept summary.", included: true },
      entries: [
        {
          ref: "E1",
          kind: "EXPERIENCE",
          included: true,
          bullets: [
            {
              id: "b1",
              text: "Original line.",
              included: true,
              sourceRefs: ["E1.B1"],
              reverted: false,
              edited: false,
            },
          ],
        },
      ],
      skills: [],
    });
    expect(older.headline).toBeUndefined();
    expect(older.entries[0]?.displayTitle).toBeUndefined();

    const { content, snapshot } = composeCase(stuffedDataOutput(), dataEngineerAnalysis());
    const previous = {
      ...content,
      entries: content.entries.map((entry) => ({
        ...entry,
        bullets: entry.bullets.map((bullet) =>
          bullet.sourceRefs.includes("E_py.B1")
            ? { ...bullet, text: "Edited Python line.", edited: true }
            : bullet,
        ),
      })),
    };
    const again = composeCase(stuffedDataOutput(), dataEngineerAnalysis()).content;
    const kept = preserveUserEdits(again, previous, null);
    const python = kept.entries
      .flatMap((entry) => entry.bullets)
      .find((bullet) => bullet.sourceRefs.includes("E_py.B1") && bullet.included);
    expect(python?.text).toBe("Edited Python line.");
    expect(resumePdfModel(older, snapshot).headline).toBe("Software developer");
  });
});

function duplicateSnapshot(): LibrarySnapshot {
  const base = editorialSnapshot();
  return {
    ...base,
    entries: [
      {
        ref: "E_a",
        id: "E_a",
        kind: "EXPERIENCE",
        title: "Analyst",
        organization: "Northwind",
        location: null,
        startDate: "2019-01",
        endDate: "2019-06",
        isCurrent: false,
        url: null,
        bullets: [{ ref: "E_a.B1", id: "E_a.B1", text: "Reconciled 12 weekly ledger files." }],
      },
      {
        ref: "E_b",
        id: "E_b",
        kind: "EXPERIENCE",
        title: "Analyst",
        organization: "Northwind",
        location: null,
        startDate: "2020-01",
        endDate: "2020-06",
        isCurrent: false,
        url: null,
        bullets: [
          { ref: "E_b.B1", id: "E_b.B1", text: "Reconciled 12 weekly ledger files by hand." },
          { ref: "E_b.B2", id: "E_b.B2", text: "Closed the month-end ledger." },
        ],
      },
      {
        ref: "E_junior",
        id: "E_junior",
        kind: "EXPERIENCE",
        title: "Junior Software Engineer",
        organization: "Northwind",
        location: null,
        startDate: "2021-01",
        endDate: "2021-12",
        isCurrent: false,
        url: null,
        bullets: [{ ref: "E_junior.B1", id: "E_junior.B1", text: "Filed junior case notes." }],
      },
      {
        ref: "E_senior",
        id: "E_senior",
        kind: "EXPERIENCE",
        title: "Senior Software Engineer",
        organization: "Northwind",
        location: null,
        startDate: "2022-01",
        endDate: null,
        isCurrent: true,
        url: null,
        bullets: [{ ref: "E_senior.B1", id: "E_senior.B1", text: "Reviewed senior case notes." }],
      },
    ],
  };
}
