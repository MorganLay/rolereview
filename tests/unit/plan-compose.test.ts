import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { assembleResumeContent } from "@/features/tailor/assemble";
import { composeResume } from "@/features/tailor/compose";
import type { LibrarySnapshot } from "@/features/library/schemas";
import type { JobAnalysis } from "@/features/jobs/schemas";
import { resumePlainText } from "@/features/tailor/plainText";
import { pageCeiling, type ResumeContent, type ValidatedTailorOutput } from "@/features/tailor/schemas";

import { fitResume } from "../../benchmarks/lib/fit";
import { loadCase } from "../../benchmarks/lib/load";
import { phraseMatch } from "../../benchmarks/lib/phrases";
import {
  coverageDiscrepancies,
  experimentalComposition,
  type DraftEntry,
  type PlanRow,
} from "../../benchmarks/lib/plan-compose";

const CACHE = path.join(process.cwd(), "benchmarks", "results", "paid-2026-11-13T05-26-08-670Z");

const dean =
  "Provide executive support to the Dean, managing calendars and meetings, and support faculty and supervise a student worker.";
const payroll =
  "Administer payroll, undergraduate and graduate budgets, purchase orders, accounting and travel for the School of Education.";
const vp =
  "Supported the Dean/VP, maintained judiciary files, and oversaw staff scheduling and front-desk operations, including training.";
const grant = "Managed Title III and PECO grant budgets and purchase orders.";

const plan: PlanRow[] = [
  { ref: "E3", use: "lead", bullets: 2, because: "Current role shows calendars, budgets, and payroll." },
  { ref: "E4", use: "support", bullets: 3, because: "Shows the Dean/VP, judiciary files, and grant budgets." },
  { ref: "E5", use: "support", bullets: 1, because: "Adds length of administrative history." },
  {
    ref: "E2",
    use: "omit",
    bullets: 0,
    because: "Skills entry is represented in the skills section instead of as a heading.",
  },
];

function snapshot(): LibrarySnapshot {
  return {
    takenAt: "2026-11-13T00:00:00.000Z",
    profile: {
      fullName: "Alex Example",
      headline: null,
      email: "alex@example.com",
      phone: null,
      location: null,
      links: [],
      summary: null,
    },
    skills: [],
    entries: [
      experience("E3", "Administrative Assistant, School of Education (07/2013–Present)", true, [
        "exec support to Dean; calendars/meetings; faculty support; supervise student worker; payroll; budgets (UG/Grad); POs; accounting; travel.",
      ]),
      experience("E4", "Administrative Assistant, Student Affairs (01/2005–01/2011)", false, [
        "support Dean/VP; judiciary files; service metrics; staff scheduling; front-desk oversight/training; SARS admin; call center; manage Title III/PECO grant budgets/POs; streamline book loan",
      ]),
      experience("E5", "Prior admin roles in sign shop (1999–2004) and medical office (1998–1999).", false, []),
      {
        ref: "E2",
        id: "E2",
        kind: "OTHER",
        title: "Skills",
        organization: null,
        location: null,
        startDate: null,
        endDate: null,
        isCurrent: false,
        url: null,
        bullets: [
          {
            ref: "E2.B1",
            id: "E2.B1",
            text: "Microsoft Office (Word/Excel/PowerPoint/Access/Visio/Publisher), Datatel, PowerCampus, Blackboard, SARS (admin/trainer), ImageNow, Siemens call center. Budgeting, payroll, purchasing, grants, FERPA compliance, scheduling, reporting, front-desk ops, customer service, hiring/training, process streamlining.",
          },
        ],
      },
    ],
  };
}

function experience(
  ref: string,
  title: string,
  isCurrent: boolean,
  bullets: string[],
): LibrarySnapshot["entries"][number] {
  return {
    ref,
    id: ref,
    kind: "EXPERIENCE",
    title,
    organization: null,
    location: null,
    startDate: null,
    endDate: null,
    isCurrent,
    url: null,
    bullets: bullets.map((text, index) => ({ ref: `${ref}.B${index + 1}`, id: `${ref}.B${index + 1}`, text })),
  };
}

