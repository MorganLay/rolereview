import { describe, expect, it } from "vitest";

import { assembleResumeContent } from "@/features/tailor/assemble";
import { applyResumeEdit, restoreSourceBullets } from "@/features/tailor/content";
import { composeResume } from "@/features/tailor/compose";
import { requirementCoverage } from "@/features/tailor/coverage";
import { resumePlainText } from "@/features/tailor/plainText";
import { bulletReview } from "@/features/tailor/review";
import { acceptRevision, mergeRevision, revisionTargets } from "@/features/tailor/revise";
import { validateTailorOutput } from "@/features/tailor/validate";
import { resumePdfLines, resumePdfModel } from "@/lib/pdf/model";

import {
  analystAnalysis,
  analystDraft,
  developerAnalysis,
  developerDraft,
  HOOTSUITE_POSTING,
  hootsuiteSnapshot,
} from "./tailor-hootsuite-fixture";

function ids() {
  let next = 1;
  return () => `id-${next++}`;
}

describe("evidence-backed developer resume", () => {
  const snapshot = hootsuiteSnapshot();
  const before = snapshot.entries.flatMap((entry) => entry.bullets.map((bullet) => bullet.text));
  const analysis = developerAnalysis();
  const guard = validateTailorOutput(developerDraft(), snapshot, analysis);

  it("keeps a multi-source RoleRefine line and the internship practices", () => {
    const role = guard.output.entries.find((entry) => entry.ref === "E_role");
    const internship = guard.output.entries.find((entry) => entry.ref === "E_def");
    expect(role?.bullets[0]?.sourceRefs).toEqual(["E_role.B1", "E_role.B2", "E_role.B3"]);
    expect(role?.bullets[0]?.text).toContain("Stripe");
    expect(role?.bullets[0]?.text).toContain("Supabase");
    expect(role?.bullets[0]?.reverted).toBe(false);
    expect(internship?.bullets[0]?.text).toContain("Agile");
    expect(internship?.bullets[0]?.text).toContain("pull requests");
    expect(internship?.bullets[0]?.text).toContain("code reviews");
    expect(internship?.bullets[1]?.text).toContain("OAuth");
    expect(guard.reverts).toBe(0);
  });

  it("does not promote Java familiarity into coursework or professional development", () => {
    const java = guard.output.requirementMatches.find((match) => match.requirementId === "r_java");
    expect(java?.verdict).toBe("partial");
    const drafted = developerDraft();
    const education = drafted.entries.find((entry) => entry.ref === "E_edu");
    if (!education?.bullets[0]) throw new Error("missing java bullet");
    education.bullets[0].text = "Completed introductory coursework in Java.";
    const coursework = validateTailorOutput(drafted, snapshot, analysis);
    expect(coursework.output.entries.find((entry) => entry.ref === "E_edu")?.bullets[0]?.text).toBe(
      "Familiar with Java and has used it.",
    );
    expect(coursework.issues).toContainEqual({ code: "G16", ref: "E_edu.B1" });

    const developed = developerDraft();
    const developedEducation = developed.entries.find((entry) => entry.ref === "E_edu");
    if (!developedEducation?.bullets[0]) throw new Error("missing java bullet");
    developedEducation.bullets[0].text = "Developed Java services.";
    const rejected = validateTailorOutput(developed, snapshot, analysis);
    expect(rejected.output.entries.find((entry) => entry.ref === "E_edu")?.bullets[0]?.text).toBe(
      "Familiar with Java and has used it.",
    );
  });

  it("leaves the library text unchanged and exports the composed line once", () => {
    const composition = composeResume({
      output: guard.output,
      snapshot,
      analysis,
      length: 1,
    });
    const content = assembleResumeContent(composition.output, snapshot, ids(), new Map(), composition);
    const after = snapshot.entries.flatMap((entry) => entry.bullets.map((bullet) => bullet.text));
    expect(after).toEqual(before);

    const role = content.entries.find((entry) => entry.ref === "E_role");
    const included = role?.bullets.filter((bullet) => bullet.included) ?? [];
    expect(included[0]?.sourceRefs).toEqual(["E_role.B1", "E_role.B2", "E_role.B3"]);
    expect(included[0]?.sourceIds).toEqual(["b-role-1", "b-role-2", "b-role-3"]);
    const text = resumePlainText(content, snapshot);
    expect(text).toContain("Stripe billing");
    expect(text.match(/Stripe billing/g)).toHaveLength(1);
    expect(text).toContain("Agile");
    expect(text).not.toContain("Library summary that tailoring must not overwrite.");
  });

  it("does not ask for another model call when the draft already shows the evidence", () => {
    expect(
      revisionTargets({ output: guard.output, snapshot, analysis }),
    ).toEqual([]);
  });

  it("uses the full posting and does not rewrite the Java requirement as professional experience", () => {
    expect(HOOTSUITE_POSTING).toContain(
      "Experience with Java or a functional programming language",
    );
    expect(HOOTSUITE_POSTING).toContain("code reviews");
    expect(HOOTSUITE_POSTING).toContain("security");
    expect(analysis.requirements.find((item) => item.id === "r_java")?.text).toBe(
      "Experience with Java or a functional programming language",
    );
  });

  it("drops summary sentences that promote Java, and keeps a supported cross-role sentence", () => {
    const drafted = developerDraft();
    drafted.summary =
      "Completed introductory coursework in Java. Professional Java development experience. Built and tested web software, and developed reporting workflows using SQL.";
    const result = validateTailorOutput(drafted, snapshot, analysis);
    expect(result.issues).toContainEqual({ code: "G12", ref: "summary" });
    expect(result.output.summary).not.toMatch(/coursework|professional java/i);
    expect(result.output.summary).toContain("SQL");
  });

  it("keeps one record when the same employer and dates were imported twice", () => {
    const snapshot = hootsuiteSnapshot();
    const intern = snapshot.entries.find((entry) => entry.ref === "E_def");
    if (!intern) throw new Error("missing internship");
    snapshot.entries.push({
      ...intern,
      ref: "E_def2",
      id: "entry-def-2",
      organization: "Defhacks.co",
      bullets: intern.bullets.map((bullet) => ({
        ...bullet,
        ref: bullet.ref.replace("E_def", "E_def2"),
        id: bullet.id.replace("b-def", "b-def2"),
      })),
    });
    const drafted = developerDraft();
    drafted.entries.push({
      ref: "E_def2",
      bullets: [
        {
          sourceRefs: ["E_def2.B1"],
          text: "Developed and tested JavaScript and React web features.",
        },
      ],
    });
    const checked = validateTailorOutput(drafted, snapshot, analysis);
    const composition = composeResume({
      output: checked.output,
      snapshot,
      analysis,
      length: 1,
    });
    const kept = composition.output.entries
      .map((entry) => entry.ref)
      .filter((ref) => ref === "E_def" || ref === "E_def2");
    expect(kept).toEqual(["E_def"]);
    expect(composition.review).toContainEqual({
      code: "ENTRY_EXCLUDED",
      severity: "note",
      ref: "E_def2",
      reason: "same_role",
    });
  });

  it("keeps a second record of the same employer when it adds a posting term", () => {
    const snapshot = hootsuiteSnapshot();
    const reporting = snapshot.entries.find((entry) => entry.ref === "E_cra");
    if (!reporting?.bullets[0]) throw new Error("missing reporting");
    reporting.bullets[0].text = "Developed reporting workflows using SQL and Excel.";
    snapshot.entries.push({
      ...reporting,
      ref: "E_cra2",
      id: "entry-cra-2",
      bullets: [
        {
          ref: "E_cra2.B1",
          id: "b-cra-2",
          text: "Automated the workbooks with VBA.",
        },
      ],
    });
    const drafted = analystDraft();
    drafted.entries.push(
      {
        ref: "E_cra",
        bullets: [
          {
            sourceRefs: ["E_cra.B1"],
            text: "Developed reporting workflows using SQL and Excel.",
          },
        ],
      },
      {
        ref: "E_cra2",
        bullets: [{ sourceRefs: ["E_cra2.B1"], text: "Automated the workbooks with VBA." }],
      },
    );
    const checked = validateTailorOutput(drafted, snapshot, analystAnalysis());
    const composition = composeResume({
      output: checked.output,
      snapshot,
      analysis: analystAnalysis(),
      length: 1,
    });
    const kept = composition.output.entries.map((entry) => entry.ref);
    expect(kept).toContain("E_cra");
    expect(kept).toContain("E_cra2");
  });

  it("revises a selected line that hides job-relevant evidence", () => {
    const drafted = developerDraft();
    const internship = drafted.entries.find((entry) => entry.ref === "E_def");
    if (!internship?.bullets[0]) throw new Error("missing internship");
    internship.bullets[0].text = "Worked on web features.";
    const checked = validateTailorOutput(drafted, snapshot, analysis);
    const targets = revisionTargets({ output: checked.output, snapshot, analysis });
    expect(targets.some((target) => target.entryRef === "E_def")).toBe(true);
    expect(targets.length).toBeLessThanOrEqual(3);
  });
});

