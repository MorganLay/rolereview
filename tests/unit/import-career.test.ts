import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

vi.mock("mammoth", () => ({
  default: { extractRawText: vi.fn() },
}));

import { strings } from "@/copy/strings";
import { postProcessImport } from "@/features/import/extract";
import type { ImportOutput } from "@/lib/ai/prompts/import";
import { SYSTEM } from "@/lib/ai/prompts/import";
import { planDispositions } from "@/features/tailor/plan-completeness";

const fixtures = path.join(process.cwd(), "benchmarks", "fixtures", "candidates");
const warnings = strings.library.import.warnings;

function resume(id: string): string {
  return readFileSync(path.join(fixtures, id, "original-resume.txt"), "utf8");
}

function experienceLine(id: string): string {
  const line = resume(id).split(/\n/).find((item) => item.startsWith("Experience:"));
  return line?.replace(/^Experience:\s*/, "") ?? "";
}

function draft(entries: ImportOutput["entries"]): ImportOutput {
  return {
    profile: {
      fullName: null,
      headline: null,
      email: null,
      phone: null,
      location: null,
      links: [],
      summary: null,
    },
    entries,
    skills: [],
    warnings: [],
  };
}

function role(
  title: string,
  bullets: string[],
  extra: Partial<ImportOutput["entries"][number]> = {},
): ImportOutput["entries"][number] {
  return {
    kind: "EXPERIENCE",
    title,
    organization: null,
    location: null,
    startDate: null,
    endDate: null,
    isCurrent: false,
    url: null,
    bullets,
    ...extra,
  };
}

function jobs(result: ReturnType<typeof postProcessImport>) {
  return result.entries.filter((entry) => entry.kind === "EXPERIENCE");
}

function text(entry: { title: string; bullets: { text: string }[] }): string {
  return [entry.title, ...entry.bullets.map((bullet) => bullet.text)].join(" ");
}