function analysis(): JobAnalysis {
  return {
    title: "Senior Executive Assistant",
    company: "Example",
    location: null,
    seniority: "senior",
    workMode: "UNKNOWN",
    employmentType: null,
    salary: null,
    referenceNumber: null,
    summary: "Support two executives.",
    requirements: [],
    keywords: ["calendar", "budget"],
  };
}

function output(sourceMode: "shared" | "separate"): ValidatedTailorOutput {
  const e3Second = sourceMode === "shared" ? "E3.B1" : "E3.B2";
  return {
    summary: "Executive support, budgets, payroll, and travel.",
    plan: {
      narrative: "Executive support with budgets and grants.",
      priorities: ["Executive support"],
      gaps: [],
      evidence: plan,
    },
    skills: [],
    requirementMatches: [],
    entries: [
      {
        ref: "E3",
        bullets: [
          { sourceRefs: ["E3.B1"], text: dean, reverted: false },
          { sourceRefs: [e3Second], text: payroll, reverted: false },
        ],
      },
      {
        ref: "E4",
        bullets: [
          { sourceRefs: ["E4.B1"], text: vp, reverted: false },
          { sourceRefs: ["E4.B1"], text: grant, reverted: false },
        ],
      },
      { ref: "E5", bullets: [] },
    ],
  };
}

function separateSnapshot(): LibrarySnapshot {
  const base = snapshot();
  const current = base.entries[0];
  if (!current) return base;
  current.bullets = [
    { ref: "E3.B1", id: "E3.B1", text: current.bullets[0]?.text ?? "" },
    {
      ref: "E3.B2",
      id: "E3.B2",
      text: "payroll; budgets (UG/Grad); POs; accounting; travel for the School of Education.",
    },
  ];
  return base;
}

describe("production composition drop", () => {
  it("drops a second line that cites the same library bullet, before the page is measured", () => {
    expect(pageCeiling("auto")).toBe(2);
    const library = snapshot();
    const composition = composeResume({
      output: output("shared"),
      snapshot: library,
      analysis: analysis(),
      length: "auto",
    });
    const e3 = composition.output.entries.find((entry) => entry.ref === "E3");
    const e4 = composition.output.entries.find((entry) => entry.ref === "E4");
    expect(e3?.bullets.map((bullet) => bullet.text)).toEqual([dean]);
    expect(e4?.bullets.map((bullet) => bullet.text)).toEqual([vp]);
    expect(composition.output.entries.some((entry) => entry.ref === "E5")).toBe(false);
    expect(composition.review.filter((item) => item.code === "BULLET_PREFERENCE")).toEqual([]);
    expect(composition.review.find((item) => item.ref === "E5")).toMatchObject({
      code: "ENTRY_EXCLUDED",
      reason: "page_budget",
    });
  });

  it("keeps both lines when they cite different library bullets", () => {
    const composition = composeResume({
      output: output("separate"),
      snapshot: separateSnapshot(),
      analysis: analysis(),
      length: "auto",
    });
    const e3 = composition.output.entries.find((entry) => entry.ref === "E3");
    expect(e3?.bullets.map((bullet) => bullet.text)).toEqual([dean, payroll]);
  });
});

