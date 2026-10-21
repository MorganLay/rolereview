/**
 * Dev eval harness. docs/05-AI.md → Evals.
 * ANALYZE + TAILOR + guard + score for each library × posting.
 * Does not print resume text, posting text, or model output.
 */
import "dotenv/config";

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { checkQuota, quotaSnapshot } from "@/features/billing/quota";
import { postProcessAnalyze } from "@/features/jobs/analyze";
import type { JobAnalysis } from "@/features/jobs/schemas";
import {
  LibrarySnapshot,
  type LibrarySnapshot as Snapshot,
} from "@/features/library/schemas";
import { libraryPromptText } from "@/features/library/serialize";
import { assembleResumeContent } from "@/features/tailor/assemble";
import { resumePlainText } from "@/features/tailor/plainText";
import { scoreMatch } from "@/features/tailor/score";
import type { MatchReport, ResumeContent } from "@/features/tailor/schemas";
import { validateTailorOutput } from "@/features/tailor/validate";
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

import {
  bulletCount,
  droppedBulletCount,
  formatMetricsTable,
  quotaShortfall,
  summaryLines,
  wordCount,
  type PairMetric,
} from "./metrics";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const root = path.dirname(fileURLToPath(import.meta.url));

type NamedText = { name: string; text: string };
type NamedSnapshot = { name: string; snapshot: Snapshot };

type PairFile = {
  pair: string;
  library: string;
  posting: string;
  seconds: number;
  costMicros: number;
  analyze: { ok: boolean; errorCode: string | null };
  tailor: { ok: boolean; errorCode: string | null } | null;
  reverts: number | null;
  droppedBullets: number | null;
  matchScore: number | null;
  words: number | null;
  guardIssues: { code: string; ref: string }[];
  analysis: JobAnalysis | null;
  snapshot: Snapshot;
  postingText: string;
  plainText: string | null;
  content: ResumeContent | null;
  matchReport: MatchReport | null;
};

class EvalStop extends Error {}

async function main() {
  if (env.NODE_ENV === "production") {
    throw new EvalStop("evals is dev only.");
  }

  const userId = env.SEED_USER_ID?.trim() ?? "";
  if (!UUID.test(userId)) {
    throw new EvalStop("Set SEED_USER_ID in .env to your Supabase user id.");
  }
  if (!env.ANTHROPIC_API_KEY) {
    throw new EvalStop("Set ANTHROPIC_API_KEY in .env.");
  }

  const libraries = await loadLibraries();
  const postings = await loadPostings();
  const pairs = libraries.flatMap((library) =>
    postings.map((posting) => ({
      library,
      posting,
      pair: `${library.name}__${posting.name}`,
    })),
  );
  if (pairs.length === 0) {
    throw new EvalStop("No library × posting pairs found.");
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, plan: true },
  });
  if (!user) {
    throw new EvalStop(
      "No User row for SEED_USER_ID. Sign in once, then run npm run evals again.",
    );
  }

  const [analyzeQuota, tailorQuota] = await Promise.all([
    quotaSnapshot(user, "ANALYZE"),
    quotaSnapshot(user, "TAILOR"),
  ]);
  const gaps = quotaShortfall({
    needed: pairs.length,
    analyzeRemaining: analyzeQuota.remaining,
    tailorRemaining: tailorQuota.remaining,
  });
  if (gaps.length > 0) {
    for (const gap of gaps) {
      console.error(
        `${gap.kind} remaining ${gap.remaining}, need ${gap.needed}.`,
      );
    }
    throw new EvalStop("No model calls were made.");
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.join(root, "out", stamp);
  await mkdir(outDir, { recursive: true });

  const metrics: PairMetric[] = [];
  for (const [index, item] of pairs.entries()) {
    console.log(`${index + 1}/${pairs.length} ${item.pair}`);
    try {
      const metric = await runPair({
        user,
        pair: item.pair,
        library: item.library,
        posting: item.posting,
        outDir,
      });
      metrics.push(metric);
    } catch (error) {
      if (error instanceof EvalStop) throw error;
      console.error(
        `${item.pair} failed (${error instanceof Error ? error.name : "Error"}).`,
      );
      metrics.push({
        pair: item.pair,
        reverts: null,
        droppedBullets: null,
        matchScore: null,
        words: null,
        seconds: 0,
        costMicros: 0,
      });
    }
  }

  console.log(formatMetricsTable(metrics));
  for (const line of summaryLines(metrics)) console.log(line);
  console.log(`evals/out/${stamp}`);
}