describe("restoring a combined bullet", () => {
  it("puts each source back as its own line for the editor, review, and export", () => {
    const snapshot = hootsuiteSnapshot();
    const composition = composeResume({
      output: validateTailorOutput(developerDraft(), snapshot, developerAnalysis()).output,
      snapshot,
      analysis: developerAnalysis(),
      length: 1,
    });
    const content = assembleResumeContent(composition.output, snapshot, ids(), new Map(), composition);
    const role = content.entries.find((entry) => entry.ref === "E_role");
    const combined = role?.bullets.find((bullet) => bullet.sourceRefs.length > 1);
    if (!combined) throw new Error("missing combined bullet");

    const restored = restoreSourceBullets(content, "E_role", combined.id, snapshot, ids());
    const bullets =
      restored.entries.find((entry) => entry.ref === "E_role")?.bullets.filter((bullet) => bullet.included) ??
      [];
    const originals = [
      "Built a live full-stack SaaS product.",
      "Used Next.js, TypeScript, Prisma, Supabase, and Vercel.",
      "Implemented authentication, persisted data, job tracking, resume export, and Stripe billing integration.",
    ];
    expect(bullets.slice(0, 3).map((bullet) => bullet.text)).toEqual(originals);
    expect(bullets.slice(0, 3).map((bullet) => bullet.sourceRefs)).toEqual([
      ["E_role.B1"],
      ["E_role.B2"],
      ["E_role.B3"],
    ]);
    expect(bullets.some((bullet) => bullet.text.length > 400)).toBe(false);
    for (const bullet of bullets.slice(0, 3)) {
      expect(bulletReview(bullet, bullet.text).state).toBe("none");
    }

    const saved = applyResumeEdit({
      stored: content,
      incoming: restored,
      snapshot,
      aiOutput: composition.output,
    });
    expect(saved.ok).toBe(true);

    const text = resumePlainText(restored, snapshot);
    const lines = resumePdfLines(resumePdfModel(restored, snapshot));
    for (const line of originals) {
      expect(text).toContain(line);
      expect(lines).toContain(`- ${line}`);
    }
    expect(text).not.toContain(originals.join(" "));
  });
});