describe("import career normalization", () => {
  it("asks the extractor to separate jobs that a paragraph already separates", () => {
    expect(SYSTEM).toContain("one EXPERIENCE entry per job");
    expect(SYSTEM).toContain("Do not attach it to the previous job");
  });

  it("splits a P006 paragraph the model returned as one entry", () => {
    const source = resume("P006");
    const result = postProcessImport(
      draft([role("Experience", [experienceLine("P006")])]),
      source,
    );
    const found = jobs(result);
    const current = found.find((job) => job.title.includes("2013–Present"));
    const earlier = found.find((job) => job.title.includes("2010–2013"));
    expect(text(current ?? { title: "", bullets: [] })).toContain("bank recs for 11 subsidiaries");
    expect(text(current ?? { title: "", bullets: [] })).not.toContain("40%→90%");
    expect(text(earlier ?? { title: "", bullets: [] })).toContain("raised collections from 40%→90%");
    expect(text(earlier ?? { title: "", bullets: [] })).not.toContain("11 subsidiaries");
    expect(found.map((job) => job.title)).toEqual([
      "Accountant (2013–Present)",
      "Accountant (2010–2013)",
      "Accountant (2006–2008)",
      "Bookkeeper (2003–2005)",
      "Assistant Bookkeeper (1999–2002)",
    ]);
    for (const job of found) {
      expect(job.organization).toBeNull();
      expect(job.startDate).toBeNull();
      expect(job.isCurrent).toBe(false);
    }
    expect(result.warnings).toContain(warnings.careerSplit);
  });

  it("moves a P011 discharge sentence off the teaching entry", () => {
    const source = resume("P011");
    const result = postProcessImport(
      draft([
        role("Teacher (08/2015–07/2017)", [
          "designed standards-aligned syllabi and lessons, delivered instruction, maintained constructive relationships with students and parents, and collaborated to improve classroom environments.",
          "coordinate safe newborn and maternal discharges, arrange follow-ups and equipment, complete case records and connect families to community resources.",
        ]),
      ]),
      source,
    );
    const found = jobs(result);
    const teaching = found.find((job) => job.title.startsWith("Teacher"));
    const discharge = found.find((job) => job.title.startsWith("Social Services"));
    expect(text(teaching ?? { title: "", bullets: [] })).toContain("delivered instruction");
    expect(text(teaching ?? { title: "", bullets: [] })).not.toContain("newborn");
    expect(text(discharge ?? { title: "", bullets: [] })).toContain("newborn and maternal discharges");
    expect(result.warnings).toContain(warnings.movedDuty);
  });

  it("does not leave P012 nursing-aide work on the teaching entry", () => {
    const source = resume("P012");
    const result = postProcessImport(
      draft([
        role(
          "Teacher (Jan–Mar 2016)",
          [
            "classroom instruction, child care, healthy learning environment.",
            "basic patient care, transport, safe living conditions.",
            "cared for 99 patients",
          ],
          { organization: "General Hospital", startDate: "1999", isCurrent: true },
        ),
      ]),
      source,
    );
    const found = jobs(result);
    const teaching = found.find((job) => job.title.startsWith("Teacher"));
    const aide = found.find((job) => job.title.startsWith("Nursing Aide"));
    expect(text(teaching ?? { title: "", bullets: [] })).toContain("classroom instruction");
    expect(text(teaching ?? { title: "", bullets: [] })).not.toContain("patient care");
    expect(text(teaching ?? { title: "", bullets: [] })).not.toContain("99");
    expect(text(aide ?? { title: "", bullets: [] })).toContain("basic patient care");
    expect(text(aide ?? { title: "", bullets: [] })).not.toContain("classroom instruction");
    expect(teaching?.organization).toBeNull();
    expect(teaching?.startDate).toBeNull();
    expect(teaching?.isCurrent).toBe(false);
    expect(found.some((job) => job.title.startsWith("Cook"))).toBe(true);
    expect(found.some((job) => job.title.startsWith("Front Desk"))).toBe(true);
    expect(result.warnings).toContain(warnings.inventedLine);
    expect(result.warnings).toContain(warnings.organizationUnknown);

    const decided = planDispositions(
      found.map((job, index) => ({ ref: `E${index + 1}` })),
      [
        { ref: "E1", use: "lead" },
        { ref: "E2", use: "support" },
        { ref: "E3", use: "omit" },
        { ref: "E4", use: "omit" },
      ],
    );
    expect(decided.map((row) => row.disposition)).toEqual([
      "include",
      "include",
      "omit",
      "omit",
    ]);
  });

  it("keeps P014 grant work and mixed prior roles off the current job", () => {
    const source = resume("P014");
    const result = postProcessImport(
      draft([
        role("Administrative Assistant, School of Education (07/2013–Present)", [
          "exec support to Dean; calendars/meetings; faculty support; supervise student worker; payroll; budgets (UG/Grad); POs; accounting; travel.",
          "manage Title III/PECO grant budgets/POs; streamline book loan.",
          "Prior admin roles in sign shop (1999–2004) and medical office (1998–1999).",
        ]),
      ]),
      source,
    );
    const found = jobs(result);
    const current = found.find((job) => job.title.includes("School of Education"));
    const grants = found.find((job) => job.title.includes("Student Affairs"));
    const earlier = found.filter(
      (job) => job.title.includes("sign shop") || job.title.includes("medical office"),
    );
    expect(text(current ?? { title: "", bullets: [] })).not.toContain("Title III/PECO");
    expect(text(grants ?? { title: "", bullets: [] })).toContain("Title III/PECO grant");
    expect(earlier).toHaveLength(1);
    expect(text(earlier[0] ?? { title: "", bullets: [] })).toContain("sign shop");
    expect(text(earlier[0] ?? { title: "", bullets: [] })).toContain("medical office");
    expect(text(current ?? { title: "", bullets: [] })).not.toContain("sign shop");
  });

  it("does not split a list of titles that share one description", () => {
    const source = resume("P018");
    const result = postProcessImport(
      draft([
        role("Substitute Teacher (2014–2015)", [
          "expertise in HR, operations, training, and finance.",
        ]),
        role("HR Manager (2014)", ["expertise in HR, operations, training, and finance."]),
      ]),
      source,
    );
    const found = jobs(result);
    expect(found).toHaveLength(1);
    expect(text(found[0] ?? { title: "", bullets: [] })).toContain("Substitute Teacher");
    expect(text(found[0] ?? { title: "", bullets: [] })).toContain("HR Manager");
    expect(text(found[0] ?? { title: "", bullets: [] })).toContain("expertise in HR");
    expect(result.warnings).toContain(warnings.ambiguousRole);
  });
});
