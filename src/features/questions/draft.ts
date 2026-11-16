import "server-only";

import type { QuestionDraftDestination } from "@/generated/prisma/enums";
import { JobAnalysis } from "@/features/jobs/schemas";
import { formatConfirmedAnswer } from "@/features/library/strengthen-confirm";
import { skillNameKey } from "@/features/library/skill-state";
import { SKILL_LIMITS } from "@/features/library/schemas";
import { buildDraft, DRAFT_SYSTEM, DraftSchema } from "@/lib/ai/prompts/job-questions";
import { runStructured } from "@/lib/ai/run";
import { db } from "@/lib/db";

import { lineDestination, reviewDraftLine } from "./draft-guard";
import { cleanQuestion } from "./filter";
import type { QuestionKind } from "./filter";

const KIND: Record<string, QuestionKind> = {
  CONFIRM: "confirm",
  DETAIL: "detail",
  SCALE: "scale",
  OUTCOME: "outcome",
  ROLE: "role",
};

type DraftRow = {
  id: string;
  kind: QuestionKind;
  question: string;
  detail: string;
  followUp: string | null;
  followUpDetail: string;
  draftText: string | null;
  draftDropped: boolean;
  topicKey: string;
  entryId: string | null;
  entryTitle: string | null;
  requirementKind: string;
  evidence: string[];
};

/** One draft call for the confirmed answers that still need a line. */
export async function draftConfirmed(
  userId: string,
  jobId: string,
  followUpRound: boolean,
): Promise<{ ok: true } | { ok: false; code: "NOT_FOUND" | "AI_FAILED" | "VALIDATION" }> {
  const rows = await loadDraftRows(userId, jobId);
  const pending = rows.filter((row) => {
    if (row.draftText) return false;
    if (followUpRound) {
      return row.followUp !== null && row.followUpDetail.trim().length > 0 && !row.draftDropped;
    }
    return row.followUp === null && !row.draftDropped;
  });
  if (pending.length === 0) return { ok: true };

  const result = await runStructured({
    kind: "JOB_QUESTIONS",
    userId,
    countsTowardQuota: false,
    system: DRAFT_SYSTEM,
    content: buildDraft({
      followUpRound,
      items: pending.map((row) => ({
        questionId: row.id,
        kind: row.kind,
        requirementKind: row.requirementKind,
        entryTitle: row.entryTitle,
        confirmed: confirmedLine(row),
        library: row.evidence.join("\n"),
      })),
    }),
    schema: DraftSchema,
    refId: jobId,
  });
  if (!result.ok) return { ok: false, code: "AI_FAILED" };

  const byId = new Map(result.data.items.map((item) => [item.questionId, item]));
  await db.$transaction(async (tx) => {
    for (const row of pending) {
      const item = byId.get(row.id);
      const followUp =
        !followUpRound && item?.followUp && row.followUp === null
          ? cleanQuestion(item.followUp)
          : null;
      if (followUp) {
        await tx.jobQuestion.updateMany({
          where: { id: row.id, userId },
          data: { followUp, draftText: null, draftDropped: false, draftDestination: null },
        });
        continue;
      }
      const destination = lineDestination({
        kind: row.kind,
        requirementKind: row.requirementKind,
        entryId: row.entryId,
      });
      const reviewed =
        item?.text && destination
          ? reviewDraftLine({
              text: item.text,
              answer: confirmedLine(row),
              evidence: row.evidence,
              kind: row.kind,
            })
          : { ok: false as const, reason: "empty" as const };
      const text = reviewed.ok ? fitDestination(reviewed.text, destination) : null;
      await tx.jobQuestion.updateMany({
        where: { id: row.id, userId },
        data: {
          draftText: text,
          draftDropped: text === null,
          draftDestination: text && destination ? destination : null,
        },
      });
    }
  });
  return { ok: true };
}

export async function draftSingle(
  userId: string,
  questionId: string,
  answer: string,
): Promise<
  | { ok: true; text: string | null; destination: QuestionDraftDestination | null; dropped: boolean }
  | { ok: false; code: "NOT_FOUND" | "AI_FAILED" }
> {
  const row = await loadOne(userId, questionId, answer);
  if (!row) return { ok: false, code: "NOT_FOUND" };
  const result = await runStructured({
    kind: "JOB_QUESTIONS",
    userId,
    countsTowardQuota: false,
    system: DRAFT_SYSTEM,
    content: buildDraft({
      followUpRound: true,
      items: [
        {
          questionId: row.id,
          kind: row.kind,
          requirementKind: row.requirementKind,
          entryTitle: row.entryTitle,
          confirmed: confirmedLine(row),
          library: row.evidence.join("\n"),
        },
      ],
    }),
    schema: DraftSchema,
    refId: questionId,
  });
  if (!result.ok) return { ok: false, code: "AI_FAILED" };
  const item = result.data.items.find((candidate) => candidate.questionId === row.id);
  const destination = lineDestination({
    kind: row.kind,
    requirementKind: row.requirementKind,
    entryId: row.entryId,
  });
  const reviewed =
    item?.text && destination
      ? reviewDraftLine({
          text: item.text,
          answer: confirmedLine(row),
          evidence: row.evidence,
          kind: row.kind,
        })
      : null;
  const text = reviewed?.ok ? fitDestination(reviewed.text, destination) : null;
  return {
    ok: true,
    text,
    destination: text && destination ? destination : null,
    dropped: text === null,
  };
}