describe("requirement coverage", () => {
  const snapshot = hootsuiteSnapshot();

  it("separates direct internship evidence from Java that is only familiarity", () => {
    const guard = validateTailorOutput(developerDraft(), snapshot, developerAnalysis());
    const rows = requirementCoverage({
      analysis: developerAnalysis(),
      snapshot,
      output: guard.output,
    });
    expect(rows.find((row) => row.requirementId === "r_agile")).toMatchObject({
      library: "direct",
      presented: "on_resume",
    });
    expect(rows.find((row) => row.requirementId === "r_java")).toMatchObject({
      library: "partial",
    });
  });

  it("flags direct reporting evidence that the developer-shaped draft left off", () => {
    const guard = validateTailorOutput(analystDraft(), hootsuiteSnapshot(), analystAnalysis());
    const rows = requirementCoverage({
      analysis: analystAnalysis(),
      snapshot,
      output: guard.output,
    });
    expect(rows.find((row) => row.requirementId === "r_sql")).toMatchObject({
      library: "direct",
      presented: "in_library",
    });
    expect(rows.find((row) => row.requirementId === "r_excel")?.sourceRefs).toContain("E_cra.B1");
  });
});

describe("job-specific priority", () => {
  const snapshot = hootsuiteSnapshot();

  it("brings the reporting role forward for an analyst posting", () => {
    const guard = validateTailorOutput(analystDraft(), snapshot, analystAnalysis());
    const composition = composeResume({
      output: guard.output,
      snapshot,
      analysis: analystAnalysis(),
      length: 1,
    });
    const refs = composition.output.entries.map((entry) => entry.ref);
    expect(refs).toContain("E_cra");
    const cra = composition.output.entries.find((entry) => entry.ref === "E_cra");
    expect(cra?.bullets[0]?.text).toContain("SQL");
    expect(refs).not.toContain("E_def");
  });

  it("asks for a revision when Agile evidence is missing from a developer draft", () => {
    const thin = analystDraft();
    thin.summary = "Built a SaaS product.";
    thin.requirementMatches = developerAnalysis().requirements.map((requirement) => ({
      requirementId: requirement.id,
      verdict: "missing" as const,
      evidenceRefs: [],
      note: "Not on the draft.",
    }));
    const guard = validateTailorOutput(thin, snapshot, developerAnalysis());
    const targets = revisionTargets({
      output: guard.output,
      snapshot,
      analysis: developerAnalysis(),
    });
    const refs = targets.flatMap((target) => target.unused.map((source) => source.ref));
    expect(refs).toContain("E_def.B2");
    expect(refs).not.toContain("E_edu.B1");
  });

  it("accepts a grounded revision and rejects one that invents a metric", () => {
    const guard = validateTailorOutput(analystDraft(), snapshot, analystAnalysis());
    const targets = revisionTargets({
      output: guard.output,
      snapshot,
      analysis: analystAnalysis(),
    });
    const merged = mergeRevision(
      guard.output,
      [
        {
          ref: "E_cra",
          bullets: [
            {
              sourceRefs: ["E_cra.B1"],
              text: "Developed reporting workflows using SQL, Excel, and VBA.",
              what: "Names the reporting tools from the source.",
              why: "The analyst posting asks for SQL and Excel, which this role shows.",
              requirementIds: ["r_sql", "r_excel"],
            },
          ],
        },
      ],
      targets,
    );
    const second = validateTailorOutput(merged.output, snapshot, analystAnalysis());
    const accepted = acceptRevision(
      guard.output,
      second.output,
      targets.map((target) => target.entryRef),
    );
    expect(accepted.accepted).toContain("E_cra");
    expect(accepted.output.entries.find((entry) => entry.ref === "E_cra")?.bullets[0]?.text).toContain(
      "Excel",
    );

    const invented = mergeRevision(
      guard.output,
      [
        {
          ref: "E_cra",
          bullets: [
            {
              sourceRefs: ["E_cra.B1"],
              text: "Cut reporting time by 40% for 12 teams.",
              what: "Adds a result.",
              why: "The posting wants impact.",
              requirementIds: ["r_sql"],
            },
          ],
        },
      ],
      targets,
    );
    const rejected = validateTailorOutput(invented.output, snapshot, analystAnalysis());
    const kept = acceptRevision(
      guard.output,
      rejected.output,
      targets.map((target) => target.entryRef),
    );
    expect(kept.accepted).not.toContain("E_cra");
  });
});