describe("experimental composition", () => {
  function composed(): ResumeContent {
    const library = snapshot();
    const composition = composeResume({
      output: output("shared"),
      snapshot: library,
      analysis: analysis(),
      length: "auto",
    });
    return assembleResumeContent(composition.output, library, sequence(), new Map(), composition);
  }

  const draft: DraftEntry[] = [
    { ref: "E3", bullets: [dean, payroll] },
    { ref: "E4", bullets: [vp, grant] },
    { ref: "E5", bullets: [] },
  ];

  it("puts the distinct grounded lines back and still honors the omit", () => {
    const library = snapshot();
    const result = experimentalComposition({
      content: composed(),
      snapshot: library,
      draft,
      plan,
    });
    const text = resumePlainText(result.content, library);
    expect(text).toContain(payroll);
    expect(text).toContain(grant);
    expect(text).toContain("Prior admin roles in sign shop");
    expect(text).not.toContain("FERPA");
    expect(result.decisions.filter((item) => item.outcome === "restored").map((item) => item.text)).toEqual([
      payroll,
      grant,
    ]);
    expect(result.decisions.some((item) => item.ref === "E2" && item.outcome === "omitted")).toBe(true);
    expect(result.content.entries.find((entry) => entry.ref === "E2")?.included).toBe(false);
  });

  it("does not let a lead row keep an unsupported number or a repeated line", () => {
    const library = snapshot();
    const content = composed();
    const other = content.entries.find((entry) => entry.ref === "E4");
    other?.bullets.push({
      id: "copied",
      text: "Raised collections from 40% to 90%.",
      included: true,
      sourceRefs: ["E4.B1"],
      reverted: false,
      edited: false,
      originalText: null,
      suggestion: null,
      suggestionNote: null,
      changeWhat: null,
      requirementIds: [],
    });
    const result = experimentalComposition({
      content,
      snapshot: library,
      draft: [
        { ref: "E3", bullets: [dean, "Raised collections from 40% to 90%."] },
        { ref: "E4", bullets: [vp] },
      ],
      plan,
    });
    expect(result.decisions.find((item) => item.text?.includes("40%"))?.outcome).toBe("unsupported");
    expect(resumePlainText(result.content, library).match(/40%/g) ?? []).toHaveLength(1);
  });

  it("reports a skills-section claim that the resume does not meet", () => {
    const library = snapshot();
    const resume = `${dean}\n${payroll}\n${vp}\n${grant}\nWorks in Microsoft Office tools including Word, Excel, PowerPoint, Access, Visio and Publisher.`;
    const discrepancies = coverageDiscrepancies({ plan, snapshot: library, resumeText: resume });
    expect(discrepancies).toHaveLength(1);
    expect(discrepancies[0]?.destination).toBe("skills section");
    expect(discrepancies[0]?.missing.join(" ")).toContain("FERPA");
    expect(discrepancies[0]?.missing.join(" ")).not.toContain("Microsoft Office");
    expect(discrepancies[0]?.proposal).toContain("Keep E2 omitted");
    expect(discrepancies[0]?.proposal).toContain("FERPA compliance");
    expect(discrepancies[0]?.proposal).toContain("not part of this correction");
    const shown = coverageDiscrepancies({
      plan: [
        {
          ref: "E5",
          use: "omit",
          bullets: 0,
          because: "Older role, and E3 and E4 already show JEs and close.",
        },
      ],
      snapshot: library,
      resumeText: "Posted journal entries and cut the monthly close.",
    });
    expect(shown).toEqual([]);
  });
});

