import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { looseTokenSupported, guardDraft, tenureIsStated } from "../../benchmarks/lib/grounded-guard";
import { chooseDegreeHeading, clipHeadline, presentedText, printedTitle } from "../../benchmarks/lib/present";
import { moveWrongEntry, remapSavedDraft } from "../../benchmarks/write-verify/replay";
import { alternativePresent, mustKeepScore } from "../../benchmarks/write-verify/must-keep";
import { coverageGaps } from "../../benchmarks/write-verify/coverage";
import { GOLD, goldFor, phraseOverlaps, scoreGold } from "../../benchmarks/write-verify/verify-meaning";
import type { ResumeContent } from "@/features/tailor/schemas";
import { readFittedCases } from "../../benchmarks/lib/paid";
import { factTokens, factsKeptIn, sectionPresent, summaryFragment } from "../../benchmarks/write-verify/measure";
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

  it("gives every fixture with a skills line at least one skill ref", () => {
    const ids = readdirSync(fixtures).filter((id) => {
      const file = path.join(fixtures, id, "original-resume.txt");
      return /^skills:/im.test(readFileSync(file, "utf8"));
    });
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      const adapted = adaptFixtureResume(resume(id));
      expect(evidenceGaps(adapted.snapshot, adapted.spans), id).toEqual([]);
      expect(adapted.snapshot.skills.length, id).toBeGreaterThan(0);
    }
    const designer = adaptFixtureResume(resume("P017"));
    expect(designer.snapshot.skills.some((skill) => /final cut pro/i.test(skill.name))).toBe(true);
  });

  it("prints a parsed year range once", () => {
    const job = adaptFixtureResume(resume("P014")).snapshot.entries.find((entry) => entry.title.includes("School of Education"));
    expect(job?.startDate).toBe("2013-07");
    expect(job && printedTitle(job)).not.toMatch(/2013/);
    expect(job?.title).toMatch(/2013/);
  });

  it("prints rankings under Recognition as bullets", () => {
    const adapted = adaptFixtureResume(resume("P013"));
    const other = adapted.snapshot.entries.find((entry) => entry.kind === "OTHER");
    expect(other?.title).toBe("");
    expect(other?.bullets.length).toBeGreaterThan(0);
    const text = presentedText(contentFor(other ? [other.ref] : [], adapted.snapshot), adapted.snapshot);
    expect(text).toMatch(/^Recognition/m);
    expect(text).toMatch(/- Ranked #1 Account Executive/);
    expect(text.split("\n").filter((line) => /Ranked #1/.test(line) && !line.trim().startsWith("-"))).toEqual([]);
  });

  it("drops an education line that only restates the title", () => {
    const snapshot = library({
      entries: [
        row({
          ref: "E1",
          kind: "EDUCATION",
          title: "B.A. History",
          startDate: "2014-01",
          endDate: "2018-05",
          bullets: [
            { ref: "E1.B1", id: "E1.B1", text: "B.A. History" },
            { ref: "E1.B2", id: "E1.B2", text: "State University, cum laude" },
          ],
        }),
      ],
    });
    const text = presentedText(contentFor(["E1"], snapshot), snapshot);
    expect(text).toMatch(/B\.A\. History/);
    expect(text).not.toMatch(/- B\.A\. History/);
    expect(text).toMatch(/State University, cum laude/);
  });

  it("clips a headline on a word boundary", () => {
    const long = "Executive administrative professional with higher-education leadership support, budgeting, and process improvement experience";
    const clipped = clipHeadline(long);
    expect(clipped.length).toBeLessThanOrEqual(90);
    expect(clipped.endsWith("exper")).toBe(false);
    expect(clipped.startsWith("Executive administrative professional")).toBe(true);
    expect(clipHeadline("Accountant")).toBe("Accountant");
  });

  it("prints one line when the only education line restates the title", () => {
    const snapshot = library({
      entries: [
        row({
          ref: "E1",
          kind: "EDUCATION",
          title: "BA, Hebert H. Lehman College (2012) with fine arts/psychology coursework",
          bullets: [
            {
              ref: "E1.B1",
              id: "E1.B1",
              text: "Earned a BA from Hebert H. Lehman College (2012) with fine arts and psychology coursework.",
            },
          ],
        }),
      ],
    });
    const text = presentedText(contentFor(["E1"], snapshot), snapshot);
    expect(text).toMatch(/Hebert H\. Lehman College/);
    expect(text).not.toMatch(/^- /m);
  });

  it("does not print a different degree under another degree's heading", () => {
    expect(chooseDegreeHeading("B.S. Business Administration, Albright College", ["M.S. (2016)", "B.S. Business Administration, Albright College"])).toMatch(/M\.S/);
    const snapshot = library({
      entries: [
        row({
          ref: "E1",
          kind: "EDUCATION",
          title: "M.A. in Math Education, Southwestern University",
          bullets: [
            {
              ref: "E1.B1",
              id: "E1.B1",
              text: "M.A. in Education, Philippine Normal University (2000); B.A. in Secondary Education, Cum Laude (1994).",
            },
          ],
        }),
      ],
    });
    const text = presentedText(contentFor(["E1"], snapshot), snapshot);
    const lines = text.split(/\n/).filter((line) => line.trim().length > 0);
    const philippine = lines.find((line) => /Philippine/.test(line)) ?? "";
    expect(philippine.startsWith("-")).toBe(false);
    expect(text).toMatch(/Southwestern University/);
    expect(text).toMatch(/B\.A\. in Secondary Education/);
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

  it("keeps an ampersand education heading as its own section", () => {
    expect(isDirectHeading("EDUCATION & CERTIFICATES")).toBe(true);
    expect(isDirectHeading("TEACHING EXPERIENCE")).toBe(true);
    expect(isDirectHeading("RELATED EXPERIENCE")).toBe(true);
    const document = baselineDocument(
      ["SUMMARY", "Designer with 20 years of work.", "EXPERIENCE", "Designer | 2010 – Present", "- Built a site.", "EDUCATION & CERTIFICATES", "BA, Lehman College"].join("\n"),
    );
    const education = document.snapshot.entries.filter((entry) => entry.kind === "EDUCATION");
    expect(education.map((entry) => entry.title)).toEqual(["EDUCATION & CERTIFICATES", "BA, Lehman College"]);
    expect(document.snapshot.entries.some((entry) => entry.kind === "EXPERIENCE" && entry.title.includes("Lehman"))).toBe(false);
    const rendered = resumePlainText(document.content, document.snapshot);
    expect(sectionPresent(rendered, "education")).toBe(true);
    expect(sectionPresent("SKILLS AND RECOGNITION\nCommunication", "skills")).toBe(true);
  });
});

describe("matcher precision", () => {
  const analysis = {
    title: "Role",
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

  it("does not flag case, spacing, hyphen, or a trailing plural", () => {
    expect(looseTokenSupported("kWh", ["Reduced use to 2.0kwh/ton."])).toBe(true);
    expect(looseTokenSupported("70E", ["Trained on NFPA 70Es."])).toBe(true);
    expect(looseTokenSupported("MAS 200", ["Reconciled MAS200."])).toBe(true);
    const energy = guardDraft(
      draftOn("E1", "Reduced use to 2.0 kWh per ton."),
      library({
        entries: [row({ ref: "E1", title: "Operator", bullets: [{ ref: "E1.B1", id: "E1.B1", text: "Reduced use to 2.0kwh/ton." }] })],
      }),
      analysis,
      "C",
    );
    expect(energy.flags).toEqual([]);
    const licence = guardDraft(
      draftOn("E1", "Trained the crew on NFPA 70E."),
      library({
        entries: [row({ ref: "E1", title: "Electrician", bullets: [{ ref: "E1.B1", id: "E1.B1", text: "Trained the crew on NFPA 70Es." }] })],
      }),
      analysis,
      "C",
    );
    expect(licence.flags).toEqual([]);
  });

  it("does not flag a tenure the library states", () => {
    const snapshot = library({
      entries: [row({ ref: "E1", title: "Technician", bullets: [{ ref: "E1.B1", id: "E1.B1", text: "7+ yrs on the bench." }] })],
    });
    expect(tenureIsStated("Technician with 7+ years on the bench.", snapshot)).toBe(true);
    const flagged = guardDraft(
      { ...draftOn("E1", "Kept the bench running."), summary: "Technician with 7+ years on the bench." },
      snapshot,
      analysis,
      "C",
    );
    expect(flagged.flags.some((flag) => flag.token === "tenure" || /year/i.test(flag.token))).toBe(false);
    const long = library({
      entries: [row({ ref: "E1", title: "Manager", bullets: [{ ref: "E1.B1", id: "E1.B1", text: "About ~19 years in the field." }] })],
    });
    expect(tenureIsStated("Manager with ~19 years in the field.", long)).toBe(true);
  });

  it("does not flag a term that is in the title or organization", () => {
    const flagged = guardDraft(
      draftOn("E1", "Priced the bids in Timberline."),
      library({
        entries: [row({ ref: "E1", title: "Timberline Estimator", organization: "Northwind", bullets: [{ ref: "E1.B1", id: "E1.B1", text: "Priced the bids." }] })],
      }),
      analysis,
      "C",
    );
    expect(flagged.flags).toEqual([]);
  });

  it("marks a number from another entry as wrong-entry and does not delete it", () => {
    const snapshot = library({
      entries: [
        row({ ref: "E1", title: "Account Executive", organization: "Apparel Co", bullets: [{ ref: "E1.B1", id: "E1.B1", text: "Sold medical apparel." }] }),
        row({
          ref: "E2",
          kind: "OTHER",
          title: "",
          bullets: [{ ref: "E2.B1", id: "E2.B1", text: "Maintained <1% client churn." }],
        }),
      ],
    });
    const draft = draftOn("E1", "Held client churn under 1%.");
    const flagged = guardDraft(draft, snapshot, analysis, "C");
    const flag = flagged.flags.find((item) => item.code === "wrong-entry");
    expect(flag?.home).toBe("E2");
    expect(flagged.output.entries[0]?.bullets[0]?.text).toContain("1%");
    const moved = moveWrongEntry(draft, flagged.flags);
    expect(moved.draft.entries.find((entry) => entry.ref === "E1")?.bullets).toEqual([]);
    expect(moved.draft.entries.find((entry) => entry.ref === "E2")?.bullets[0]?.text).toContain("1%");
  });

  it("retargets a saved draft when the skills line is no longer an entry", () => {
    const snapshot = library({
      skills: [{ ref: "S1", id: "S1", name: "Final Cut Pro", category: null }],
      entries: [row({ ref: "E1", title: "Graphic Designer (1998–2002)", bullets: [{ ref: "E1.B1", id: "E1.B1", text: "Designed graphics for tees." }] })],
    });
    const libraryText = [
      "E1 | OTHER | Final Cut Pro | — | — | —",
      "E2 | EXPERIENCE | Graphic Designer (1998–2002) | — | — | —",
      "  E2.B1 id=E2.B1: Designed graphics for tees.",
      "SKILLS",
    ].join("\n");
    const draft = draftOn("E2", "Designed graphics for tees and labels.");
    const remapped = remapSavedDraft(draft, snapshot, libraryText);
    expect(remapped.entries.map((entry) => entry.ref)).toEqual(["E1"]);
    expect(remapped.entries[0]?.bullets[0]?.sourceRefs).toEqual(["E1.B1"]);
  });
});

describe("meaning check scoring", () => {
  it("counts the 31 audited lines and matches a quoted phrase", () => {
    expect(GOLD).toHaveLength(31);
    expect(goldFor("W2")).toHaveLength(12);
    expect(goldFor("direct")).toHaveLength(19);
    expect(phraseOverlaps("with discretion and coordinating faculty support", "with discretion")).toBe(true);
    expect(phraseOverlaps("prepared monthly financial statements", "to track business performance")).toBe(false);
    const scored = scoreGold(
      "P014-J055",
      [{ lineId: "E2#2", phrase: "with discretion", reason: "The source does not say discretion." }],
      goldFor("W2"),
    );
    expect(scored.hit.filter(Boolean)).toHaveLength(1);
    expect(scored.missed).toHaveLength(2);
  });
});

describe("must-keep matching", () => {
  it("requires every group and uses word boundaries", () => {
    expect(alternativePresent("nearly two decades of work", "19 years")).toBe(false);
    expect(alternativePresent("About 19 years in the role.", "19 years")).toBe(true);
    const score = mustKeepScore("Held SARS drills and a timberline licence.", [
      { label: "SARS", allOf: [["sars"]] },
      { label: "Timberline", allOf: [["timberline"]] },
      { label: "Both", allOf: [["sars"], ["missing"]] },
    ]);
    expect(score.missing).toEqual(["Both"]);
  });

  it("lists a quantified clause that is absent from the page", () => {
    const snapshot = library({
      skills: [{ ref: "S1", id: "S1", name: "Timberline", category: null }],
      entries: [row({ ref: "E1", title: "Estimator", bullets: [{ ref: "E1.B1", id: "E1.B1", text: "Cut waste by 12%." }] })],
    });
    expect(coverageGaps(snapshot, "Estimator who priced jobs.")).toEqual(["E1.B1: Cut waste by 12%.", "S1: Timberline"]);
    expect(coverageGaps(snapshot, "Cut waste by 12% with Timberline.")).toEqual([]);
  });
});

function library(partial: Partial<LibrarySnapshot> & Pick<LibrarySnapshot, "entries">): LibrarySnapshot {
  return {
    takenAt: "2026-11-14T00:00:00.000Z",
    profile: { fullName: "Alex Example", headline: null, email: "", phone: null, location: null, links: [], summary: null },
    skills: [],
    ...partial,
  };
}

function row(partial: Partial<LibrarySnapshot["entries"][number]> & Pick<LibrarySnapshot["entries"][number], "ref" | "title">): LibrarySnapshot["entries"][number] {
  return {
    id: partial.ref,
    kind: "EXPERIENCE",
    organization: null,
    location: null,
    startDate: null,
    endDate: null,
    isCurrent: false,
    url: null,
    bullets: [],
    ...partial,
  };
}

function draftOn(ref: string, text: string): TailorOutput {
  return {
    summary: "Kept the work moving.",
    entries: [{ ref, bullets: [{ sourceRefs: [`${ref}.B1`], text }] }],
    skills: [],
    requirementMatches: [],
  };
}

function contentFor(refs: string[], snapshot: LibrarySnapshot): ResumeContent {
  return {
    schemaVersion: 1,
    summary: { text: "Summary.", included: true },
    skills: [],
    entries: refs.map((ref) => {
      const source = snapshot.entries.find((entry) => entry.ref === ref);
      return {
        ref,
        kind: source?.kind ?? "EXPERIENCE",
        included: true,
        bullets: (source?.bullets ?? []).map((bullet) => ({
          id: bullet.ref,
          text: bullet.text,
          included: true,
          sourceRefs: [bullet.ref],
          reverted: false,
          edited: false,
          originalText: null,
          suggestion: null,
          suggestionNote: null,
          changeWhat: null,
          requirementIds: [],
        })),
      };
    }),
  };
}

function plainLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-•*]\s+/, "").replace(/\s+/g, " "))
    .filter((line) => line.length > 0);
}
