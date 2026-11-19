"use server";

import { revalidatePath } from "next/cache";

import { requireUserForAction } from "@/lib/auth";
import { jobQuestionsEnabled } from "@/lib/env";
import { db } from "@/lib/db";
import { fail, ok, type ActionResult } from "@/lib/result";

import { draftConfirmed, draftSingle, guardEditedLine, skillKey } from "./draft";
import type { QuestionKind } from "./filter";
import { generateJobQuestions } from "./prepare";
import { getQuestionCard } from "./queries";
import {
  applyRevisionSchema,
  followUpSchema,
  draftRequestSchema,
  jobIdSchema,
  reviseAnswerSchema,
  saveAnswerSchema,
  saveLinesSchema,
} from "./schemas";

const DETAIL_KINDS = new Set(["DETAIL", "SCALE", "OUTCOME", "ROLE"]);

const KIND: Record<string, QuestionKind> = {
  CONFIRM: "confirm",
  DETAIL: "detail",
  SCALE: "scale",
  OUTCOME: "outcome",
  ROLE: "role",
};

export async function prepareJobQuestions(
  input: unknown,
): Promise<ActionResult<{ status: string }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");
  if (!jobQuestionsEnabled()) return fail("NOT_FOUND");
  const parsed = jobIdSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION");
  const result = await generateJobQuestions(user.id, parsed.data.jobId, "prepare");
  if (!result.ok) return fail(result.code);
  revalidatePath(`/jobs/${parsed.data.jobId}`);
  return ok({ status: result.status });
}

export async function readJobQuestionCard(
  input: unknown,
): Promise<ActionResult<{ phase: string | null }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");
  if (!jobQuestionsEnabled()) return fail("NOT_FOUND");
  const parsed = jobIdSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION");
  const card = await getQuestionCard(user.id, parsed.data.jobId);
  return ok({ phase: card?.phase ?? null });
}

export async function retryJobQuestions(
  input: unknown,
): Promise<ActionResult<{ status: string }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");
  if (!jobQuestionsEnabled()) return fail("NOT_FOUND");
  const parsed = jobIdSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION");
  const result = await generateJobQuestions(user.id, parsed.data.jobId, "retry");
  if (!result.ok) return fail(result.code);
  revalidatePath(`/jobs/${parsed.data.jobId}`);
  return ok({ status: result.status });
}

export async function refreshJobQuestions(
  input: unknown,
): Promise<ActionResult<{ status: string }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");
  if (!jobQuestionsEnabled()) return fail("NOT_FOUND");
  const parsed = jobIdSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION");
  const result = await generateJobQuestions(user.id, parsed.data.jobId, "refresh");
  if (!result.ok) return fail(result.code);
  revalidatePath(`/jobs/${parsed.data.jobId}`);
  return ok({ status: result.status });
}

export async function saveJobAnswer(
  input: unknown,
): Promise<ActionResult<{ saved: true }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");
  if (!jobQuestionsEnabled()) return fail("NOT_FOUND");
  const parsed = saveAnswerSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", parsed.error.flatten().fieldErrors);
  const question = await db.jobQuestion.findFirst({
    where: { id: parsed.data.questionId, userId: user.id },
    select: {
      id: true,
      jobId: true,
      kind: true,
      question: true,
      topicKey: true,
    },
  });
  if (!question) return fail("NOT_FOUND");
  const detail = parsed.data.detail?.trim() ?? "";
  if (parsed.data.status === "YES" && DETAIL_KINDS.has(question.kind) && detail.length === 0) {
    return fail("VALIDATION", { detail: ["Add a sentence or two."] });
  }

  await db.$transaction(async (tx) => {
    await tx.jobQuestion.updateMany({
      where: { id: question.id, userId: user.id },
      data: {
        status: parsed.data.status,
        detail: parsed.data.status === "YES" ? detail : null,
        draftText: null,
        draftDropped: false,
        draftDestination: null,
        followUp: null,
        followUpDetail: null,
      },
    });
    if (parsed.data.status === "SKIPPED") {
      await tx.answerTopic.deleteMany({
        where: { userId: user.id, topicKey: question.topicKey, jobId: question.jobId },
      });
      return;
    }
    const declined = parsed.data.status === "NOT_YET";
    await tx.answerTopic.upsert({
      where: { userId_topicKey: { userId: user.id, topicKey: question.topicKey } },
      create: {
        userId: user.id,
        topicKey: question.topicKey,
        declined,
        jobId: question.jobId,
        question: question.question,
      },
      update: { declined, jobId: question.jobId, question: question.question },
    });
  });

  revalidatePath(`/jobs/${question.jobId}`);
  return ok({ saved: true });
}

