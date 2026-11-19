import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { adaptFixtureResume, evidenceGaps } from "../../benchmarks/lib/snapshot";
import { composeResume } from "@/features/tailor/compose";
import { planDispositions } from "@/features/tailor/plan-completeness";
import { validateTailorOutput } from "@/features/tailor/validate";

import { developerAnalysis, developerDraft, hootsuiteSnapshot } from "./tailor-hootsuite-fixture";

const fixtures = path.join(process.cwd(), "benchmarks", "fixtures", "candidates");

function resume(id: string): string {
  return readFileSync(path.join(fixtures, id, "original-resume.txt"), "utf8");
}

function libraryText(id: string): string {
  const snapshot = adaptFixtureResume(resume(id)).snapshot;
  return [
    ...snapshot.entries.flatMap((entry) => [entry.title, ...entry.bullets.map((bullet) => bullet.text)]),
    ...snapshot.skills.map((skill) => skill.name),
  ].join("\n");
}

describe("fixture evidence stays in the library", () => {
  it("keeps a paragraph-form employment record", () => {
    const adapted = adaptFixtureResume(resume("P006"));
    expect(evidenceGaps(adapted.snapshot, adapted.spans)).toEqual([]);
    const text = libraryText("P006");
    expect(text).toContain("bank recs for 11 subsidiaries");
    expect(text).toContain("managed $10M+ monthly revenue");
    expect(text).toContain("raised collections from 40%→90%");
    expect(text).toContain("QuickBooks");
    const jobs = adapted.snapshot.entries.filter((entry) => entry.kind === "EXPERIENCE");
    expect(jobs.length).toBeGreaterThan(1);
    const present = jobs.find((job) => /Present/i.test(job.title));
    expect(present?.startDate).toBe("2013");
    expect(present?.endDate).toBeNull();
    expect(present?.isCurrent).toBe(true);
    const closed = jobs.find((job) => job.title.includes("2010"));
    expect(closed?.startDate).toBe("2010");
    expect(closed?.endDate).toBe("2013");
    expect(closed?.isCurrent).toBe(false);
  });

  it("keeps a one-line employment record and an education-only profile", () => {
    const sparse = adaptFixtureResume(
      ["Alex Example", "Experience: Cashier 2011–current; apparel, grocery, and front desk."].join("\n"),
    );
    expect(evidenceGaps(sparse.snapshot, sparse.spans)).toEqual([]);
    expect(sparse.snapshot.entries.some((entry) => entry.bullets.some((bullet) => bullet.text.includes("front desk")))).toBe(true);

    const school = adaptFixtureResume(["Alex Example", "Education: B.A. History, 2018"].join("\n"));
    expect(evidenceGaps(school.snapshot, school.spans)).toEqual([]);
    expect(school.snapshot.entries.map((entry) => entry.kind)).toEqual(["EDUCATION"]);
  });

  it("keeps a paragraph under a bulleted role", () => {
    const mixed = adaptFixtureResume(
      [
        "Alex Example",
        "Role | Org",
        "- Kept the bullet",
        "Also wrote a paragraph about the same role that has no dash.",
        "Education: B.A. History",
      ].join("\n"),
    );
    expect(evidenceGaps(mixed.snapshot, mixed.spans)).toEqual([]);
    const role = mixed.snapshot.entries.find((entry) => entry.title === "Role");
    expect(role?.bullets.map((bullet) => bullet.text)).toEqual([
      "Kept the bullet",
      "Also wrote a paragraph about the same role that has no dash.",
    ]);
  });

  it("does not turn a city line into a job, and keeps a credential line", () => {
    const adapted = adaptFixtureResume(resume("P001"));
    expect(evidenceGaps(adapted.snapshot, adapted.spans)).toEqual([]);
    expect(adapted.snapshot.profile.fullName).toBe("Rakesh Sinha");
    const city = adapted.spans.find((span) => span.text === "Jamshedpur");
    expect(city).toMatchObject({ outcome: "unparsed", material: false });
    expect(adapted.snapshot.entries.some((entry) => entry.title === "Jamshedpur")).toBe(false);
    expect(libraryText("P001")).toContain("Electrical Supervisor Licence");
  });

  it("keeps every stored fixture's material lines", () => {
    const ids = readdirSync(fixtures);
    const lost: string[] = [];
    for (const id of ids) {
      const adapted = adaptFixtureResume(resume(id));
      const gaps = evidenceGaps(adapted.snapshot, adapted.spans);
      if (gaps.length > 0) lost.push(`${id}: ${gaps.map((gap) => gap.label).join(", ")}`);
    }
    expect(lost).toEqual([]);
  });

  it("reports a material line the snapshot does not contain", () => {
    const adapted = adaptFixtureResume("Alex Example\nEducation: B.A. History");
    const gaps = evidenceGaps(adapted.snapshot, [
      ...adapted.spans,
      {
        label: "employment",
        text: "Managed a close for 11 subsidiaries.",
        outcome: "unparsed",
        material: true,
        ref: null,
        note: "Dropped.",
        paragraph: null,
        sourceSpan: null,
      },
    ]);
    expect(gaps.map((gap) => gap.text)).toEqual(["Managed a close for 11 subsidiaries."]);
  });
});

