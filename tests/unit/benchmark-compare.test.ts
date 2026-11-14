import { describe, expect, it } from "vitest";

import { baselineDocument, fitResume } from "../../benchmarks/lib/fit";
import { equalEvidenceInput, loadCase } from "../../benchmarks/lib/load";
import { contentTokens, phraseEquivalent, phraseMatch } from "../../benchmarks/lib/phrases";
import { adaptFixtureResume, evidenceGaps } from "../../benchmarks/lib/snapshot";
import { libraryPromptText } from "@/features/library/serialize";
import { resumePlainText } from "@/features/tailor/plainText";
import { validateTailorOutput } from "@/features/tailor/validate";

import { baseRequirements, jobAnalysis, librarySnapshot, resumeContent, tailorOutput } from "./tailor-fixture";

const CASES = ["P006-J047", "P011-J052", "P012-J037", "P014-J055"] as const;

describe("phrase equivalence", () => {
  it("accepts the same numbers with a different range separator", () => {
    expect(phraseMatch("Raised collections from 40% to 90%.", "raised collections from 40%→90%")).toBe(
      "equivalent",
    );
    expect(phraseEquivalent("Raised collections from 40% to 99%.", "raised collections from 40%→90%")).toBe(
      false,
    );
    expect(phraseEquivalent("Raised collections from 90%.", "raised collections from 40%→90%")).toBe(false);
  });

  it("accepts a slash written as and, and keeps every name", () => {
    expect(phraseMatch("Managed the Title III and PECO grant budgets.", "Title III/PECO grant")).toBe(
      "equivalent",
    );
    expect(phraseEquivalent("Managed the Title III grant.", "Title III/PECO grant")).toBe(false);
  });

  it("accepts credential punctuation and the spelled-out form", () => {
    expect(phraseMatch("M.S.W. (in progress), Clinical", "MSW in progress")).toBe("equivalent");
    expect(phraseEquivalent("licensed clinical social worker", "LCSW")).toBe(true);
    expect(phraseEquivalent("Nurse Practitioner", "NP")).toBe(true);
    expect(phraseEquivalent("registered nurse", "RN")).toBe(true);
    expect(phraseEquivalent("Certified Public Accountant", "CPA")).toBe(true);
    expect(contentTokens("snap")).not.toContain("np");
  });

  it("does not treat a nearby word as the credential", () => {
    expect(phraseEquivalent("snapshot of the caseload", "NP")).toBe(false);
    expect(phraseEquivalent("pattern of care", "RN")).toBe(false);
  });
});

describe("four diagnostic cases share source evidence", () => {
  it("gives both arms the same facts before a model call", () => {
    const missing: string[] = [];
    for (const id of CASES) {
      const testCase = loadCase(id);
      if (!testCase) throw new Error(id);
      const evidence = equalEvidenceInput(testCase);
      const adapted = adaptFixtureResume(evidence.resume);
      expect(evidenceGaps(adapted.snapshot, adapted.spans)).toEqual([]);
      const library = libraryPromptText(adapted.snapshot);
      for (const phrase of testCase.includeEvidence) {
        if (!phraseEquivalent(evidence.resume, phrase) || !phraseEquivalent(library, phrase)) {
          missing.push(`${id}: ${phrase}`);
        }
      }
      expect(adapted.snapshot.entries.filter((entry) => entry.kind === "EXPERIENCE").length).toBeGreaterThan(1);
    }
    expect(missing).toEqual([]);
  });
});

describe("guard identifiers stay off the resume", () => {
  it("drops an unknown skill ref without writing G7 into the resume fields", () => {
    const output = tailorOutput();
    output.skills = [
      { category: "Languages", refs: ["S1", "S99"] },
      { category: null, refs: ["NO-SKILL"] },
    ];
    const result = validateTailorOutput(output, librarySnapshot(), jobAnalysis(baseRequirements));
    expect(result.issues.map((issue) => issue.code)).toContain("G7");
    expect(JSON.stringify(result.output.skills)).not.toContain("G7");
    expect(result.output.summary).not.toContain("G7");
    expect(result.output.entries.some((entry) => entry.bullets.some((bullet) => bullet.text.includes("G7")))).toBe(
      false,
    );
  });

  it("downgrades an overstated match without writing G15 into the bullet", () => {
    const source = "Merge and transform data across multiple sources in Excel using key-based joins.";
    const snapshot = librarySnapshot();
    const bullet = snapshot.entries[0]?.bullets[0];
    if (!bullet) throw new Error("missing bullet");
    bullet.text = source;
    const output = tailorOutput();
    const drafted = output.entries[0]?.bullets[0];
    if (!drafted) throw new Error("missing draft");
    drafted.text = source;
    output.requirementMatches[0] = {
      requirementId: "r1",
      verdict: "met",
      evidenceRefs: ["E1.B1"],
      note: "The model treated the spreadsheet work as the whole requirement.",
    };
    const result = validateTailorOutput(output, snapshot, jobAnalysis([
      { id: "r1", text: "5+ years of production ETL experience", kind: "skill", importance: "must" },
      baseRequirements[1] ?? { id: "r2", text: "AWS certification", kind: "certification", importance: "nice" },
    ]));
    expect(result.issues).toContainEqual({ code: "G15", ref: "r1" });
    expect(result.output.entries[0]?.bullets[0]?.text).toBe(source);
    expect(result.output.requirementMatches[0]?.note).not.toContain("G15");
    const plain = resumePlainText(
      resumeContent({
        summary: { text: result.output.summary, included: true },
        entries: result.output.entries.map((entry) => ({
          ref: entry.ref,
          kind: snapshot.entries.find((item) => item.ref === entry.ref)?.kind ?? "EXPERIENCE",
          included: true,
          bullets: entry.bullets.map((item) => ({
            id: item.sourceRefs[0] ?? entry.ref,
            text: item.text,
            included: true,
            sourceRefs: item.sourceRefs,
            reverted: false,
            edited: false,
            originalText: null,
            suggestion: null,
            suggestionNote: null,
            changeWhat: null,
            requirementIds: [],
          })),
        })),
      }),
      snapshot,
    );
    expect(plain).not.toMatch(/\bG15\b/);
    expect(plain).not.toMatch(/\bG7\b/);
  });
});

describe("shared page fit", () => {
  it("measures a short resume and a short baseline on the same automatic ceiling", async () => {
    const snapshot = librarySnapshot();
    const content = resumeContent({
      summary: { text: "Analyst with reporting experience.", included: true },
      entries: [
        {
          ref: "E1",
          kind: "EXPERIENCE",
          included: true,
          bullets: [
            {
              id: "b1",
              text: "Maintained 14 reports for a 20-person team.",
              included: true,
              sourceRefs: ["E1.B1"],
              reverted: false,
              edited: false,
              originalText: null,
              suggestion: null,
              suggestionNote: null,
              changeWhat: null,
              requirementIds: [],
            },
          ],
        },
      ],
    });
    const role = await fitResume(content, snapshot);
    const baseline = baselineDocument(
      ["Alex Example", "Summary", "Accountant who closed the books.", "Experience", "Accountant (2013–2014)", "- Kept the close."].join(
        "\n",
      ),
    );
    const other = await fitResume(baseline.content, baseline.snapshot);
    expect(role.measured).toBe(true);
    expect(other.measured).toBe(true);
    expect(role.pageLimit).toBe(1);
    expect(other.pageLimit).toBe(1);
    expect(other.text).toContain("Kept the close");
  });
});