export async function saveFollowUp(
  input: unknown,
): Promise<ActionResult<{ saved: true }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");
  if (!jobQuestionsEnabled()) return fail("NOT_FOUND");
  const parsed = followUpSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", parsed.error.flatten().fieldErrors);
  const question = await db.jobQuestion.findFirst({
    where: { id: parsed.data.questionId, userId: user.id, status: "YES" },
    select: { id: true, jobId: true },
  });
  if (!question) return fail("NOT_FOUND");
  await db.jobQuestion.updateMany({
    where: { id: question.id, userId: user.id },
    data: { followUpDetail: parsed.data.detail, draftText: null, draftDropped: false },
  });
  revalidatePath(`/jobs/${question.jobId}`);
  return ok({ saved: true });
}

export async function draftJobAnswers(
  input: unknown,
): Promise<ActionResult<{ drafted: true }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");
  if (!jobQuestionsEnabled()) return fail("NOT_FOUND");
  const parsed = draftRequestSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION");
  const drafted = await draftConfirmed(
    user.id,
    parsed.data.jobId,
    parsed.data.followUpRound === true,
  );
  if (!drafted.ok) return fail(drafted.code);
  revalidatePath(`/jobs/${parsed.data.jobId}/questions`);
  return ok({ drafted: true });
}

export async function saveAcceptedLines(
  input: unknown,
): Promise<ActionResult<{ saved: number; dropped: string[] }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");
  if (!jobQuestionsEnabled()) return fail("NOT_FOUND");
  const parsed = saveLinesSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", parsed.error.flatten().fieldErrors);

  const questions = await db.jobQuestion.findMany({
    where: { userId: user.id, jobId: parsed.data.jobId, status: "YES" },
    select: {
      id: true,
      kind: true,
      question: true,
      detail: true,
      followUpDetail: true,
      topicKey: true,
      entryId: true,
      draftDestination: true,
      entry: {
        select: { title: true, organization: true, bullets: { select: { text: true } } },
      },
    },
  });
  const byId = new Map(questions.map((question) => [question.id, question]));
  const skills = await db.skill.findMany({
    where: { userId: user.id },
    select: { name: true, nameKey: true },
  });
  const dropped: string[] = [];
  let saved = 0;

  await db.$transaction(async (tx) => {
    for (const line of parsed.data.lines) {
      const question = byId.get(line.questionId);
      if (!question || !line.include) continue;
      const already = await tx.evidenceOrigin.findFirst({
        where: { userId: user.id, questionId: question.id },
        select: { id: true },
      });
      if (already) continue;
      const destination = question.draftDestination;
      const answer = answerText(question.detail, question.followUpDetail);
      const evidence = [
        question.entry?.title ?? "",
        question.entry?.organization ?? "",
        ...(question.entry?.bullets.map((bullet) => bullet.text) ?? []),
        ...skills.map((skill) => skill.name),
      ].filter((item) => item.trim().length > 0);
      const text = guardEditedLine({
        text: line.text,
        answer,
        evidence,
        kind: KIND[question.kind] ?? "detail",
        destination,
      });
      if (!text || !destination || !question.entryId && destination === "BULLET") {
        dropped.push(question.id);
        await tx.jobQuestion.updateMany({
          where: { id: question.id, userId: user.id },
          data: { draftText: null, draftDropped: true },
        });
        continue;
      }
      const wrote = await writeLine(tx, {
        userId: user.id,
        jobId: parsed.data.jobId,
        question,
        text,
        answer,
        destination,
        skillKeys: new Set(skills.map((skill) => skill.nameKey)),
      });
      if (!wrote) {
        dropped.push(question.id);
        continue;
      }
      saved += 1;
    }
    await tx.jobQuestionSet.updateMany({
      where: { userId: user.id, jobId: parsed.data.jobId },
      data: { savedAt: new Date() },
    });
  });

  revalidatePath(`/jobs/${parsed.data.jobId}`);
  revalidatePath("/library");
  return ok({ saved, dropped });
}