async function runPair(input: {
  user: { id: string; plan: "FREE" | "PRO" };
  pair: string;
  library: NamedSnapshot;
  posting: NamedText;
  outDir: string;
}): Promise<PairMetric> {
  const started = Date.now();
  let costMicros = 0;
  const base = {
    pair: input.pair,
    library: input.library.name,
    posting: input.posting.name,
    snapshot: input.library.snapshot,
    postingText: input.posting.text,
  };

  const analyzeQuota = await checkQuota(input.user, "ANALYZE");
  if (!analyzeQuota.allowed) {
    throw new EvalStop("ANALYZE quota ran out. Stopped before the next call.");
  }

  const analyzeRef = `eval:${input.pair}:ANALYZE`;
  const analyzed = await runStructured({
    kind: "ANALYZE",
    userId: input.user.id,
    usedBonusCredit: analyzeQuota.useBonus,
    system: ANALYZE_SYSTEM,
    content: buildAnalyzeContent(input.posting.text),
    schema: AnalyzeSchema,
    refId: analyzeRef,
  });
  costMicros += await costFor(input.user.id, analyzeRef);

  if (!analyzed.ok) {
    return finish(input.outDir, {
      ...base,
      seconds: secondsSince(started),
      costMicros,
      analyze: { ok: false, errorCode: analyzed.code },
      tailor: null,
      reverts: null,
      droppedBullets: null,
      matchScore: null,
      words: null,
      guardIssues: [],
      analysis: null,
      plainText: null,
      content: null,
      matchReport: null,
    });
  }

  let analysis: JobAnalysis;
  try {
    analysis = postProcessAnalyze(analyzed.data);
  } catch {
    return finish(input.outDir, {
      ...base,
      seconds: secondsSince(started),
      costMicros,
      analyze: { ok: false, errorCode: "VALIDATION" },
      tailor: null,
      reverts: null,
      droppedBullets: null,
      matchScore: null,
      words: null,
      guardIssues: [],
      analysis: null,
      plainText: null,
      content: null,
      matchReport: null,
    });
  }

  const tailorQuota = await checkQuota(input.user, "TAILOR");
  if (!tailorQuota.allowed) {
    throw new EvalStop("TAILOR quota ran out. Stopped before the next call.");
  }

  const tailorRef = `eval:${input.pair}:TAILOR`;
  const tailored = await runStructured({
    kind: "TAILOR",
    userId: input.user.id,
    usedBonusCredit: tailorQuota.useBonus,
    system: TAILOR_SYSTEM,
    content: buildTailorContent({
      libraryText: libraryPromptText(input.library.snapshot),
      title: analysis.title,
      company: analysis.company,
      seniority: analysis.seniority,
      requirements: analysis.requirements,
      keywords: analysis.keywords,
      posting: input.posting.text,
      length: 1,
      emphasis: null,
    }),
    schema: TailorSchema,
    refId: tailorRef,
  });
  costMicros += await costFor(input.user.id, tailorRef);

  if (!tailored.ok) {
    return finish(input.outDir, {
      ...base,
      seconds: secondsSince(started),
      costMicros,
      analyze: { ok: true, errorCode: null },
      tailor: { ok: false, errorCode: tailored.code },
      reverts: null,
      droppedBullets: null,
      matchScore: null,
      words: null,
      guardIssues: [],
      analysis,
      plainText: null,
      content: null,
      matchReport: null,
    });
  }

  const guard = validateTailorOutput(
    tailored.data,
    input.library.snapshot,
    analysis,
  );
  const content = assembleResumeContent(guard.output, input.library.snapshot);
  const matchReport = scoreMatch(analysis, guard.output.requirementMatches);
  const plainText = resumePlainText(content, input.library.snapshot);
  const droppedBullets = droppedBulletCount(
    bulletCount(tailored.data.entries),
    bulletCount(guard.output.entries),
  );

  return finish(input.outDir, {
    ...base,
    seconds: secondsSince(started),
    costMicros,
    analyze: { ok: true, errorCode: null },
    tailor: { ok: true, errorCode: null },
    reverts: guard.reverts,
    droppedBullets,
    matchScore: matchReport.score,
    words: wordCount(plainText),
    guardIssues: guard.issues.map((issue) => ({
      code: issue.code,
      ref: issue.ref,
    })),
    analysis,
    plainText,
    content,
    matchReport,
  });
}

async function finish(outDir: string, file: PairFile): Promise<PairMetric> {
  await writeFile(
    path.join(outDir, `${file.pair}.json`),
    `${JSON.stringify(file, null, 2)}\n`,
  );
  return {
    pair: file.pair,
    reverts: file.reverts,
    droppedBullets: file.droppedBullets,
    matchScore: file.matchScore,
    words: file.words,
    seconds: file.seconds,
    costMicros: file.costMicros,
  };
}

async function costFor(userId: string, refId: string): Promise<number> {
  const row = await db.aiCall.findFirst({
    where: { userId, refId },
    orderBy: { createdAt: "desc" },
    select: { costMicros: true },
  });
  return row?.costMicros ?? 0;
}

async function loadLibraries(): Promise<NamedSnapshot[]> {
  const dir = path.join(root, "fixtures", "libraries");
  const names = (await readdir(dir))
    .filter((name) => name.endsWith(".json"))
    .sort((a, b) => a.localeCompare(b));
  const libraries: NamedSnapshot[] = [];
  for (const filename of names) {
    const name = filename.slice(0, -".json".length);
    let raw: unknown;
    try {
      raw = JSON.parse(await readFile(path.join(dir, filename), "utf8"));
    } catch {
      throw new EvalStop(`Invalid JSON in library fixture ${filename}.`);
    }
    const parsed = LibrarySnapshot.safeParse(raw);
    if (!parsed.success) {
      const fields = parsed.error.issues
        .map((issue) => issue.path.join("."))
        .join(", ");
      throw new EvalStop(`Invalid library fixture ${filename} (${fields}).`);
    }
    libraries.push({ name, snapshot: parsed.data });
  }
  return libraries;
}

async function loadPostings(): Promise<NamedText[]> {
  const dir = path.join(root, "fixtures", "postings");
  const names = (await readdir(dir))
    .filter((name) => name.endsWith(".txt"))
    .sort((a, b) => a.localeCompare(b));
  const postings: NamedText[] = [];
  for (const filename of names) {
    const text = (await readFile(path.join(dir, filename), "utf8")).trim();
    if (text.length === 0) {
      throw new EvalStop(`Empty posting fixture ${filename}.`);
    }
    postings.push({ name: filename.slice(0, -".txt".length), text });
  }
  return postings;
}

function secondsSince(started: number): number {
  return Math.round((Date.now() - started) / 100) / 10;
}

main()
  .catch((error: unknown) => {
    if (error instanceof EvalStop) {
      console.error(error.message);
    } else {
      console.error(error instanceof Error ? error.name : "Error");
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
