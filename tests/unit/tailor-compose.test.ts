import { describe, expect, it } from "vitest";

import { assembleResumeContent } from "@/features/tailor/assemble";
import { composeResume } from "@/features/tailor/compose";
import { sameDegree } from "@/features/tailor/identity";
import { resumePlainText } from "@/features/tailor/plainText";
import { validateTailorOutput } from "@/features/tailor/validate";

import { scenarioAnalysis, scenarioOutput, scenarioSnapshot } from "./tailor-scenario-fixture";

function ids() {
  let next = 1;
  return () => `id-${next++}`;
}

function includedRefs(content: ReturnType<typeof assembleResumeContent>): string[] {
  const order = content.sectionOrder ?? [];
  const refs: string[] = [];
  for (const kind of order) {
    for (const entry of content.entries) {
      if (entry.kind === kind && entry.included) refs.push(entry.ref);
    }
  }
  return refs;
}

describe("scenario resume composition", () => {
  const snapshot = scenarioSnapshot();
  const analysis = scenarioAnalysis();
  const guard = validateTailorOutput(scenarioOutput(), snapshot, analysis);
  const composition = composeResume({
    output: guard.output,
    snapshot,
    analysis,
    length: 1,
  });
  const content = assembleResumeContent(
    composition.output,
    snapshot,
    ids(),
    new Map(),
    composition,
  );

  it("consolidates two records of the same Carleton degree", () => {
    const degree = snapshot.entries.find((entry) => entry.ref === "E_degree");
    const duplicate = snapshot.entries.find((entry) => entry.ref === "E_degree_dup");
    if (!degree || !duplicate) throw new Error("missing degrees");
    expect(sameDegree(degree, duplicate)).toBe(true);
    expect(guard.issues).toContainEqual({ code: "G18", ref: "E_degree_dup" });
    expect(guard.output.entries.map((entry) => entry.ref)).toContain("E_degree");
    expect(guard.output.entries.map((entry) => entry.ref)).not.toContain("E_degree_dup");

    const included = content.entries.filter(
      (entry) => entry.kind === "EDUCATION" && entry.included,
    );
    expect(included.map((entry) => entry.ref)).toEqual(["E_degree"]);
    expect(content.entries.find((entry) => entry.ref === "E_degree_dup")?.included).toBe(false);
    expect(composition.review).toContainEqual({
      code: "DUPLICATE_CONSOLIDATED",
      severity: "note",
      ref: "E_degree_dup",
      reason: "same_degree",
    });
  });

  it("does not drop the current CRA role without a traceable reason", () => {
    expect(composition.output.entries.map((entry) => entry.ref)).not.toContain("E_cra");
    expect(content.entries.find((entry) => entry.ref === "E_cra")?.included).toBe(false);
    expect(composition.review).toContainEqual({
      code: "CURRENT_ROLE_OMITTED",
      severity: "warning",
      ref: "E_cra",
      reason: "current_role_not_selected",
    });
    expect(composition.review).toContainEqual({
      code: "ENTRY_EXCLUDED",
      severity: "note",
      ref: "E_cra",
      reason: "not_selected",
    });
    expect(composition.review).toContainEqual({
      code: "ENTRY_EXCLUDED",
      severity: "note",
      ref: "E_empty",
      reason: "missing_source",
    });
  });

  it("keeps verified GitHub and LinkedIn links and drops a course link", () => {
    expect(composition.contacts.map((link) => link.kind)).toEqual(["github", "linkedin"]);
    expect(composition.contacts.map((link) => link.url)).toEqual([
      "https://github.com/morgan-example",
      "https://www.linkedin.com/in/morgan-example",
    ]);
    expect(composition.review).toContainEqual(
      expect.objectContaining({ code: "CONTACT_EXCLUDED", reason: "duplicate_url" }),
    );
    expect(composition.review).toContainEqual(
      expect.objectContaining({
        code: "CONTACT_EXCLUDED",
        reason: "not_contact",
        ref: "coursera.org/learn/ml",
      }),
    );

    const text = resumePlainText(content, snapshot);
    expect(text).toContain("https://github.com/morgan-example");
    expect(text).toContain("https://www.linkedin.com/in/morgan-example");
    expect(text).not.toContain("coursera.org");
  });

  it("prioritizes recent engineering projects over the 2020 internship and the course project", () => {
    const order = includedRefs(content);
    const at = (ref: string) => order.indexOf(ref);
    expect(at("E_role")).toBeGreaterThanOrEqual(0);
    expect(at("E_gorseline")).toBeGreaterThanOrEqual(0);
    expect(at("E_creek")).toBe(-1);
    expect(at("E_cnn")).toBe(-1);
    expect(at("E_def")).toBe(-1);
    expect(content.sectionOrder?.indexOf("PROJECT")).toBeLessThan(
      content.sectionOrder?.indexOf("EXPERIENCE") ?? 0,
    );
    expect(composition.review).toContainEqual({
      code: "ENTRY_EXCLUDED",
      severity: "note",
      ref: "E_def",
      reason: "lower_relevance",
    });
    expect(composition.review).toContainEqual({
      code: "SECTION_ORDER",
      severity: "note",
      ref: "sections",
      reason: "projects_lead",
    });

    const role = content.entries.find((entry) => entry.ref === "E_role");
    const included = role?.bullets.filter((bullet) => bullet.included) ?? [];
    expect(included.map((bullet) => bullet.sourceRefs)).toEqual([["E_role.B2"]]);
    expect(role?.bullets.find((bullet) => bullet.sourceRefs[0] === "E_role.B1")?.included).toBe(
      false,
    );
    expect(composition.review).toContainEqual({
      code: "BULLET_PREFERENCE",
      severity: "note",
      ref: "E_role.B1",
      reason: "stronger_bullet",
    });

    const skillRefs = composition.output.skills.flatMap((group) => group.refs);
    expect(skillRefs).toContain("S_ts");
    expect(skillRefs).not.toContain("S_ml");
    expect(composition.review).toContainEqual({
      code: "SKILL_EVIDENCE",
      severity: "note",
      ref: "S_ts",
      reason: "hands_on",
    });
    expect(composition.review).toContainEqual({
      code: "SKILL_EVIDENCE",
      severity: "note",
      ref: "S_ml",
      reason: "academic",
    });
  });
});

