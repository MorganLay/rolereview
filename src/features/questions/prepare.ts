import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { JobQuestionKind } from "@/generated/prisma/enums";
import { getLibrary } from "@/features/library/queries";
import { serializeLibrary } from "@/features/library/serialize";
import { buildQuestions, QUESTIONS_SYSTEM, QuestionsSchema } from "@/lib/ai/prompts/job-questions";
import { runStructured } from "@/lib/ai/run";
import { db } from "@/lib/db";

import { selectJobQuestions } from "./filter";
import { loadJobLibrary } from "./queries";

const STALE_MS = 3 * 60 * 1000;

const KIND: Record<string, JobQuestionKind> = {
  confirm: "CONFIRM",
  detail: "DETAIL",
  scale: "SCALE",
  outcome: "OUTCOME",
  role: "ROLE",
};

export type PrepareStatus = "ready" | "empty" | "failed" | "generating";

export async function generateJobQuestions(
  userId: string,
  jobId: string,
  mode: "prepare" | "retry" | "refresh",
): Promise<
  | { ok: true; status: PrepareStatus }
  | { ok: false; code: "NOT_FOUND" | "VALIDATION" | "AI_FAILED" }
> {
  const loaded = await loadJobLibrary(userId, jobId);
  if (!loaded) return { ok: false, code: "NOT_FOUND" };
  if (!loaded.analysis || loaded.job.analysisStatus !== "READY") {
    return { ok: false, code: "VALIDATION" };
  }
  if (loaded.entryCount + loaded.skillCount === 0) return { ok: false, code: "VALIDATION" };

  const existing = await db.jobQuestionSet.findFirst({
    where: { userId, jobId },
    include: { questions: { select: { status: true } } },
  });

  if (mode === "prepare" && existing) {
    if (existing.status === "READY") return { ok: true, status: "ready" };
    if (existing.status === "EMPTY") return { ok: true, status: "empty" };
    if (existing.status === "FAILED") return { ok: true, status: "failed" };
    if (existing.status === "GENERATING" && Date.now() - existing.updatedAt.getTime() < STALE_MS) {
      return { ok: true, status: "generating" };
    }
  }

  if (mode === "refresh") {
    const answered = existing?.questions.some((question) => question.status !== "OPEN") ?? false;
    if (!existing || existing.status === "FAILED" || answered) {
      return { ok: false, code: "VALIDATION" };
    }
  }

  if (mode === "retry" && existing && existing.status !== "FAILED" && existing.status !== "GENERATING") {
    return { ok: false, code: "VALIDATION" };
  }

  const setId = await claimSet(userId, jobId, loaded.revision, existing?.id ?? null);
  if (setId === "busy") return { ok: true, status: "generating" };

  try {
    const library = await getLibrary(userId);
    if (!library) {
      await markFailed(userId, setId);
      return { ok: false, code: "NOT_FOUND" };
    }
    const serialized = serializeLibrary(library, new Date().toISOString());
    const topics = await db.answerTopic.findMany({
      where: { userId },
      select: { topicKey: true, question: true, declined: true },
    });
    const postingText = [
      loaded.job.rawText,
      ...loaded.analysis.requirements.map((item) => item.text),
      ...loaded.analysis.keywords,
    ].join("\n");
    const result = await runStructured({
      kind: "JOB_QUESTIONS",
      userId,
      countsTowardQuota: false,
      system: QUESTIONS_SYSTEM,
      content: buildQuestions({
        libraryText: serialized.text,
        requirements: loaded.analysis.requirements,
        posting: loaded.job.rawText,
        topics,
      }),
      schema: QuestionsSchema,
      refId: jobId,
    });
    if (!result.ok) {
      await markFailed(userId, setId);
      return { ok: false, code: "AI_FAILED" };
    }

    const selected = selectJobQuestions({
      proposed: result.data.questions,
      requirements: loaded.analysis.requirements,
      entries: serialized.snapshot.entries.map((entry) => ({
        ref: entry.ref,
        id: entry.id,
        title: entry.title,
        bullets: entry.bullets.map((bullet) => bullet.text),
      })),
      libraryText: serialized.text,
      postingText,
      knownTopicKeys: new Set(topics.map((topic) => topic.topicKey)),
    });

    await db.$transaction(async (tx) => {
      await tx.jobQuestion.deleteMany({ where: { setId, userId } });
      if (selected.length > 0) {
        await tx.jobQuestion.createMany({
          data: selected.map((question, position) => ({
            userId,
            jobId,
            setId,
            requirementId: question.requirementId,
            entryId: question.entryId,
            kind: KIND[question.kind] ?? "DETAIL",
            question: question.question,
            why: question.why,
            subject: question.subject,
            topicKey: question.topicKey,
            position,
          })),
        });
      }
      await tx.jobQuestionSet.updateMany({
        where: { id: setId, userId },
        data: {
          status: selected.length > 0 ? "READY" : "EMPTY",
          libraryRevision: loaded.revision,
          savedAt: null,
        },
      });
    });
    return { ok: true, status: selected.length > 0 ? "ready" : "empty" };
  } catch (error) {
    await markFailed(userId, setId);
    console.error("job questions failed", { userId, jobId, code: "prepare" });
    throw error;
  }
}

async function claimSet(
  userId: string,
  jobId: string,
  revision: string,
  existingId: string | null,
): Promise<string | "busy"> {
  if (existingId) {
    await db.jobQuestion.deleteMany({ where: { setId: existingId, userId } });
    const updated = await db.jobQuestionSet.updateMany({
      where: { id: existingId, userId },
      data: { status: "GENERATING", libraryRevision: revision, savedAt: null },
    });
    if (updated.count === 1) return existingId;
  }
  try {
    const created = await db.jobQuestionSet.create({
      data: { userId, jobId, status: "GENERATING", libraryRevision: revision },
      select: { id: true },
    });
    return created.id;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return "busy";
    }
    throw error;
  }
}

async function markFailed(userId: string, setId: string): Promise<void> {
  await db.jobQuestionSet.updateMany({
    where: { id: setId, userId },
    data: { status: "FAILED" },
  });
}
