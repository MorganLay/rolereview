/**
 * Dev-only GIS beta run. Reads the resume files and the job text.
 * fixture_ground_truth.json is read only after the model calls, to score them.
 * It is never sent to the model.
 *
 * Usage: npm run gis:beta -- "C:\path\to\RoleRefine_GIS_Beta_Test_Pack"
 * Refuses NODE_ENV=production. Writes only the two gis-beta fixture users.
 */
import "dotenv/config";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { skillNameKey } from "@/features/library/skill-state";
import { getLibrary } from "@/features/library/queries";
import { updateProfileSchema } from "@/features/library/schemas";
import { serializeLibrary } from "@/features/library/serialize";
import type { Library } from "@/features/library/types";
import {
  emptySortByKind,
  planImportCommit,
  type CommitEntryInput,
  type ImportExisting,
} from "@/features/import/commit";
import {
  classifyUpload,
  extractDocxText,
  postProcessImport,
  type ExtractedResume,
} from "@/features/import/extract";
import { DOCX_MIME, PDF_MIME } from "@/features/import/schemas";
import { bulletOpportunity } from "@/features/library/opportunity";
import { visibleFileText } from "@/features/library/skill-qualifier";
import { bulletRole, bulletStrength } from "@/features/library/strength";
import { buildContent, OutputSchema, SYSTEM } from "@/lib/ai/prompts/import";
import { runStructured } from "@/lib/ai/run";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

import {
  checkForbidden,
  checkNoCounts,
  hasStandaloneCount,
  postingForModel,
  type ScoreCheck,
} from "./gis-score";
import { runGisTailor, type GisTailorRun } from "./gis-tailor";

const AVERY = {
  id: "6f1a0001-1111-4111-8111-0000000000a1",
  email: "gis-beta-avery@example.invalid",
  referralCode: "gisav001",
};
const MORGAN = {
  id: "6f1a0002-2222-4222-8222-0000000000b2",
  email: "gis-beta-morgan@example.invalid",
  referralCode: "gisqu001",
};

const FORBIDDEN = [
  "javascript",
  "typescript",
  "angular",
  "c#",
  "postgis",
  "gisp",
  "arcgis server",
  "arcgis enterprise",
  "bilingual",
  "french",
];

type Stage = {
  name: string;
  extraction?: ExtractedResume;
  library?: ReturnType<typeof describeLibrary>;
  guidance?: { text: string; tier: string; advice: string }[];
  tailor?: GisTailorRun;
};