function experience(id: string) {
  const adapted = adaptFixtureResume(resume(id));
  return {
    adapted,
    jobs: adapted.snapshot.entries.filter((entry) => entry.kind === "EXPERIENCE"),
  };
}

function blob(entry: { title: string; bullets: { text: string }[] }): string {
  return [entry.title, ...entry.bullets.map((bullet) => bullet.text)].join(" ");
}

describe("employment records stay separate when the source marks them", () => {
  it("attributes P006 collections and reconciliations to different jobs", () => {
    const { adapted, jobs } = experience("P006");
    expect(evidenceGaps(adapted.snapshot, adapted.spans)).toEqual([]);
    const current = jobs.find((job) => job.title.includes("2013"));
    const earlier = jobs.find((job) => job.title.includes("2010"));
    expect(blob(current ?? { title: "", bullets: [] })).toContain("bank recs for 11 subsidiaries");
    expect(blob(current ?? { title: "", bullets: [] })).not.toContain("40%→90%");
    expect(blob(earlier ?? { title: "", bullets: [] })).toContain("raised collections from 40%→90%");
    expect(blob(earlier ?? { title: "", bullets: [] })).not.toContain("11 subsidiaries");
    expect(jobs.map((job) => job.ref).length).toBe(new Set(jobs.map((job) => job.ref)).size);
    const paragraph = adapted.spans.find((span) => span.label === "employment-paragraph");
    expect(paragraph?.paragraph).toBe(paragraph?.text);
    for (const span of adapted.spans.filter((span) => span.sourceSpan && span.paragraph)) {
      expect(span.paragraph).toContain(span.sourceSpan);
    }
    for (const job of jobs) {
      expect(job.organization).toBeNull();
      expect(job.startDate).toMatch(/^\d{4}$/);
      expect(paragraph?.text).toContain(job.title);
    }
  });

  it("keeps P011 teaching distinct from newborn and maternal discharge work", () => {
    const { adapted, jobs } = experience("P011");
    expect(evidenceGaps(adapted.snapshot, adapted.spans)).toEqual([]);
    const teaching = jobs.find((job) => job.title.startsWith("Teacher"));
    const discharge = jobs.find((job) => job.title.startsWith("Social Services"));
    expect(blob(teaching ?? { title: "", bullets: [] })).toContain("delivered instruction");
    expect(blob(teaching ?? { title: "", bullets: [] })).not.toContain("newborn");
    expect(blob(discharge ?? { title: "", bullets: [] })).toContain("newborn and maternal discharges");
    expect(blob(discharge ?? { title: "", bullets: [] })).not.toContain("delivered instruction");
    expect(teaching?.ref).not.toBe(discharge?.ref);
  });

  it("does not place P012 nursing-aide work on the teaching entry", () => {
    const { adapted, jobs } = experience("P012");
    expect(evidenceGaps(adapted.snapshot, adapted.spans)).toEqual([]);
    const teaching = jobs.find((job) => job.title.startsWith("Teacher"));
    const aide = jobs.find((job) => job.title.startsWith("Nursing Aide"));
    expect(blob(teaching ?? { title: "", bullets: [] })).toContain("classroom instruction");
    expect(blob(teaching ?? { title: "", bullets: [] })).not.toContain("patient care");
    expect(blob(aide ?? { title: "", bullets: [] })).toContain("basic patient care");
    expect(blob(aide ?? { title: "", bullets: [] })).not.toContain("classroom instruction");
    expect(teaching?.ref).not.toBe(aide?.ref);
  });

  it("keeps P014 FERPA and the Title III/PECO grant on different entries from the current role", () => {
    const { adapted, jobs } = experience("P014");
    expect(evidenceGaps(adapted.snapshot, adapted.spans)).toEqual([]);
    const current = jobs.find((job) => job.title.includes("School of Education"));
    const grants = jobs.find((job) => job.title.includes("Student Affairs"));
    const earlier = jobs.find((job) => job.title.includes("sign shop"));
    expect(blob(current ?? { title: "", bullets: [] })).not.toContain("Title III/PECO");
    expect(blob(current ?? { title: "", bullets: [] })).not.toContain("FERPA");
    expect(blob(grants ?? { title: "", bullets: [] })).toContain("Title III/PECO grant");
    expect(blob(earlier ?? { title: "", bullets: [] })).toContain("sign shop");
    expect(blob(earlier ?? { title: "", bullets: [] })).toContain("medical office");
    expect(jobs.filter((job) => job.title.includes("sign shop") || job.title.includes("medical office"))).toHaveLength(1);
    expect(adapted.snapshot.skills.some((skill) => skill.name.includes("FERPA compliance"))).toBe(true);
    expect(adapted.snapshot.entries.some((entry) => entry.kind === "OTHER")).toBe(false);
  });

  it("does not repeat a heading as a bullet that adds nothing", () => {
    for (const id of ["P006", "P011", "P012", "P014"]) {
      const adapted = adaptFixtureResume(resume(id));
      for (const entry of adapted.snapshot.entries) {
        if (entry.title.trim().length === 0) continue;
        for (const bullet of entry.bullets) {
          expect(bullet.text).not.toBe(entry.title);
          expect(bullet.text.startsWith(entry.title)).toBe(false);
        }
      }
    }
  });

  it("leaves a list of titles with shared duties as one entry", () => {
    const { jobs } = experience("P018");
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.title).toContain("Substitute Teacher");
    expect(jobs[0]?.title).toContain("HR Manager");
    expect(jobs[0]?.bullets).toEqual([]);
  });
});

