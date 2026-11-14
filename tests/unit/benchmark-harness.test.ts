import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { looseTokenSupported, guardDraft } from "../../benchmarks/lib/grounded-guard";
import { readFittedCases } from "../../benchmarks/lib/paid";
import { factTokens, factsKeptIn, summaryFragment } from "../../benchmarks/write-verify/measure";
import type { JobAnalysis } from "@/features/jobs/schemas";
import type { TailorOutput } from "@/features/tailor/schemas";
import { baselineDocument, canonicalHeading, isDirectHeading } from "../../benchmarks/lib/plain-resume";
import { adaptFixtureResume, evidenceGaps } from "../../benchmarks/lib/snapshot";
import { composeModelLed } from "../../benchmarks/model-led/compose";
import type { LibrarySnapshot } from "@/features/library/schemas";
import { resumePlainText } from "@/features/tailor/plainText";

const fixtures = path.join(process.cwd(), "benchmarks", "fixtures", "candidates");
const directRun = path.join(process.cwd(), "benchmarks", "results", "paid-2026-11-13T16-11-06-576Z");

function resume(id: string): string {
  return readFileSync(path.join(fixtures, id, "original-resume.txt"), "utf8");
}

describe("fixture skills and dates", () => {
  it("splits a skills line into refs and keeps a stated qualifier", () => {
    const adapted = adaptFixtureResume(resume("P014"));
    expect(evidenceGaps(adapted.snapshot, adapted.spans)).toEqual([]);
    expect(adapted.snapshot.skills.map((skill) => skill.ref)).toEqual(
      adapted.snapshot.skills.map((_, index) => `S${index + 1}`),
    );
    expect(adapted.snapshot.skills.some((skill) => skill.name === "Microsoft Office (Word/Excel/PowerPoint/Access/Visio/Publisher)")).toBe(true);
    expect(adapted.snapshot.skills.some((skill) => skill.name.includes("FERPA compliance"))).toBe(true);
    expect(adapted.snapshot.skills.some((skill) => /ranked/i.test(skill.name))).toBe(false);
  });

  it("leaves ranking sentences on an other entry", () => {
    const adapted = adaptFixtureResume(resume("P013"));
    expect(evidenceGaps(adapted.snapshot, adapted.spans)).toEqual([]);
    expect(adapted.snapshot.skills.some((skill) => skill.name === "Salesforce")).toBe(true);
    expect(adapted.snapshot.skills.some((skill) => /ranked/i.test(skill.name))).toBe(false);
    const other = adapted.snapshot.entries.filter((entry) => entry.kind === "OTHER");
    const text = other.flatMap((entry) => [entry.title, ...entry.bullets.map((bullet) => bullet.text)]).join(" ");
    expect(text).toMatch(/Ranked #1 Account Executive/);
    expect(text).toMatch(/ranked 6th in FL/);
  });

  it("keeps an award sentence out of the skill list", () => {
    const adapted = adaptFixtureResume(resume("P012"));
    expect(evidenceGaps(adapted.snapshot, adapted.spans)).toEqual([]);
    expect(adapted.snapshot.skills.some((skill) => /salesforce/i.test(skill.name))).toBe(true);
    const other = adapted.snapshot.entries.filter((entry) => entry.kind === "OTHER").flatMap((entry) => [entry.title, ...entry.bullets.map((bullet) => bullet.text)]).join(" ");
    expect(other).toMatch(/Top rep with >80% CSAT/);
    expect(other).toMatch(/award/);
  });

  it("copies one year range from a heading and does not invent a second", () => {
    const school = adaptFixtureResume(["Alex Example", "Education: B.A. History, 2018"].join("\n"));
    expect(school.snapshot.entries[0]?.startDate).toBeNull();
    expect(school.snapshot.entries[0]?.isCurrent).toBe(false);

    const jobs = adaptFixtureResume(resume("P014")).snapshot.entries.filter((entry) => entry.kind === "EXPERIENCE");
    const current = jobs.find((job) => job.title.includes("School of Education"));
    expect(current?.startDate).toBe("2013-07");
    expect(current?.endDate).toBeNull();
    expect(current?.isCurrent).toBe(true);
    const earlier = jobs.find((job) => job.title.includes("Student Affairs"));
    expect(earlier?.startDate).toBe("2005-01");
    expect(earlier?.endDate).toBe("2011-01");
    expect(earlier?.isCurrent).toBe(false);
    const mixed = jobs.find((job) => job.title.includes("sign shop"));
    expect(mixed?.startDate).toBeNull();
    expect(mixed?.endDate).toBeNull();
    expect(mixed?.isCurrent).toBe(false);
  });
});

describe("credential headings", () => {
  it("keeps an education heading that has a title and no lines", () => {
    const snapshot: LibrarySnapshot = {
      takenAt: "2026-11-14T00:00:00.000Z",
      profile: {
        fullName: "Alex Example",
        headline: null,
        email: "",
        phone: null,
        location: null,
        links: [],
        summary: null,
      },
      skills: [],
      entries: [
        {
          ref: "E1",
          id: "E1",
          kind: "EDUCATION",
          title: "B.S. Accountancy, 2006",
          organization: null,
          location: null,
          startDate: null,
          endDate: null,
          isCurrent: false,
          url: null,
          bullets: [],
        },
        {
          ref: "E2",
          id: "E2",
          kind: "CERTIFICATION",
          title: "Electrical Supervisor Licence",
          organization: null,
          location: null,
          startDate: null,
          endDate: null,
          isCurrent: false,
          url: null,
          bullets: [],
        },
        {
          ref: "E3",
          id: "E3",
          kind: "EXPERIENCE",
          title: "Accountant",
          organization: null,
          location: null,
          startDate: null,
          endDate: null,
          isCurrent: false,
          url: null,
          bullets: [],
        },
      ],
    };
    const composed = composeModelLed({
      output: {
        summary: "Accountant.",
        skills: [],
        requirementMatches: [],
        entries: [
          { ref: "E1", bullets: [] },
          { ref: "E2", bullets: [] },
          { ref: "E3", bullets: [] },
        ],
      },
      snapshot,
      decisions: [],
    });
    expect(composed.output.entries.map((entry) => entry.ref)).toEqual(["E1", "E2"]);
    expect(composed.notes.some((note) => note.ref === "E3" && note.action === "missing_draft")).toBe(true);
  });
});

describe("fitted case files", () => {
  it("reads every fitted file in the directory", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "bench-fitted-"));
    const fit = { role: { text: "a", pageLimit: 1, dropped: [], measured: true, note: "ok" }, baseline: { text: "b", pageLimit: 1, dropped: [], measured: true, note: "ok" } };
    writeFileSync(path.join(directory, "P001-J001.fitted.json"), JSON.stringify(fit));
    writeFileSync(path.join(directory, "P017-J043.fitted.json"), JSON.stringify(fit));
    writeFileSync(path.join(directory, "notes.txt"), "not a fit");
    const read = readFittedCases(directory);
    expect([...read.keys()].sort()).toEqual(["P001-J001", "P017-J043"]);
    expect(read.get("P010-J028")).toBeUndefined();
  });
});