async function main() {
  if (env.NODE_ENV === "production") {
    throw new Error("gis:beta is dev only.");
  }
  if (!env.ANTHROPIC_API_KEY) throw new Error("Set ANTHROPIC_API_KEY. No model call was made.");
  if (env.SEED_USER_ID === AVERY.id || env.SEED_USER_ID === MORGAN.id) {
    throw new Error("SEED_USER_ID collides with a GIS fixture id. No data was changed.");
  }

  const pack =
    process.argv[2] ??
    "C:\\Users\\Morgan\\Downloads\\RoleRefine_GIS_Beta_Test_Pack";
  const stages: Stage[] = [];
  const exportDir = path.join(process.cwd(), "evals", "out", "gis-beta", "exports");
  await mkdir(exportDir, { recursive: true });

  await ensureFixture(AVERY);
  await ensureFixture(MORGAN);
  await resetFixture(AVERY.id);
  await resetFixture(MORGAN.id);

  const jobA = postingForModel(
    await readFile(path.join(pack, "job_A_gis_analyst_municipal_assets.txt"), "utf8"),
  );
  const jobB = postingForModel(
    await readFile(path.join(pack, "job_B_gis_developer_web_mapping.txt"), "utf8"),
  );
  if (jobA.includes("TEST EXPECTATIONS") || jobB.includes("TEST EXPECTATIONS")) {
    throw new Error("Job text still contains the answer key. No tailor call was made.");
  }

  console.log("1/8 import Avery sparse PDF");
  const sparsePdf = await extractFile(AVERY.id, path.join(pack, "01_avery_sparse_resume.pdf"));
  stages.push({ name: "avery-sparse-pdf", extraction: sparsePdf });

  console.log("2/8 import Avery sparse DOCX");
  const sparseDocx = await extractFile(AVERY.id, path.join(pack, "01_avery_sparse_resume.docx"));
  stages.push({ name: "avery-sparse-docx", extraction: sparseDocx });

  await saveExtract(AVERY.id, sparsePdf, "append");
  const sparseLibrary = await mustLibrary(AVERY.id);
  stages.push({
    name: "avery-sparse-library",
    library: describeLibrary(sparseLibrary),
    guidance: guidanceFor(sparseLibrary),
  });

  const sparseSnapshot = serializeLibrary(sparseLibrary, new Date().toISOString()).snapshot;
  console.log("3/8 tailor sparse Avery to Job A");
  const sparseA = await runGisTailor({
    userId: AVERY.id,
    snapshot: sparseSnapshot,
    posting: jobA,
    fallbackTitle: "GIS Analyst",
    fallbackCompany: "Northshore Public Works",
    pdfPath: path.join(exportDir, "avery-sparse-job-a.pdf"),
  });
  stages.push({ name: "avery-sparse-job-a", tailor: sparseA });

  console.log("4/8 tailor sparse Avery to Job B");
  const sparseB = await runGisTailor({
    userId: AVERY.id,
    snapshot: sparseSnapshot,
    posting: jobB,
    fallbackTitle: "GIS Developer",
    fallbackCompany: "Cartograph Systems",
    pdfPath: path.join(exportDir, "avery-sparse-job-b.pdf"),
  });
  stages.push({ name: "avery-sparse-job-b", tailor: sparseB });

  console.log("5/8 import Avery enriched DOCX into the same account");
  const beforeBullets = bulletTexts(sparseLibrary);
  const enriched = await extractFile(AVERY.id, path.join(pack, "02_avery_enriched_resume.docx"));
  stages.push({ name: "avery-enriched-docx", extraction: enriched });
  await saveExtract(AVERY.id, enriched, "append");
  const mergedLibrary = await mustLibrary(AVERY.id);
  stages.push({ name: "avery-merged-library", library: describeLibrary(mergedLibrary) });

  const mergedSnapshot = serializeLibrary(mergedLibrary, new Date().toISOString()).snapshot;
  console.log("6/8 tailor merged Avery to Job A and Job B");
  const mergedA = await runGisTailor({
    userId: AVERY.id,
    snapshot: mergedSnapshot,
    posting: jobA,
    fallbackTitle: "GIS Analyst",
    fallbackCompany: "Northshore Public Works",
    pdfPath: path.join(exportDir, "avery-merged-job-a.pdf"),
  });
  const mergedB = await runGisTailor({
    userId: AVERY.id,
    snapshot: mergedSnapshot,
    posting: jobB,
    fallbackTitle: "GIS Developer",
    fallbackCompany: "Cartograph Systems",
    pdfPath: path.join(exportDir, "avery-merged-job-b.pdf"),
  });
  stages.push({ name: "avery-merged-job-a", tailor: mergedA });
  stages.push({ name: "avery-merged-job-b", tailor: mergedB });

  console.log("7/8 import Morgan PDF on a separate account");
  const morganPdf = await extractFile(MORGAN.id, path.join(pack, "03_morgan_junior_resume.pdf"));
  const morganDocx = await extractFile(MORGAN.id, path.join(pack, "03_morgan_junior_resume.docx"));
  stages.push({ name: "morgan-pdf", extraction: morganPdf });
  stages.push({ name: "morgan-docx", extraction: morganDocx });
  await saveExtract(MORGAN.id, morganPdf, "append");
  const morganLibrary = await mustLibrary(MORGAN.id);
  stages.push({ name: "morgan-library", library: describeLibrary(morganLibrary) });

  console.log("8/8 tailor Morgan to Job A and Job B");
  const morganSnapshot = serializeLibrary(morganLibrary, new Date().toISOString()).snapshot;
  const morganA = await runGisTailor({
    userId: MORGAN.id,
    snapshot: morganSnapshot,
    posting: jobA,
    fallbackTitle: "GIS Analyst",
    fallbackCompany: "Northshore Public Works",
    pdfPath: path.join(exportDir, "morgan-job-a.pdf"),
  });
  const morganB = await runGisTailor({
    userId: MORGAN.id,
    snapshot: morganSnapshot,
    posting: jobB,
    fallbackTitle: "GIS Developer",
    fallbackCompany: "Cartograph Systems",
    pdfPath: path.join(exportDir, "morgan-job-b.pdf"),
  });
  stages.push({ name: "morgan-job-a", tailor: morganA });
  stages.push({ name: "morgan-job-b", tailor: morganB });

  const oracle = JSON.parse(
    await readFile(path.join(pack, "fixture_ground_truth.json"), "utf8"),
  ) as OracleFile;
  const checks = scoreRun({
    oracle,
    sparsePdf,
    sparseDocx,
    sparseLibrary,
    beforeBullets,
    mergedLibrary,
    morganPdf,
    morganDocx,
    morganLibrary,
    sparseA,
    sparseB,
    mergedA,
    mergedB,
    morganA,
    morganB,
  });

  const outDir = path.join(process.cwd(), "evals", "out", "gis-beta");
  await mkdir(outDir, { recursive: true });
  const report = {
    at: new Date().toISOString(),
    pack,
    accounts: [AVERY.email, MORGAN.email],
    checks,
    stages: stages.map(publicStage),
  };
  await writeFile(path.join(outDir, "latest.json"), `${JSON.stringify(report, null, 2)}\n`);
  const failed = checks.filter((check) => !check.pass);
  console.log("");
  for (const check of checks) {
    console.log(`${check.pass ? "PASS" : "FAIL"} [${check.severity}] ${check.id}: ${check.detail}`);
  }
  console.log(`${checks.length - failed.length}/${checks.length} passed`);
  console.log(path.join(outDir, "latest.json"));
  if (failed.length > 0) process.exitCode = 1;
}

