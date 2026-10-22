/**
 * Pre-generate the 9 marketing demo resumes.
 * docs/09-MARKETING.md → section 6. docs/06-ROADMAP.md → T12.2.
 * ANALYZE + TAILOR + guard + score. No cover letters.
 * Does not print resume text, posting text, or model output.
 */
import "dotenv/config";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { checkQuota, quotaSnapshot } from "@/features/billing/quota";
import { postProcessAnalyze } from "@/features/jobs/analyze";
import type { JobAnalysis } from "@/features/jobs/schemas";
import { LibrarySnapshot, type LibrarySnapshot as Snapshot } from "@/features/library/schemas";
import { libraryPromptText } from "@/features/library/serialize";
import { assembleResumeContent } from "@/features/tailor/assemble";
import { scoreMatch } from "@/features/tailor/score";
import { validateTailorOutput } from "@/features/tailor/validate";
import { demoFixtureDir } from "@/features/marketing/demo/load";
import {
  DEMO_PERSONAS,
  DEMO_POSTINGS,
  DemoFixture,
  type DemoPersonaId,
  type DemoPostingId,
} from "@/features/marketing/demo/schema";
import {
  buildContent as buildAnalyzeContent,
  OutputSchema as AnalyzeSchema,
  SYSTEM as ANALYZE_SYSTEM,
} from "@/lib/ai/prompts/analyze";
import {
  buildContent as buildTailorContent,
  OutputSchema as TailorSchema,
  SYSTEM as TAILOR_SYSTEM,
} from "@/lib/ai/prompts/tailor";
import { runStructured } from "@/lib/ai/run";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const root = path.dirname(fileURLToPath(import.meta.url));

class DemoStop extends Error {}

type Pair = {
  persona: DemoPersonaId;
  posting: DemoPostingId;
  pair: string;
  snapshot: Snapshot;
  postingText: string;
  jobLabel: string;
};

async function main() {
  if (env.NODE_ENV === "production") {
    throw new DemoStop("demo:fixtures is dev only.");
  }

  const userId = env.SEED_USER_ID?.trim() ?? "";
  if (!UUID.test(userId)) {
    throw new DemoStop("Set SEED_USER_ID in .env to your Supabase user id.");
  }
  if (!env.ANTHROPIC_API_KEY) {
    throw new DemoStop("Set ANTHROPIC_API_KEY in .env.");
  }

  const pairs = await loadPairs();
  const outDir = demoFixtureDir();
  await mkdir(outDir, { recursive: true });

  const pending: Pair[] = [];
  for (const pair of pairs) {
    if (await existingFixture(outDir, pair.pair)) {
      console.log(`skip ${pair.pair}`);
      continue;
    }
    pending.push(pair);
  }
  if (pending.length === 0) {
    console.log(`${pairs.length} fixtures ready`);
    return;
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, plan: true },
  });
  if (!user) {
    throw new DemoStop(
      "No User row for SEED_USER_ID. Sign in once, then run npm run demo:fixtures again.",
    );
  }

  const [analyzeQuota, tailorQuota] = await Promise.all([
    quotaSnapshot(user, "ANALYZE"),
    quotaSnapshot(user, "TAILOR"),
  ]);
  if (analyzeQuota.remaining < pending.length) {
    console.error(
      `ANALYZE remaining ${analyzeQuota.remaining}, need ${pending.length}.`,
    );
    throw new DemoStop("No model calls were made.");
  }
  if (tailorQuota.remaining < pending.length) {
    console.error(
      `TAILOR remaining ${tailorQuota.remaining}, need ${pending.length}.`,
    );
    throw new DemoStop("No model calls were made.");
  }

  let failed = 0;
  for (const [index, pair] of pending.entries()) {
    console.log(`${index + 1}/${pending.length} ${pair.pair}`);
    try {
      const written = await runPair(user, pair, outDir);
      console.log(
        `${pair.pair} score ${written.score ?? "—"} reverts ${written.reverts} $${(written.costMicros / 1_000_000).toFixed(4)}`,
      );
    } catch (error) {
      if (error instanceof DemoStop) throw error;
      failed += 1;
      console.error(
        `${pair.pair} failed (${error instanceof Error ? error.name : "Error"}).`,
      );
    }
  }

  if (failed > 0) {
    throw new DemoStop(`${failed} pair(s) failed. Existing files were left in place.`);
  }
  console.log(`${pairs.length} fixtures ready`);
}