describe("plan decisions", () => {
  const entries = [{ ref: "E3" }, { ref: "E13" }];

  it("treats a missing row as unresolved and an omit row as a decision", () => {
    const silent = planDispositions(entries, [
      { ref: "E3", use: "lead" },
    ]);
    expect(silent).toEqual([
      { ref: "E3", disposition: "include" },
      { ref: "E13", disposition: "unresolved" },
    ]);

    const decided = planDispositions(entries, [
      { ref: "E3", use: "lead" },
      { ref: "E13", use: "omit" },
    ]);
    expect(decided.find((row) => row.ref === "E13")?.disposition).toBe("omit");
  });

  it("counts a bullet ref as a decision for its heading", () => {
    const rows = planDispositions([{ ref: "E4" }], [{ ref: "E4.B2", use: "support" }]);
    expect(rows).toEqual([{ ref: "E4", disposition: "include" }]);
  });

  it("leaves an undecided credential off the resume and says so", () => {
    const snapshot = hootsuiteSnapshot();
    snapshot.entries.push({
      ref: "E_licence",
      id: "entry-licence",
      kind: "CERTIFICATION",
      title: "Trade supervisor certificate",
      organization: null,
      location: null,
      startDate: null,
      endDate: null,
      isCurrent: false,
      url: null,
      bullets: [{ ref: "E_licence.B1", id: "b-licence", text: "Trade supervisor certificate" }],
    });
    const output = developerDraft();
    output.plan = {
      narrative: "A grounded story.",
      priorities: ["the work this posting asks for"],
      gaps: [],
      hiringFor: "The work in the posting.",
      positioning: "The strongest defensible evidence.",
      closeCall: false,
      evidence: [
        { ref: "E_role", use: "lead", bullets: 2, because: "The product is the strongest build evidence." },
        { ref: "E_def", use: "omit", bullets: 0, because: "The internship repeats the product work." },
      ],
    };
    const guard = validateTailorOutput(output, snapshot, developerAnalysis());
    const composition = composeResume({
      output: guard.output,
      snapshot,
      analysis: developerAnalysis(),
      length: 1,
    });
    expect(composition.output.entries.map((entry) => entry.ref)).not.toContain("E_licence");
    expect(composition.review).toContainEqual({
      code: "ENTRY_EXCLUDED",
      severity: "note",
      ref: "E_licence",
      reason: "unresolved",
    });
    expect(composition.review).toContainEqual(
      expect.objectContaining({ ref: "E_def", reason: "strategy_omit" }),
    );

    output.plan.evidence?.push({
      ref: "E_licence",
      use: "omit",
      bullets: 0,
      because: "The certificate is not required for this role.",
    });
    const omitted = validateTailorOutput(output, snapshot, developerAnalysis());
    const omittedComposition = composeResume({
      output: omitted.output,
      snapshot,
      analysis: developerAnalysis(),
      length: 1,
    });
    expect(omittedComposition.output.entries.map((entry) => entry.ref)).not.toContain("E_licence");
    expect(omittedComposition.review).toContainEqual({
      code: "ENTRY_EXCLUDED",
      severity: "note",
      ref: "E_licence",
      reason: "strategy_omit",
    });
  });

  it("reads the saved P001 plan as silence on the credential", () => {
    const tracePath = path.join(
      process.cwd(),
      "benchmarks",
      "results",
      "paid-2026-11-13T01-00-43-175Z",
      "P001-J012.trace.json",
    );
    if (!existsSync(tracePath)) return;
    const trace = JSON.parse(readFileSync(tracePath, "utf8")) as {
      plan: { evidence?: { ref: string; use: "lead" | "support" | "omit" }[] } | null;
      composeReview: { ref: string; reason: string }[];
    };
    const refs = [...new Set([
      ...(trace.plan?.evidence ?? []).map((row) => row.ref),
      ...trace.composeReview.map((row) => row.ref).filter((ref) => /^E\d+$/.test(ref)),
    ])].map((ref) => ({ ref }));
    const rows = planDispositions(refs, trace.plan?.evidence);
    expect(trace.plan?.evidence?.some((row) => row.ref === "E13")).toBe(false);
    expect(rows.find((row) => row.ref === "E13")?.disposition).toBe("unresolved");
    expect(rows.find((row) => row.ref === "E2")?.disposition).toBe("omit");
    expect(trace.composeReview).toContainEqual(expect.objectContaining({ ref: "E13", reason: "not_selected" }));
  });
});