type FixtureUser = { id: string; email: string; referralCode: string };

async function ensureFixture(user: FixtureUser) {
  const byId = await db.user.findUnique({ where: { id: user.id }, select: { id: true, email: true } });
  const byEmail = await db.user.findUnique({
    where: { email: user.email },
    select: { id: true },
  });
  if (byEmail && byEmail.id !== user.id) {
    throw new Error(`${user.email} belongs to another account. No data was changed.`);
  }
  const byCode = await db.user.findUnique({
    where: { referralCode: user.referralCode },
    select: { id: true },
  });
  if (byCode && byCode.id !== user.id) {
    throw new Error(`Referral code ${user.referralCode} is taken. No data was changed.`);
  }
  if (!byId) {
    await db.user.create({
      data: { id: user.id, email: user.email, referralCode: user.referralCode },
    });
  }
}

async function resetFixture(userId: string) {
  if (userId !== AVERY.id && userId !== MORGAN.id) {
    throw new Error("Refusing to reset an account outside the GIS fixtures.");
  }
  await db.tailoredResume.deleteMany({ where: { userId } });
  await db.coverLetter.deleteMany({ where: { userId } });
  await db.job.deleteMany({ where: { userId } });
  await db.entry.deleteMany({ where: { userId } });
  await db.skill.deleteMany({ where: { userId } });
  await db.user.update({
    where: { id: userId },
    data: {
      fullName: null,
      headline: null,
      phone: null,
      location: null,
      summary: null,
      links: [],
    },
  });
}