async function runPair(
  user: { id: string; plan: "FREE" | "PRO" },
  pair: Pair,
  outDir: string,
): Promise<{ score: number | null; reverts: number; costMicros: number }> {
  let costMicros = 0;

  const analyzeQuota = await checkQuota(user, "ANALYZE");
  if (!analyzeQuota.allowed) {
    throw new DemoStop("ANALYZE quota ran out. Stopped before the next call.");
  }

  const analyzeRef = `demo:${pair.pair}:ANALYZE`;
  const analyzed = await runStructured({
    kind: "ANALYZE",
    userId: user.id,
    usedBonusCredit: analyzeQuota.useBonus,
    system: ANALYZE_SYSTEM,
    content: buildAnalyzeContent(pair.postingText),
    schema: AnalyzeSchema,
    refId: analyzeRef,
  });
  costMicros += await costFor(user.id, analyzeRef);
  if (!analyzed.ok) {
    throw new DemoStop(`ANALYZE ${analyzed.code}`);
  }

  let analysis: JobAnalysis;
  try {
    analysis = postProcessAnalyze(analyzed.data);
  } catch {
    throw new DemoStop("ANALYZE VALIDATION");
  }

  const tailorQuota = await checkQuota(user, "TAILOR");
  if (!tailorQuota.allowed) {
    throw new DemoStop("TAILOR quota ran out. Stopped before the next call.");
  }

  const tailorRef = `demo:${pair.pair}:TAILOR`;
  const tailored = await runStructured({
    kind: "TAILOR",
    userId: user.id,
    usedBonusCredit: tailorQuota.useBonus,
    system: TAILOR_SYSTEM,
    content: buildTailorContent({
      libraryText: libraryPromptText(pair.snapshot),
      title: analysis.title,
      company: analysis.company,
      seniority: analysis.seniority,
      requirements: analysis.requirements,
      keywords: analysis.keywords,
      posting: pair.postingText,
      length: 1,
      emphasis: null,
    }),
    schema: TailorSchema,
    refId: tailorRef,
  });
  costMicros += await costFor(user.id, tailorRef);
  if (!tailored.ok) {
    throw new DemoStop(`TAILOR ${tailored.code}`);
  }

  const guard = validateTailorOutput(tailored.data, pair.snapshot, analysis);
  const content = assembleResumeContent(guard.output, pair.snapshot);
  const match = scoreMatch(analysis, guard.output.requirementMatches);
  const fixture = DemoFixture.safeParse({
    persona: pair.persona,
    posting: pair.posting,
    jobLabel: pair.jobLabel,
    snapshot: pair.snapshot,
    analysis,
    content,
    match,
  });
  if (!fixture.success) {
    const fields = fixture.error.issues
      .map((issue) => issue.path.join("."))
      .join(", ");
    throw new DemoStop(`Fixture validation (${fields}).`);
  }

  await writeFile(
    path.join(outDir, `${pair.pair}.json`),
    `${JSON.stringify(fixture.data, null, 2)}\n`,
  );
  return { score: match.score, reverts: guard.reverts, costMicros };
}

async function existingFixture(outDir: string, pair: string): Promise<boolean> {
  let raw: string;
  try {
    raw = await readFile(path.join(outDir, `${pair}.json`), "utf8");
  } catch {
    return false;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return false;
  }
  return DemoFixture.safeParse(parsed).success;
}

async function loadPairs(): Promise<Pair[]> {
  const pairs: Pair[] = [];
  for (const persona of DEMO_PERSONAS) {
    const snapshot = await loadSnapshot(persona);
    for (const posting of DEMO_POSTINGS) {
      const postingFile = await loadPosting(posting);
      pairs.push({
        persona,
        posting,
        pair: `${persona}__${posting}`,
        snapshot,
        postingText: postingFile.text,
        jobLabel: postingFile.label,
      });
    }
  }
  return pairs;
}

async function loadSnapshot(persona: DemoPersonaId): Promise<Snapshot> {
  const filename = `${persona}.json`;
  const full = path.join(fixturesRoot(), "libraries", filename);
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(full, "utf8"));
  } catch {
    throw new DemoStop(`Invalid JSON in library fixture ${filename}.`);
  }
  const parsed = LibrarySnapshot.safeParse(raw);
  if (!parsed.success) {
    const fields = parsed.error.issues
      .map((issue) => issue.path.join("."))
      .join(", ");
    throw new DemoStop(`Invalid library fixture ${filename} (${fields}).`);
  }
  return parsed.data;
}

async function loadPosting(
  posting: DemoPostingId,
): Promise<{ text: string; label: string }> {
  const filename = `${posting}.txt`;
  const text = (await readFile(path.join(fixturesRoot(), "postings", filename), "utf8")).trim();
  const label = text.split(/\r?\n/).find((line) => line.trim().length > 0)?.trim() ?? "";
  if (text.length === 0 || label.length === 0) {
    throw new DemoStop(`Empty posting fixture ${filename}.`);
  }
  return { text, label };
}

function fixturesRoot(): string {
  return path.join(root, "fixtures");
}

async function costFor(userId: string, refId: string): Promise<number> {
  const row = await db.aiCall.findFirst({
    where: { userId, refId },
    orderBy: { createdAt: "desc" },
    select: { costMicros: true },
  });
  return row?.costMicros ?? 0;
}

void main()
  .catch((error: unknown) => {
    if (error instanceof DemoStop) {
      console.error(error.message);
    } else {
      console.error(error instanceof Error ? error.name : "Error");
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