export async function reviseLibraryAnswer(
  input: unknown,
): Promise<ActionResult<{ dropped: boolean; text: string | null }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");
  if (!jobQuestionsEnabled()) return fail("NOT_FOUND");
  const parsed = reviseAnswerSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", parsed.error.flatten().fieldErrors);
  const origin = await db.evidenceOrigin.findFirst({
    where: { id: parsed.data.originId, userId: user.id },
    select: { id: true, questionId: true, topicKey: true, jobId: true, bulletId: true, skillId: true, entryId: true },
  });
  if (!origin) return fail("NOT_FOUND");

  if (parsed.data.decision === "not_yet") {
    await db.$transaction(async (tx) => {
      if (origin.bulletId) {
        await tx.bullet.deleteMany({ where: { id: origin.bulletId, userId: user.id } });
      } else if (origin.skillId) {
        await tx.skill.deleteMany({ where: { id: origin.skillId, userId: user.id } });
      } else if (origin.entryId) {
        await tx.entry.deleteMany({ where: { id: origin.entryId, userId: user.id } });
      }
      await tx.answerTopic.upsert({
        where: { userId_topicKey: { userId: user.id, topicKey: origin.topicKey } },
        create: {
          userId: user.id,
          topicKey: origin.topicKey,
          declined: true,
          jobId: origin.jobId,
          question: "",
        },
        update: { declined: true },
      });
      if (origin.questionId) {
        await tx.jobQuestion.updateMany({
          where: { id: origin.questionId, userId: user.id },
          data: { status: "NOT_YET", detail: null, draftText: null, draftDropped: false },
        });
      }
    });
    revalidatePath("/library");
    if (origin.jobId) revalidatePath(`/jobs/${origin.jobId}`);
    return ok({ dropped: false, text: null });
  }

  if (!origin.questionId) return fail("NOT_FOUND");
  if (parsed.data.answer.trim().length === 0) {
    return fail("VALIDATION", { answer: ["Add a sentence or two."] });
  }
  const drafted = await draftSingle(user.id, origin.questionId, parsed.data.answer);
  if (!drafted.ok) return fail(drafted.code);
  return ok({ dropped: drafted.dropped, text: drafted.text });
}

export async function applyLibraryRevision(
  input: unknown,
): Promise<ActionResult<{ saved: true }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");
  if (!jobQuestionsEnabled()) return fail("NOT_FOUND");
  const parsed = applyRevisionSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", parsed.error.flatten().fieldErrors);
  const origin = await db.evidenceOrigin.findFirst({
    where: { id: parsed.data.originId, userId: user.id },
    select: {
      id: true,
      kind: true,
      bulletId: true,
      skillId: true,
      entryId: true,
      questionId: true,
      jobId: true,
    },
  });
  if (!origin || !origin.questionId) return fail("NOT_FOUND");
  const question = await db.jobQuestion.findFirst({
    where: { id: origin.questionId, userId: user.id },
    select: {
      entry: { select: { title: true, organization: true, bullets: { select: { text: true } } } },
    },
  });
  const skills = await db.skill.findMany({ where: { userId: user.id }, select: { name: true } });
  const destination = origin.bulletId ? "BULLET" : origin.skillId ? "SKILL" : "CERTIFICATION";
  const evidence = [
    question?.entry?.title ?? "",
    question?.entry?.organization ?? "",
    ...(question?.entry?.bullets.map((bullet) => bullet.text) ?? []),
    ...skills.map((skill) => skill.name),
  ].filter((item) => item.trim().length > 0);
  const text = guardEditedLine({
    text: parsed.data.text,
    answer: parsed.data.answer,
    evidence,
    kind: KIND[origin.kind] ?? "detail",
    destination,
  });
  if (!text) return fail("VALIDATION", { text: ["We couldn't write this from your answer."] });

  await db.$transaction(async (tx) => {
    if (origin.bulletId) {
      await tx.bullet.updateMany({
        where: { id: origin.bulletId, userId: user.id },
        data: { text },
      });
    } else if (origin.skillId) {
      await tx.skill.updateMany({
        where: { id: origin.skillId, userId: user.id },
        data: { name: text, nameKey: skillKey(text) },
      });
    } else if (origin.entryId) {
      await tx.entry.updateMany({
        where: { id: origin.entryId, userId: user.id },
        data: { title: text },
      });
    }
    await tx.evidenceOrigin.updateMany({
      where: { id: origin.id, userId: user.id },
      data: { answer: parsed.data.answer, answeredAt: new Date() },
    });
    await tx.jobQuestion.updateMany({
      where: { id: origin.questionId ?? "", userId: user.id },
      data: { detail: parsed.data.answer, draftText: text, status: "YES" },
    });
  });
  revalidatePath("/library");
  if (origin.jobId) revalidatePath(`/jobs/${origin.jobId}`);
  return ok({ saved: true });
}