async function extractFile(userId: string, filePath: string): Promise<ExtractedResume> {
  const bytes = new Uint8Array(await readFile(filePath));
  const declared = filePath.toLowerCase().endsWith(".pdf") ? PDF_MIME : DOCX_MIME;
  const classified = classifyUpload(bytes, declared);
  if (!classified.ok) throw new Error(`${path.basename(filePath)} ${classified.reason}`);
  const docxText =
    classified.kind === "docx" ? ((await extractDocxText(bytes))?.trim() ?? "") : "";
  const content =
    classified.kind === "pdf"
      ? buildContent({ kind: "pdf", base64: Buffer.from(bytes).toString("base64") })
      : buildContent({ kind: "text", text: docxText });
  const sourceText = classified.kind === "pdf" ? visibleFileText(bytes) : docxText;
  const result = await runStructured({
    kind: "IMPORT",
    userId,
    usedBonusCredit: false,
    countsTowardQuota: false,
    system: SYSTEM,
    content,
    schema: OutputSchema,
    refId: `gis-beta:${path.basename(filePath)}`,
  });
  if (!result.ok) throw new Error(`${path.basename(filePath)} ${result.code}`);
  return postProcessImport(result.data, sourceText);
}

async function saveExtract(
  userId: string,
  extracted: ExtractedResume,
  mode: "append" | "replace",
) {
  const library = await mustLibrary(userId);
  const profileParsed = updateProfileSchema.safeParse({
    fullName: extracted.profile.fullName ?? "",
    headline: extracted.profile.headline ?? "",
    phone: extracted.profile.phone ?? "",
    location: extracted.profile.location ?? "",
    summary: extracted.profile.summary ?? "",
    links: [],
  });
  const entries: CommitEntryInput[] = extracted.entries.map((entry) => ({
    kind: entry.kind,
    title: entry.title,
    organization: entry.organization,
    location: entry.location,
    url: entry.url,
    startDate: entry.startDate,
    endDate: entry.endDate,
    isCurrent: entry.isCurrent,
    bullets: entry.bullets.map((bullet) => ({ text: bullet.text })),
  }));
  const planned = planImportCommit({
    mode,
    profile: profileParsed.success ? profileParsed.data : null,
    entries,
    skills: extracted.skills.map((skill) => ({
      name: skill.name,
      category: skill.category,
    })),
    existing: existingOf(library),
  });
  if (!planned.ok) throw new Error("Import plan was empty.");
  const plan = planned.plan;
  await db.$transaction(async (tx) => {
    if (plan.profile) {
      await tx.user.updateMany({
        where: { id: userId },
        data: {
          fullName: plan.profile.fullName,
          headline: plan.profile.headline,
          phone: plan.profile.phone,
          location: plan.profile.location,
          summary: plan.profile.summary,
          links: plan.profile.links,
        },
      });
    }
    for (const entry of plan.entries) {
      await tx.entry.create({
        data: {
          userId,
          kind: entry.kind,
          title: entry.title,
          organization: entry.organization,
          location: entry.location,
          url: entry.url,
          startDate: entry.startDate,
          endDate: entry.endDate,
          isCurrent: entry.isCurrent,
          sortOrder: entry.sortOrder,
          bullets: {
            create: entry.bullets.map((bullet) => ({
              userId,
              text: bullet.text,
              sortOrder: bullet.sortOrder,
            })),
          },
        },
      });
    }
    if (plan.skills.length > 0) {
      await tx.skill.createMany({
        data: plan.skills.map((skill) => ({
          userId,
          name: skill.name,
          nameKey: skill.nameKey,
          category: skill.category,
          sortOrder: skill.sortOrder,
        })),
      });
    }
    for (const update of plan.skillUpdates) {
      const renamed = await tx.skill.updateMany({
        where: { id: update.id, userId },
        data: { name: update.name, nameKey: update.nameKey },
      });
      if (renamed.count === 0) throw new Error("SKILL_MISSING");
    }
    for (const update of plan.bulletUpdates) {
      const owned = await tx.entry.findFirst({
        where: { id: update.entryId, userId },
        select: { id: true },
      });
      if (!owned) throw new Error("ENTRY_MISSING");
      await tx.bullet.createMany({
        data: update.bullets.map((bullet) => ({
          userId,
          entryId: owned.id,
          text: bullet.text,
          sortOrder: bullet.sortOrder,
        })),
      });
    }
  });
}