describe("cached plan-faithful comparison", () => {
  it.skipIf(!existsSync(CACHE))("fits the current and experimental resumes from the saved drafts", async () => {
    const directory = path.join(process.cwd(), "benchmarks", "results", "plan-compose-2026-11-13");
    mkdirSync(directory, { recursive: true });
    const lines: string[] = [
      "# Plan-faithful composition experiment",
      "",
      "No model call. Both versions use the normalized library and the saved draft from `paid-2026-11-13T05-26-08-670Z`. Production compose was not changed.",
      "",
      "Automatic page ceiling in compose is 2 (`pageCeiling(\"auto\")`). The bullet cap at that ceiling is 22 and the line estimate starts at 10 and allows 84. The dropped grant and payroll lines were not over either cap.",
      "",
    ];

    for (const caseId of ["P014-J055", "P006-J047"]) {
      const trace = JSON.parse(readFileSync(path.join(CACHE, `${caseId}.trace.json`), "utf8")) as {
        plan: { evidence: PlanRow[] };
        entriesBeforeCompose: DraftEntry[];
      };
      const fitInput = JSON.parse(readFileSync(path.join(CACHE, `${caseId}.fit-input.json`), "utf8")) as {
        role: { content: ResumeContent; snapshot: LibrarySnapshot };
      };
      const testCase = loadCase(caseId);
      const experiment = experimentalComposition({
        content: fitInput.role.content,
        snapshot: fitInput.role.snapshot,
        draft: trace.entriesBeforeCompose,
        plan: trace.plan.evidence,
      });
      const before = resumePlainText(experiment.content, fitInput.role.snapshot);
      const current = await fitResume(fitInput.role.content, fitInput.role.snapshot);
      const next = await fitResume(experiment.content, fitInput.role.snapshot);
      const coverage = coverageDiscrepancies({
        plan: trace.plan.evidence,
        snapshot: fitInput.role.snapshot,
        resumeText: next.text,
      });
      const restored = experiment.decisions.filter((item) => item.outcome === "restored").map((item) => item.text);
      lines.push(
        `## ${caseId}`,
        "",
        `Current page: ${current.pageLimit ?? "unmeasured"}, dropped ${current.dropped.length}. ${current.note}`,
        `Experimental page: ${next.pageLimit ?? "unmeasured"}, dropped ${next.dropped.length}. ${next.note}`,
        "",
        "Decisions:",
        ...experiment.decisions.map((item) => `- ${item.ref} ${item.outcome}: ${item.detail}`),
        "",
        "Coverage:",
        ...(coverage.length === 0
          ? ["- No omit claimed evidence that the fitted resume is missing."]
          : coverage.flatMap((item) => [
              `- ${item.ref} claimed ${item.destination ?? "facts already shown"}. Missing: ${item.missing.join(" | ")}`,
              `- Proposal: ${item.proposal}`,
            ])),
        "",
        "Include phrases on the fitted experimental resume:",
        ...(testCase?.includeEvidence ?? []).map((phrase) => `- ${phrase}: ${phraseMatch(next.text, phrase)}`),
        "",
        "Avoid claims on the fitted experimental resume:",
        ...(testCase?.avoidClaims ?? []).map((phrase) => `- ${phrase}: ${phraseMatch(next.text, phrase)}`),
        "",
        "Experimental resume before page fit:",
        "",
        before,
        "",
        "Experimental resume after page fit:",
        "",
        next.text,
        "",
      );
      expect(current.measured).toBe(true);
      expect(next.measured).toBe(true);
      writeFileSync(
        path.join(directory, `${caseId}.json`),
        JSON.stringify({ current, next, coverage, decisions: experiment.decisions, restored }, null, 2),
      );
      if (caseId === "P014-J055") {
        expect(before).toContain("Title III");
        expect(before).toContain("payroll");
        expect(before).not.toContain("FERPA");
        expect(fitInput.role.snapshot.skills).toEqual([]);
      }
      if (caseId === "P006-J047") {
        const currentRefs = includedRefs(fitInput.role.content);
        const nextRefs = includedRefs(experiment.content);
        expect(nextRefs).toEqual(currentRefs);
        expect(includedBullets(experiment.content)).toEqual(includedBullets(fitInput.role.content));
        expect(next.pageLimit).toBe(current.pageLimit);
      }
    }
    writeFileSync(path.join(directory, "report.md"), lines.join("\n"));
  });
});

function includedRefs(content: ResumeContent): string[] {
  return content.entries.filter((entry) => entry.included).map((entry) => entry.ref);
}

function includedBullets(content: ResumeContent): string[] {
  return content.entries.flatMap((entry) =>
    entry.included ? entry.bullets.filter((bullet) => bullet.included).map((bullet) => bullet.text) : [],
  );
}

function sequence(): () => string {
  let next = 1;
  return () => `id-${next++}`;
}