function answerText(detail: string | null, followUp: string | null): string {
  const text = [detail, followUp].filter((part) => part && part.trim().length > 0).join("\n\n");
  return text.length > 0 ? text : "Yes";
}

async function writeLine(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  input: {
    userId: string;
    jobId: string;
    question: {
      id: string;
      kind: "CONFIRM" | "DETAIL" | "SCALE" | "OUTCOME" | "ROLE";
      question: string;
      topicKey: string;
      entryId: string | null;
    };
    text: string;
    answer: string;
    destination: "BULLET" | "SKILL" | "CERTIFICATION";
    skillKeys: Set<string>;
  },
): Promise<boolean> {
  const answeredAt = new Date();
  if (input.destination === "BULLET") {
    if (!input.question.entryId) return false;
    const max = await tx.bullet.aggregate({
      where: { entryId: input.question.entryId, userId: input.userId },
      _max: { sortOrder: true },
    });
    const bullet = await tx.bullet.create({
      data: {
        userId: input.userId,
        entryId: input.question.entryId,
        text: input.text,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
      select: { id: true },
    });
    await tx.evidenceOrigin.create({
      data: originData(input, answeredAt, { bulletId: bullet.id }),
    });
    return true;
  }
  if (input.destination === "SKILL") {
    const nameKey = skillKey(input.text);
    if (input.skillKeys.has(nameKey)) return false;
    const max = await tx.skill.aggregate({
      where: { userId: input.userId },
      _max: { sortOrder: true },
    });
    const skill = await tx.skill.create({
      data: {
        userId: input.userId,
        name: input.text,
        nameKey,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
      select: { id: true },
    });
    input.skillKeys.add(nameKey);
    await tx.evidenceOrigin.create({
      data: originData(input, answeredAt, { skillId: skill.id }),
    });
    return true;
  }
  const max = await tx.entry.aggregate({
    where: { userId: input.userId, kind: "CERTIFICATION" },
    _max: { sortOrder: true },
  });
  const entry = await tx.entry.create({
    data: {
      userId: input.userId,
      kind: "CERTIFICATION",
      title: input.text,
      sortOrder: (max._max.sortOrder ?? -1) + 1,
    },
    select: { id: true },
  });
  await tx.evidenceOrigin.create({
    data: originData(input, answeredAt, { entryId: entry.id }),
  });
  return true;
}

function originData(
  input: {
    userId: string;
    jobId: string;
    question: { id: string; kind: "CONFIRM" | "DETAIL" | "SCALE" | "OUTCOME" | "ROLE"; question: string; topicKey: string };
    answer: string;
  },
  answeredAt: Date,
  target: { bulletId?: string; skillId?: string; entryId?: string },
) {
  return {
    userId: input.userId,
    source: "answer",
    question: input.question.question,
    answer: input.answer,
    topicKey: input.question.topicKey,
    kind: input.question.kind,
    jobId: input.jobId,
    questionId: input.question.id,
    answeredAt,
    ...target,
  };
}