function existingOf(library: Library): ImportExisting {
  const maxSortByKind = emptySortByKind();
  let maxSkillSort = -1;
  for (const entry of library.entries) {
    maxSortByKind[entry.kind] = Math.max(maxSortByKind[entry.kind], entry.sortOrder);
  }
  for (const skill of library.skills) maxSkillSort = Math.max(maxSkillSort, skill.sortOrder);
  return {
    maxSortByKind,
    maxSkillSort,
    skillNameKeys: library.skills.map((skill) => skillNameKey(skill.name)),
    skillCategories: library.skills.map((skill) => skill.category),
    skills: library.skills.map((skill) => ({
      id: skill.id,
      name: skill.name,
      nameKey: skillNameKey(skill.name),
    })),
    entries: library.entries.map((entry) => ({
      id: entry.id,
      kind: entry.kind,
      title: entry.title,
      organization: entry.organization,
      startDate: entry.startDate,
      endDate: entry.endDate,
      bullets: entry.bullets.map((bullet) => ({
        text: bullet.text,
        sortOrder: bullet.sortOrder,
      })),
    })),
  };
}

async function mustLibrary(userId: string): Promise<Library> {
  const library = await getLibrary(userId);
  if (!library) throw new Error("Fixture user is missing.");
  return library;
}

function describeLibrary(library: Library) {
  return {
    name: library.profile.fullName,
    summary: library.profile.summary,
    entries: library.entries.map((entry) => ({
      kind: entry.kind,
      title: entry.title,
      organization: entry.organization,
      startDate: entry.startDate,
      endDate: entry.endDate,
      bullets: entry.bullets.map((bullet) => bullet.text),
    })),
    skills: library.skills.map((skill) => skill.name),
  };
}

function bulletTexts(library: Library): string[] {
  return library.entries.flatMap((entry) => entry.bullets.map((bullet) => bullet.text));
}

function guidanceFor(library: Library) {
  const skills = library.skills.map((skill) => skill.name);
  return library.entries.flatMap((entry) =>
    entry.bullets.map((bullet) => {
      const strength = bulletStrength(bullet.text, skills, bulletRole(entry.kind, bullet.text));
      const role = bulletRole(entry.kind, bullet.text);
      const opportunity = bulletOpportunity(strength, role, bullet.text);
      return {
        text: bullet.text,
        tier: strength.tier,
        advice: opportunity.diagnosis ?? strength.fixes[0] ?? "",
      };
    }),
  );
}

function publicStage(stage: Stage) {
  return {
    name: stage.name,
    extraction: stage.extraction
      ? {
          name: stage.extraction.profile.fullName,
          warnings: stage.extraction.warnings,
          entries: stage.extraction.entries.map((entry) => ({
            kind: entry.kind,
            title: entry.title,
            organization: entry.organization,
            startDate: entry.startDate,
            endDate: entry.endDate,
            isCurrent: entry.isCurrent,
            bullets: entry.bullets.map((bullet) => bullet.text),
          })),
          skills: stage.extraction.skills.map((skill) => skill.name),
        }
      : undefined,
    library: stage.library,
    guidance: stage.guidance,
    tailor: stage.tailor,
  };
}

type OracleFile = {
  fixture_people: {
    fixture_id: string;
    explicitly_unsupported?: string[];
    skill_tiers?: { explicitly_unsupported?: string[] };
    verified_benchmark_facts?: { value: string }[];
    dedup_expected?: { expect_distinct_jobs?: number };
  }[];
};

