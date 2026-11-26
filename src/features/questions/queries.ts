import "server-only";

import { db } from "@/lib/db";
import { recoverRequirements } from "@/features/jobs/requirement-text";
import { JobAnalysis } from "@/features/jobs/schemas";

import { libraryRevision } from "./revision";
import type { AnswerOriginView, JobQuestionView, QuestionCardPhase } from "./view";

const KIND = {
  CONFIRM: "confirm",
  DETAIL: "detail",
  SCALE: "scale",
  OUTCOME: "outcome",
  ROLE: "role",
} as const;

export async function getQuestionCard(
  userId: string,
  jobId: string,
): Promise<QuestionCardPhase | null> {
  const loaded = await loadJobLibrary(userId, jobId);
  if (!loaded) return null;
  if (loaded.entryCount + loaded.skillCount === 0) return null;
  if (loaded.job.analysisStatus !== "READY") return null;

  const set = await db.jobQuestionSet.findFirst({
    where: { userId, jobId },
    select: {
      status: true,
      libraryRevision: true,
      savedAt: true,
      questions: { select: { status: true } },
    },
  });
  if (!set || set.status === "GENERATING") return { phase: "prepare" };
  if (set.status === "FAILED") return { phase: "failed" };

  const stale = set.libraryRevision !== loaded.revision;
  const answered = set.questions.some((question) => question.status !== "OPEN");
  if (set.status === "EMPTY") {
    return stale && !answered ? { phase: "refresh" } : null;
  }

  const open = set.questions.filter((question) => question.status === "OPEN").length;
  const yes = set.questions.filter((question) => question.status === "YES").length;
  if (set.savedAt) {
    const count = await db.evidenceOrigin.count({ where: { userId, jobId } });
    return { phase: "saved", count };
  }
  if (open === 0 && yes > 0) return { phase: "review", count: yes };
  if (open === 0) return null;
  return { phase: "ask", count: open, refresh: stale && !answered };
}

export async function listJobQuestions(
  userId: string,
  jobId: string,
): Promise<JobQuestionView[] | null> {
  const rows = await db.jobQuestion.findMany({
    where: { userId, jobId },
    orderBy: { position: "asc" },
    select: {
      id: true,
      position: true,
      kind: true,
      question: true,
      why: true,
      requirementId: true,
      status: true,
      detail: true,
      followUp: true,
      followUpDetail: true,
      draftText: true,
      draftDestination: true,
      draftDropped: true,
      entry: { select: { title: true } },
    },
  });
  if (rows.length === 0) return null;
  return rows.map((row) => ({
    id: row.id,
    position: row.position,
    kind: KIND[row.kind],
    question: row.question,
    why: row.why,
    about: row.entry?.title ?? null,
    requirementId: row.requirementId,
    status: row.status,
    detail: row.detail ?? "",
    followUp: row.followUp,
    followUpDetail: row.followUpDetail ?? "",
    draftText: row.draftText,
    draftDestination: row.draftDestination,
    draftDropped: row.draftDropped,
    destinationLabel: row.entry?.title ?? destinationFallback(row.draftDestination),
  }));
}

export async function openQuestionLinks(
  userId: string,
  jobId: string,
): Promise<Record<string, string>> {
  const rows = await db.jobQuestion.findMany({
    where: { userId, jobId, status: "OPEN" },
    select: { requirementId: true },
  });
  const links: Record<string, string> = {};
  for (const row of rows) {
    if (!links[row.requirementId]) {
      links[row.requirementId] = `/jobs/${jobId}/questions?requirement=${encodeURIComponent(row.requirementId)}`;
    }
  }
  return links;
}

export async function savedQuestionIds(userId: string, jobId: string): Promise<string[]> {
  const rows = await db.evidenceOrigin.findMany({
    where: { userId, jobId },
    select: { questionId: true },
  });
  return rows.flatMap((row) => (row.questionId ? [row.questionId] : []));
}

export async function listAnswerOrigins(userId: string): Promise<AnswerOriginView[]> {
  const rows = await db.evidenceOrigin.findMany({
    where: { userId, source: "answer" },
    orderBy: { answeredAt: "desc" },
    select: {
      id: true,
      question: true,
      answer: true,
      answeredAt: true,
      bulletId: true,
      skillId: true,
      entryId: true,
    },
  });
  return rows.map((row) => ({
    id: row.id,
    question: row.question,
    answer: row.answer,
    answeredLabel: formatAnswerDate(row.answeredAt),
    bulletId: row.bulletId,
    skillId: row.skillId,
    entryId: row.entryId,
  }));
}

export async function loadJobLibrary(userId: string, jobId: string) {
  const job = await db.job.findFirst({
    where: { id: jobId, userId },
    select: { id: true, rawText: true, analysis: true, analysisStatus: true },
  });
  if (!job) return null;
  const [entries, skills] = await Promise.all([
    db.entry.findMany({
      where: { userId },
      select: {
        id: true,
        updatedAt: true,
        title: true,
        organization: true,
        kind: true,
        bullets: { select: { id: true, text: true, updatedAt: true } },
      },
    }),
    db.skill.findMany({
      where: { userId },
      select: { id: true, name: true },
    }),
  ]);
  const analysis = JobAnalysis.safeParse(job.analysis);
  return {
    job,
    analysis: analysis.success
      ? {
          ...analysis.data,
          requirements: recoverRequirements(analysis.data.requirements, job.rawText),
        }
      : null,
    entries,
    skills,
    entryCount: entries.length,
    skillCount: skills.length,
    revision: libraryRevision({
      entries: entries.map((entry) => ({
        id: entry.id,
        updatedAt: entry.updatedAt.toISOString(),
        bullets: entry.bullets.map((bullet) => ({
          id: bullet.id,
          updatedAt: bullet.updatedAt.toISOString(),
        })),
      })),
      skills,
    }),
  };
}

function destinationFallback(
  destination: "BULLET" | "SKILL" | "CERTIFICATION" | null,
): string | null {
  if (destination === "SKILL") return "Skills";
  if (destination === "CERTIFICATION") return "Certifications";
  return null;
}

function formatAnswerDate(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}