describe("relaxed grounding", () => {
  it("treats MAS 200 and MAS200 as the same token and does not revert it", () => {
    expect(looseTokenSupported("MAS200", ["Sage/MAS 200"])).toBe(true);
    expect(looseTokenSupported("NetSuite", ["QuickBooks"])).toBe(false);
    const snapshot: LibrarySnapshot = {
      takenAt: "2026-11-14T00:00:00.000Z",
      profile: {
        fullName: "Alex Example",
        headline: null,
        email: "",
        phone: null,
        location: null,
        links: [],
        summary: null,
      },
      skills: [{ ref: "S1", id: "S1", name: "QuickBooks", category: null }],
      entries: [
        {
          ref: "E1",
          id: "E1",
          kind: "EXPERIENCE",
          title: "Accountant",
          organization: "Northwind",
          location: null,
          startDate: null,
          endDate: null,
          isCurrent: false,
          url: null,
          bullets: [{ ref: "E1.B1", id: "E1.B1", text: "Posted journal entries in Sage/MAS 200." }],
        },
      ],
    };
    const draft: TailorOutput = {
      summary: "Accountant who posted journal entries in MAS200 at Northwind.",
      entries: [
        {
          ref: "E1",
          bullets: [
            { sourceRefs: ["E1.B1"], text: "Posted journal entries in MAS200." },
            { sourceRefs: ["E1.B1"], text: "Posted journal entries in MAS200 for the close." },
            { sourceRefs: ["E1.B1"], text: "Posted journal entries in MAS200 and trained the team." },
          ],
        },
      ],
      skills: [{ category: "Systems", refs: ["S1"] }],
      requirementMatches: [],
    };
    const analysis = {
      title: "Accountant",
      company: "",
      location: null,
      seniority: "unknown",
      workMode: "UNKNOWN",
      employmentType: null,
      salary: null,
      referenceNumber: null,
      summary: "",
      requirements: [],
      keywords: [],
    } as JobAnalysis;
    const relaxed = guardDraft(draft, snapshot, analysis, "B");
    expect(relaxed.output.entries[0]?.bullets).toHaveLength(3);
    expect(relaxed.output.entries[0]?.bullets.every((bullet) => bullet.text.includes("MAS200"))).toBe(true);
    expect(relaxed.reverts).toBe(0);
    const flagged = guardDraft(
      { ...draft, entries: [{ ref: "E1", bullets: [{ sourceRefs: ["E1.B1"], text: "Posted journal entries in NetSuite." }] }] },
      snapshot,
      analysis,
      "C",
    );
    expect(flagged.flags.some((flag) => flag.code === "G13" && flag.token.toLowerCase().includes("netsuite"))).toBe(true);
    expect(flagged.output.entries[0]?.bullets[0]?.text).toContain("NetSuite");
  });

  it("counts digit and capital-letter fact tokens without the fixture preamble", () => {
    const tokens = factTokens("Processed public example. Not a verified applicant.\nPosted 11 JEs in MAS200.");
    expect(tokens).toContain("11");
    expect(tokens).toContain("mas200");
    expect(tokens).not.toContain("processed");
    expect(factsKeptIn(tokens, "Posted eleven journal entries in MAS 200.")).toBe(0);
    expect(factsKeptIn(["11", "mas200"], "Completed 11 entries in MAS200.")).toBe(2);
    expect(factsKeptIn(["40"], "Raised collections from 40–90.")).toBe(1);
    expect(summaryFragment("and closed the books.")).toBe(true);
    expect(summaryFragment("Closed the books.")).toBe(false);
  });
});