export function guardEditedLine(input: {
  text: string;
  answer: string;
  evidence: readonly string[];
  kind: QuestionKind;
  destination: "BULLET" | "SKILL" | "CERTIFICATION" | null;
}): string | null {
  const reviewed = reviewDraftLine({
    text: input.text,
    answer: input.answer,
    evidence: input.evidence,
    kind: input.kind,
  });
  if (!reviewed.ok || !input.destination) return null;
  return fitDestination(reviewed.text, input.destination);
}

async function loadDraftRows(userId: string, jobId: string): Promise<DraftRow[]> {
  const job = await db.job.findFirst({
    where: { id: jobId, userId },
    select: { analysis: true },
  });
  if (!job) return [];
  const questions = await db.jobQuestion.findMany({
    where: { userId, jobId, status: "YES" },
    select: {
      id: true,
      kind: true,
      question: true,
      detail: true,
      followUp: true,
      followUpDetail: true,
      draftText: true,
      draftDropped: true,
      topicKey: true,
      requirementId: true,
      entryId: true,
      entry: {
        select: {
          title: true,
          organization: true,
          bullets: { select: { text: true } },
        },
      },
    },
  });
  const requirementKind = requirementKinds(job.analysis);
  const skills = await db.skill.findMany({ where: { userId }, select: { name: true } });
  return questions.map((question) => ({
    id: question.id,
    kind: KIND[question.kind] ?? "detail",
    question: question.question,
    detail: question.detail ?? "",
    followUp: question.followUp,
    followUpDetail: question.followUpDetail ?? "",
    draftText: question.draftText,
    draftDropped: question.draftDropped,
    topicKey: question.topicKey,
    entryId: question.entryId,
    entryTitle: question.entry?.title ?? null,
    requirementKind: requirementKind.get(question.requirementId) ?? "other",
    evidence: evidenceFor(question.entry, skills.map((skill) => skill.name)),
  }));
}

async function loadOne(userId: string, questionId: string, answer: string): Promise<DraftRow | null> {
  const question = await db.jobQuestion.findFirst({
    where: { id: questionId, userId },
    select: {
      id: true,
      jobId: true,
      kind: true,
      question: true,
      topicKey: true,
      requirementId: true,
      entryId: true,
      entry: {
        select: { title: true, organization: true, bullets: { select: { text: true } } },
      },
    },
  });
  if (!question) return null;
  const job = await db.job.findFirst({
    where: { id: question.jobId, userId },
    select: { analysis: true },
  });
  const skills = await db.skill.findMany({ where: { userId }, select: { name: true } });
  return {
    id: question.id,
    kind: KIND[question.kind] ?? "detail",
    question: question.question,
    detail: answer,
    followUp: null,
    followUpDetail: "",
    draftText: null,
    draftDropped: false,
    topicKey: question.topicKey,
    entryId: question.entryId,
    entryTitle: question.entry?.title ?? null,
    requirementKind: requirementKinds(job?.analysis).get(question.requirementId) ?? "other",
    evidence: evidenceFor(question.entry, skills.map((skill) => skill.name)),
  };
}

function confirmedLine(row: Pick<DraftRow, "question" | "detail" | "followUpDetail">): string {
  const detail = [row.detail, row.followUpDetail].filter((part) => part.trim().length > 0).join(" ");
  return formatConfirmedAnswer(row.question, detail);
}

function evidenceFor(
  entry: { title: string; organization: string | null; bullets: { text: string }[] } | null,
  skills: string[],
): string[] {
  const lines = [
    entry?.title ?? "",
    entry?.organization ?? "",
    ...(entry?.bullets.map((bullet) => bullet.text) ?? []),
    ...skills,
  ];
  return lines.map((line) => line.trim()).filter((line) => line.length > 0);
}

function requirementKinds(analysis: unknown): Map<string, string> {
  const parsed = JobAnalysis.safeParse(analysis);
  const map = new Map<string, string>();
  if (!parsed.success) return map;
  for (const requirement of parsed.data.requirements) {
    map.set(requirement.id, requirement.kind);
  }
  return map;
}

function fitDestination(
  text: string,
  destination: "BULLET" | "SKILL" | "CERTIFICATION" | null,
): string | null {
  const line = text.trim();
  if (line.length === 0 || !destination) return null;
  if (destination === "SKILL") {
    return line.length <= SKILL_LIMITS.name ? line : null;
  }
  if (destination === "CERTIFICATION") return line.length <= 120 ? line : null;
  return line.length <= 400 ? line : null;
}

export function skillKey(name: string): string {
  return skillNameKey(name);
}