function scoreRun(input: {
  oracle: OracleFile;
  sparsePdf: ExtractedResume;
  sparseDocx: ExtractedResume;
  sparseLibrary: Library;
  beforeBullets: string[];
  mergedLibrary: Library;
  morganPdf: ExtractedResume;
  morganDocx: ExtractedResume;
  morganLibrary: Library;
  sparseA: GisTailorRun;
  sparseB: GisTailorRun;
  mergedA: GisTailorRun;
  mergedB: GisTailorRun;
  morganA: GisTailorRun;
  morganB: GisTailorRun;
}): ScoreCheck[] {
  const avery = input.oracle.fixture_people.find((person) => person.fixture_id === "avery_rowan");
  const counts = (avery?.verified_benchmark_facts ?? []).flatMap((fact) =>
    [...fact.value.matchAll(/\d[\d,]*/g)]
      .map((match) => match[0].replace(/,/g, ""))
      .filter((token) => !/^20\d\d$/.test(token) && (token.length >= 3 || Number(token) >= 12)),
  );
  const unsupported = (avery?.skill_tiers?.explicitly_unsupported ?? FORBIDDEN).map(normalizeTerm);
  const sparseText = [
    input.sparseLibrary.profile.summary ?? "",
    ...bulletTexts(input.sparseLibrary),
  ].join("\n");
  const mergedText = [
    input.mergedLibrary.profile.summary ?? "",
    ...bulletTexts(input.mergedLibrary),
  ].join("\n");
  const experience = input.mergedLibrary.entries.filter((entry) => entry.kind === "EXPERIENCE");
  const kept = input.beforeBullets.every((text) =>
    bulletTexts(input.mergedLibrary).some((later) => later.trim() === text.trim()),
  );
  const checks: ScoreCheck[] = [
    bothFormats("avery-formats", input.sparsePdf, input.sparseDocx, "Avery Rowan"),
    bothFormats("morgan-formats", input.morganPdf, input.morganDocx, "Morgan Quinn"),
    checkNoCounts(sparseText, counts),
    {
      id: "avery-two-roles",
      pass: experience.length === (avery?.dedup_expected?.expect_distinct_jobs ?? 2),
      severity: "blocker",
      detail: `Experience records after the second import: ${experience.length}.`,
    },
    {
      id: "avery-details-kept",
      pass: kept && counts.every((count) => hasStandaloneCount(mergedText, count)),
      severity: "high",
      detail: kept
        ? "Earlier bullets are still there, and the enriched counts are present."
        : "A bullet from the first import is missing, or an enriched count did not land.",
    },
    checkForbidden(input.sparseA.text, unsupported),
    checkForbidden(input.sparseB.text, unsupported),
    checkForbidden(input.mergedA.text, unsupported),
    checkForbidden(input.mergedB.text, unsupported),
    gapsSurfaced("job-b-sparse-gaps", input.sparseB),
    gapsSurfaced("job-b-merged-gaps", input.mergedB),
    {
      id: "job-a-and-b-differ",
      pass: input.mergedA.ok && input.mergedB.ok && input.mergedA.text !== input.mergedB.text,
      severity: "high",
      detail: "The analyst and developer resumes are not the same text.",
    },
    {
      id: "enriched-stronger",
      pass:
        input.sparseA.ok &&
        input.mergedA.ok &&
        input.mergedA.text !== input.sparseA.text &&
        counts.some((count) => hasStandaloneCount(input.mergedA.text, count)),
      severity: "high",
      detail: "The enriched Job A resume changed and carries a sourced count.",
    },
    {
      id: "accounts-isolated",
      pass:
        !blob(input.morganLibrary).includes("Maplehaven") &&
        !blob(input.mergedLibrary).includes("Clearbrook") &&
        !blob(input.mergedLibrary).includes("Westbridge"),
      severity: "blocker",
      detail: "Morgan's library has no Maplehaven text, and Avery's has no Clearbrook or Westbridge text.",
    },
    morganRank(input.morganA),
    {
      id: "tailor-succeeded",
      pass: [input.sparseA, input.sparseB, input.mergedA, input.mergedB, input.morganA, input.morganB].every(
        (run) => run.ok,
      ),
      severity: "high",
      detail: "Each tailor run finished. Export pages are scored separately.",
    },
    {
      id: "export-pages",
      pass: [input.sparseA, input.sparseB, input.mergedA, input.mergedB, input.morganA, input.morganB].every(
        (run) => run.exportOk && run.pages !== null && run.pages >= 1 && run.pages <= 2,
      ),
      severity: "medium",
      detail: exportDetail([
        ["sparse A", input.sparseA],
        ["sparse B", input.sparseB],
        ["merged A", input.mergedA],
        ["merged B", input.mergedB],
        ["Morgan A", input.morganA],
        ["Morgan B", input.morganB],
      ]),
    },
    {
      id: "enriched-specific",
      pass:
        input.mergedA.ok &&
        counts.filter((count) => hasStandaloneCount(input.mergedA.text, count)).length >= 3,
      severity: "high",
      detail: "Enriched Job A includes several sourced counts rather than one vague line.",
    },
    {
      id: "skill-levels",
      pass:
        input.mergedLibrary.skills.some((skill) => /basic/i.test(skill.name) && /fme/i.test(skill.name)) &&
        input.morganLibrary.skills.some(
          (skill) => /coursework/i.test(skill.name) || (/basic/i.test(skill.name) && /python/i.test(skill.name)),
        ),
      severity: "high",
      detail: `Avery skills: ${input.mergedLibrary.skills.map((skill) => skill.name).join(", ")}. Morgan skills: ${input.morganLibrary.skills.map((skill) => skill.name).join(", ")}.`,
    },
  ];
  return checks.map((check, index) =>
    check.id === "no-sparse-metrics" || check.id === "no-unsupported-tools"
      ? { ...check, id: `${check.id}-${index}` }
      : check,
  );
}