describe("direct resume headings", () => {
  it("keeps the sections and lines of two saved direct resumes", () => {
    const missing: string[] = [];
    for (const id of ["P014-J055", "P013-J040"]) {
      const trace = JSON.parse(readFileSync(path.join(directRun, `${id}.trace.json`), "utf8")) as {
        composedText: { baseline: string };
      };
      const raw = trace.composedText.baseline;
      const document = baselineDocument(raw);
      const rendered = plainLines(resumePlainText(document.content, document.snapshot));
      for (const line of plainLines(raw)) {
        if (isDirectHeading(line)) {
          const canonical = canonicalHeading(line);
          const present = rendered.some((item) => item.toLowerCase() === line.toLowerCase())
            || (canonical !== null && rendered.some((item) => item.toLowerCase() === canonical.toLowerCase()));
          if (!present) missing.push(`${id}: ${line}`);
          continue;
        }
        if (!rendered.includes(line)) missing.push(`${id}: ${line}`);
      }
      if (id === "P014-J055") {
        const roles = plainLines(raw).filter((line) => /\s\|\s/.test(line) && /\d{4}/.test(line));
        expect(roles.length).toBeGreaterThan(0);
        for (const role of roles) expect(rendered).toContain(role);
      }
    }
    expect(missing).toEqual([]);
  });
});

function plainLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-•*]\s+/, "").replace(/\s+/g, " "))
    .filter((line) => line.length > 0);
}
