import { describe, expect, it } from "vitest";

import { settlePageLength } from "@/features/tailor/page-fit";
import { TailorOptions, type ResumeContent } from "@/features/tailor/schemas";
import { tailoringOverview } from "@/features/tailor/overview";

import { contentBullet, jobAnalysis, librarySnapshot, resumeContent } from "./tailor-fixture";

const LONG =
  "Reconciled weekly source files in Excel and wrote the SQL extract the team used for the monthly report.";

function includedText(content: ResumeContent, ref: string): string[] {
  return (
    content.entries
      .find((entry) => entry.ref === ref)
      ?.bullets.filter((bullet) => bullet.included)
      .map((bullet) => bullet.text) ?? []
  );
}

function resume(filler: number): ResumeContent {
  return resumeContent({
    pageLimit: 2,
    plan: {
      narrative: "Reporting and reconciliation.",
      priorities: ["SQL"],
      gaps: [],
      evidence: [
        { ref: "E1", use: "lead", bullets: 2, because: "The reporting work is the strongest evidence." },
        { ref: "E4", use: "omit", bullets: 0, because: "Retail does not strengthen this application." },
      ],
    },
    entries: [
      {
        ref: "E1",
        kind: "EXPERIENCE",
        included: true,
        bullets: [
          contentBullet({ id: "lead-1", text: "Built and maintained 14 reports for a 20-person team.", sourceRefs: ["E1.B1"] }),
          contentBullet({ id: "lead-2", text: "Cut prep time from 2 days to 3 hours.", sourceRefs: ["E1.B2"] }),
        ],
      },
      {
        ref: "E4",
        kind: "EXPERIENCE",
        included: true,
        bullets: Array.from({ length: filler }, (_, index) =>
          contentBullet({
            id: `fill-${index}`,
            text: LONG,
            sourceRefs: ["E4.B1"],
          }),
        ),
      },
    ],
  });
}

describe("automatic resume length", () => {
  it("defaults to automatic and still accepts an explicit maximum", () => {
    expect(TailorOptions.parse({}).length).toBe("auto");
    expect(TailorOptions.parse({ length: 1 }).length).toBe(1);
    expect(TailorOptions.parse({ length: 2 }).length).toBe(2);
  });

  it("keeps a short resume on one page", async () => {
    const snapshot = librarySnapshot();
    const settled = await settlePageLength(resume(0), snapshot, "auto");
    expect(settled.pageLimit).toBe(1);
    expect(includedText(settled, "E1")).toHaveLength(2);
    expect(settled.review?.some((item) => item.reason === "auto_one_page")).toBe(true);
    const overview = tailoringOverview({
      jobTitle: "Analyst",
      content: settled,
      snapshot,
      requirements: jobAnalysis().requirements,
    });
    expect(overview.decisions.some((item) => item.body.includes("one page"))).toBe(true);
  });

  it("does not drop the lead to clear a second page", async () => {
    const settled = await settlePageLength(resume(28), librarySnapshot(), "auto");
    expect(includedText(settled, "E1")).toEqual([
      "Built and maintained 14 reports for a 20-person team.",
      "Cut prep time from 2 days to 3 hours.",
    ]);
    expect(settled.pageLimit === 1 || settled.pageLimit === 2).toBe(true);
    if (settled.pageLimit === 2) {
      expect(
        settled.review?.some((item) => item.reason === "auto_two_pages" || item.reason === "auto_kept_sparse"),
      ).toBe(true);
    }
  }, 40000);

  it("leaves an explicit two-page maximum as a ceiling", async () => {
    const settled = await settlePageLength(resume(0), librarySnapshot(), 2);
    expect(settled.pageLimit).toBe(2);
    expect(settled.review?.some((item) => item.reason === "auto_one_page") ?? false).toBe(false);
    expect(includedText(settled, "E1")).toHaveLength(2);
  });
});