function bothFormats(
  id: string,
  pdf: ExtractedResume,
  docx: ExtractedResume,
  name: string,
): ScoreCheck {
  const pdfRoles = pdf.entries.filter((entry) => entry.kind === "EXPERIENCE").length;
  const docxRoles = docx.entries.filter((entry) => entry.kind === "EXPERIENCE").length;
  const pass =
    pdf.profile.fullName === name &&
    docx.profile.fullName === name &&
    pdfRoles >= 2 &&
    docxRoles >= 2;
  return {
    id,
    pass,
    severity: "high",
    detail: `PDF ${pdf.profile.fullName} ${pdfRoles} roles; DOCX ${docx.profile.fullName} ${docxRoles} roles.`,
  };
}

function exportDetail(runs: readonly (readonly [string, GisTailorRun])[]): string {
  return runs
    .map(([label, run]) =>
      run.exportOk ? `${label} ${run.pages} page(s)` : `${label} failed (${run.exportError ?? "no page count"})`,
    )
    .join("; ");
}

function gapsSurfaced(id: string, run: GisTailorRun): ScoreCheck {
  const blob = `${run.gaps.join(" ")} ${run.requirements
    .filter((item) => item.verdict !== "met")
    .map((item) => `${item.text} ${item.note}`)
    .join(" ")}`.toLowerCase();
  const named = /javascript|typescript|postgis|angular|c#|sdk/.test(blob);
  const notMet = run.requirements.some(
    (item) =>
      /javascript|typescript|postgis|angular|c#/i.test(item.text) && item.verdict !== "met",
  );
  return {
    id,
    pass: run.ok && (named || notMet),
    severity: "high",
    detail: run.ok
      ? `Gaps: ${run.gaps.join(" | ") || "(none)"}.`
      : `Tailor failed: ${run.error}`,
  };
}

function morganRank(run: GisTailorRun): ScoreCheck {
  const heat = run.text.search(/urban heat|arcgis pro/i);
  const intern = run.text.search(/clearbrook|gis intern/i);
  const retail = run.text.search(/westbridge|customer service/i);
  const pass =
    run.ok && heat !== -1 && intern !== -1 && (retail === -1 || (heat < retail && intern < retail));
  return {
    id: "morgan-priority",
    pass,
    severity: "high",
    detail: pass
      ? "The capstone and internship appear, and customer service does not lead."
      : "The junior resume did not put the GIS project and internship ahead of customer service.",
  };
}

function blob(library: Library): string {
  return [
    library.profile.fullName ?? "",
    library.profile.summary ?? "",
    ...library.entries.flatMap((entry) => [
      entry.title,
      entry.organization ?? "",
      ...entry.bullets.map((bullet) => bullet.text),
    ]),
  ].join("\n");
}

function normalizeTerm(term: string): string {
  return term
    .toLowerCase()
    .replace(/\/\.net/g, "")
    .replace(/\s+administration/g, "")
    .replace(/\s+certification/g, "")
    .replace(/\s+bilingualism/g, "")
    .replace("team management", "managed a team")
    .trim();
}

void main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "GIS beta run failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