describe("employment chronology", () => {
  it("puts the current role before an older internship", () => {
    const snapshot = scenarioSnapshot();
    snapshot.entries = snapshot.entries.filter((entry) => entry.kind === "EXPERIENCE");
    snapshot.skills = [];
    const analysis = scenarioAnalysis();
    analysis.keywords = ["files"];
    analysis.title = "Program officer";
    analysis.requirements = [
        { id: "r1", text: "Track files", kind: "experience", importance: "must" },
    ];
    const output = scenarioOutput();
    output.entries = [
      {
        ref: "E_def",
        bullets: [
          {
            sourceRefs: ["E_def.B1"],
            text: "Assisted with workshop logistics for a student hackathon.",
          },
        ],
      },
      {
        ref: "E_cra",
        bullets: [
          {
            sourceRefs: ["E_cra.B1"],
            text: "Prepared correspondence and tracked processing files for individual tax returns.",
          },
        ],
      },
    ];
    output.skills = [];
    output.requirementMatches = [
      {
        requirementId: "r1",
        verdict: "partial",
        evidenceRefs: ["E_cra.B1"],
        note: "The current role tracks files.",
      },
    ];

    const guard = validateTailorOutput(output, snapshot, analysis);
    const composition = composeResume({
      output: guard.output,
      snapshot,
      analysis,
      length: 1,
    });

    expect(composition.output.entries.map((entry) => entry.ref)).toEqual(["E_cra", "E_def"]);
    expect(composition.review).toContainEqual({
      code: "ORDER_ADJUSTED",
      severity: "note",
      ref: "experience",
      reason: "chronology",
    });
    expect(composition.review).toContainEqual({
      code: "SECTION_ORDER",
      severity: "note",
      ref: "sections",
      reason: "experience_leads",
    });
    expect(composition.review.some((item) => item.code === "CURRENT_ROLE_OMITTED")).toBe(false);
  });
});
