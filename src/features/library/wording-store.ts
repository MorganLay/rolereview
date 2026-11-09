import "server-only";

import type { WordingKind, WordingOrigin } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

import type { WordingView } from "./wording";

export type { WordingView };

export async function listWordings(userId: string): Promise<WordingView[]> {
  const rows = await db.wordingVariant.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      kind: true,
      status: true,
      origin: true,
      bulletId: true,
      jobId: true,
      text: true,
      reason: true,
      sourceRefs: true,
      isDefault: true,
      job: { select: { title: true, company: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    status: row.status,
    origin: row.origin,
    bulletId: row.bulletId,
    jobId: row.jobId,
    jobLabel: row.job ? `${row.job.company} — ${row.job.title}` : null,
    text: row.text,
    reason: row.reason,
    sourceRefs: row.sourceRefs,
    isDefault: row.isDefault,
  }));
}

export async function approvedBulletWordings(userId: string, jobId: string) {
  return db.wordingVariant.findMany({
    where: {
      userId,
      kind: "BULLET",
      status: "APPROVED",
      OR: [{ jobId: null }, { jobId }],
    },
    select: { id: true, bulletId: true, jobId: true, text: true, reason: true },
  });
}

/** Keep the previous text and the user's edit as approved wording. Failures stay quiet. */
export async function rememberUserWording(input: {
  userId: string;
  kind: WordingKind;
  bulletId: string | null;
  previous: string | null;
  next: string | null;
  sourceRefs?: string[];
}): Promise<void> {
  const next = input.next?.trim() ?? "";
  const previous = input.previous?.trim() ?? "";
  if (next.length === 0 || next === previous) return;
  try {
    await db.$transaction(async (tx) => {
      if (previous.length > 0) {
        await ensureApproved(tx, {
          userId: input.userId,
          kind: input.kind,
          bulletId: input.bulletId,
          jobId: null,
          text: previous,
          origin: "CANONICAL",
          reason: null,
          sourceRefs: input.sourceRefs ?? [],
          isDefault: false,
        });
      }
      const created = await ensureApproved(tx, {
        userId: input.userId,
        kind: input.kind,
        bulletId: input.bulletId,
        jobId: null,
        text: next,
        origin: "USER",
        reason: null,
        sourceRefs: input.sourceRefs ?? [],
        isDefault: input.kind !== "BULLET",
      });
      if (input.kind !== "BULLET") {
        await tx.wordingVariant.updateMany({
          where: {
            userId: input.userId,
            kind: input.kind,
            jobId: null,
            isDefault: true,
            NOT: { id: created },
          },
          data: { isDefault: false },
        });
      }
    });
  } catch {
    console.info(JSON.stringify({ event: "wording.record_failed", kind: input.kind }));
  }
}

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

async function ensureApproved(
  tx: Tx,
  input: {
    userId: string;
    kind: WordingKind;
    bulletId: string | null;
    jobId: string | null;
    text: string;
    origin: WordingOrigin;
    reason: string | null;
    sourceRefs: string[];
    isDefault: boolean;
    basedOnId?: string | null;
  },
): Promise<string> {
  const existing = await tx.wordingVariant.findFirst({
    where: {
      userId: input.userId,
      kind: input.kind,
      bulletId: input.bulletId,
      jobId: input.jobId,
      text: input.text,
      status: "APPROVED",
    },
    select: { id: true },
  });
  if (existing) {
    if (input.isDefault) {
      await tx.wordingVariant.updateMany({
        where: { id: existing.id, userId: input.userId },
        data: { isDefault: true },
      });
    }
    return existing.id;
  }
  const created = await tx.wordingVariant.create({
    data: {
      userId: input.userId,
      kind: input.kind,
      status: "APPROVED",
      origin: input.origin,
      bulletId: input.bulletId,
      jobId: input.jobId,
      text: input.text,
      reason: input.reason,
      sourceRefs: input.sourceRefs,
      basedOnId: input.basedOnId ?? null,
      isDefault: input.isDefault,
    },
    select: { id: true },
  });
  return created.id;
}

export { ensureApproved };
