"use server";

import { revalidatePath } from "next/cache";

import { checkQuota } from "@/features/billing/quota";
import { strings } from "@/copy/strings";
import {
  buildContent as buildWording,
  OutputSchema as WordingSchema,
  SYSTEM as WORDING_SYSTEM,
} from "@/lib/ai/prompts/wording";
import {
  buildContent as buildRewrite,
  OutputSchema as RewriteSchema,
  SYSTEM as REWRITE_SYSTEM,
} from "@/lib/ai/prompts/rewrite";
import {
  buildDiscover,
  buildDraft,
  DISCOVER_SYSTEM,
  DiscoverSchema,
  DRAFT_SYSTEM,
  DraftSchema,
} from "@/lib/ai/prompts/strengthen";
import { requireUserForAction } from "@/lib/auth";
import { runStructured } from "@/lib/ai/run";
import { db } from "@/lib/db";
import { fail, ok, type ActionResult } from "@/lib/result";

import { libraryContext, libraryEvidence, entryTitles } from "./evidence";
import { getLibrary } from "./queries";
import {
  headlineRankAllowed,
  headlineShapeAllowed,
  reviewGrounded,
  reviewQuestions,
  reviewRewrite,
  reusableSummaryAllowed,
} from "./rewrite-guard";
import { BULLET_LIMITS, bulletTextSchema, PROFILE_LIMITS } from "./schemas";
import type { WordingView } from "./wording";
import { ensureApproved } from "./wording-store";

const copy = strings.library.assist;

export type RewriteProposal = {
  status: "suggestion" | "dropped" | "unchanged";
  text: string | null;
  why: string | null;
  question: string | null;
};

export async function proposeBulletRewrite(
  input: unknown,
): Promise<ActionResult<RewriteProposal>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");
  const bulletId = idOf(input);
  if (!bulletId) return fail("VALIDATION");

  const library = await getLibrary(user.id);
  const bullet = library?.entries.flatMap((entry) => entry.bullets).find((item) => item.id === bulletId);
  const entry = library?.entries.find((item) => item.bullets.some((line) => line.id === bulletId));
  if (!library || !bullet || !entry) return fail("NOT_FOUND");

  const quota = await checkQuota(user, "BULLET_COACH");
  if (!quota.allowed) return fail("QUOTA_EXCEEDED");

  const result = await runStructured({
    kind: "BULLET_COACH",
    userId: user.id,
    usedBonusCredit: quota.useBonus,
    system: REWRITE_SYSTEM,
    content: buildRewrite({ bullet: bullet.text, context: libraryContext(library, entry.id) }),
    schema: RewriteSchema,
    refId: bullet.id,
  });
  if (!result.ok) return fail("AI_FAILED");

  const reviewed = reviewRewrite({
    text: result.data.text,
    why: result.data.why,
    question: result.data.question,
    original: bullet.text,
    evidence: libraryEvidence(library),
  });
  if (!reviewed.ok) {
    return ok({
      status: reviewed.reason === "unchanged" ? "unchanged" : "dropped",
      text: null,
      why: null,
      question: null,
    });
  }
  return ok({
    status: "suggestion",
    text: reviewed.text,
    why: reviewed.why,
    question: reviewed.question,
  });
}

export async function acceptBulletRewrite(input: unknown): Promise<
  ActionResult<{ previousText: string; acceptedText: string; variantId: string }>
> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");
  const parsed = acceptInput(input);
  if (!parsed) return fail("VALIDATION");

  const library = await getLibrary(user.id);
  const bullet = library?.entries.flatMap((entry) => entry.bullets).find((item) => item.id === parsed.bulletId);
  if (!library || !bullet) return fail("NOT_FOUND");

  const text = parsed.text.trim();
  if (text.length === 0 || text.length > BULLET_LIMITS.text) return fail("VALIDATION");
  if (same(text, parsed.proposalText)) {
    const reviewed = reviewRewrite({
      text,
      why: parsed.reason,
      question: null,
      original: bullet.text,
      evidence: libraryEvidence(library),
    });
    if (!reviewed.ok) return fail("VALIDATION", { text: [copy.rejected] });
  }

  const saved = await db.$transaction(async (tx) => {
    const current = await tx.bullet.findFirst({
      where: { id: bullet.id, userId: user.id },
      select: { id: true, text: true },
    });
    if (!current) return null;
    const canonical = await ensureApproved(tx, {
      userId: user.id,
      kind: "BULLET",
      bulletId: current.id,
      jobId: null,
      text: current.text,
      origin: "CANONICAL",
      reason: null,
      sourceRefs: [current.id],
      isDefault: false,
    });
    const variantId = await ensureApproved(tx, {
      userId: user.id,
      kind: "BULLET",
      bulletId: current.id,
      jobId: null,
      text,
      origin: "REWRITE",
      reason: parsed.reason,
      sourceRefs: [current.id],
      isDefault: false,
      basedOnId: canonical,
    });
    const updated = await tx.bullet.updateMany({
      where: { id: current.id, userId: user.id },
      data: { text },
    });
    if (updated.count === 0) return null;
    return { previousText: current.text, acceptedText: text, variantId };
  });
  if (!saved) return fail("NOT_FOUND");
  revalidatePath("/library");
  return ok(saved);
}

export async function undoBulletRewrite(input: unknown): Promise<ActionResult<{ restored: boolean }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");
  const parsed = undoInput(input);
  if (!parsed) return fail("VALIDATION");

  const restored = await db.$transaction(async (tx) => {
    const current = await tx.bullet.findFirst({
      where: { id: parsed.bulletId, userId: user.id },
      select: { text: true },
    });
    if (!current || current.text !== parsed.acceptedText) return false;
    const updated = await tx.bullet.updateMany({
      where: { id: parsed.bulletId, userId: user.id, text: parsed.acceptedText },
      data: { text: parsed.previousText },
    });
    if (updated.count === 0) return false;
    await tx.wordingVariant.deleteMany({
      where: { id: parsed.variantId, userId: user.id, origin: "REWRITE" },
    });
    return true;
  });
  revalidatePath("/library");
  return ok({ restored });
}

export async function useBulletWording(
  input: unknown,
): Promise<ActionResult<{ text: string }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");
  const id = idOf(input);
  if (!id) return fail("VALIDATION");
  const variant = await db.wordingVariant.findFirst({
    where: { id, userId: user.id, kind: "BULLET", status: "APPROVED", jobId: null },
    select: { bulletId: true, text: true },
  });
  if (!variant?.bulletId) return fail("NOT_FOUND");
  const updated = await db.bullet.updateMany({
    where: { id: variant.bulletId, userId: user.id },
    data: { text: variant.text },
  });
  if (updated.count === 0) return fail("NOT_FOUND");
  revalidatePath("/library");
  return ok({ text: variant.text });
}

export async function proposeStrengthQuestions(
  input: unknown,
): Promise<ActionResult<{ questions: string[] }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");
  const entryId = idOf(input);
  if (!entryId) return fail("VALIDATION");
  const library = await getLibrary(user.id);
  const entry = library?.entries.find((item) => item.id === entryId);
  if (!library || !entry) return fail("NOT_FOUND");

  const quota = await checkQuota(user, "BULLET_COACH");
  if (!quota.allowed) return fail("QUOTA_EXCEEDED");
  const result = await runStructured({
    kind: "BULLET_COACH",
    userId: user.id,
    usedBonusCredit: quota.useBonus,
    system: DISCOVER_SYSTEM,
    content: buildDiscover({
      title: entry.title,
      organization: entry.organization,
      bullets: entry.bullets.map((bullet) => bullet.text),
      context: libraryContext(library, entry.id),
    }),
    schema: DiscoverSchema,
    refId: entry.id,
  });
  if (!result.ok) return fail("AI_FAILED");
  return ok({
    questions: reviewQuestions(result.data.questions, libraryEvidence(library), 6),
  });
}

export async function draftStrengthenedBullet(input: unknown): Promise<
  ActionResult<
    | { status: "followUps"; questions: string[] }
    | { status: "bullet"; text: string; why: string }
    | { status: "dropped"; reason: "empty" | "unsupported" | "number" | "unchanged" }
  >
> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");
  const parsed = draftInput(input);
  if (!parsed) return fail("VALIDATION");
  const library = await getLibrary(user.id);
  const entry = library?.entries.find((item) => item.id === parsed.entryId);
  if (!library || !entry) return fail("NOT_FOUND");
  if (parsed.confirmed.length === 0) {
    return ok({ status: "dropped", reason: "empty" });
  }

  const quota = await checkQuota(user, "BULLET_COACH");
  if (!quota.allowed) return fail("QUOTA_EXCEEDED");
  // Confirmed answers are facts the person just verified. They count as evidence.
  const evidence = [...libraryEvidence(library), ...parsed.confirmed];
  const result = await runStructured({
    kind: "BULLET_COACH",
    userId: user.id,
    usedBonusCredit: quota.useBonus,
    system: DRAFT_SYSTEM,
    content: buildDraft({
      title: entry.title,
      confirmed: parsed.confirmed,
      context: libraryContext(library, entry.id),
      followUpRound: parsed.followUpRound,
    }),
    schema: DraftSchema,
    refId: entry.id,
  });
  if (!result.ok) return fail("AI_FAILED");

  const followUps = parsed.followUpRound
    ? []
    : reviewQuestions(result.data.followUps, evidence, 2);
  if (followUps.length > 0) return ok({ status: "followUps", questions: followUps });

  const reviewed = reviewRewrite({
    text: result.data.text ?? "",
    why: result.data.why ?? "",
    question: null,
    original: "",
    evidence,
  });
  if (!reviewed.ok) {
    return ok({
      status: "dropped",
      reason: reviewed.reason === "number" ? "number" : reviewed.reason,
    });
  }
  return ok({ status: "bullet", text: reviewed.text, why: reviewed.why });
}

export async function addStrengthenedBullet(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");
  const parsed = addBulletInput(input);
  if (!parsed) return fail("VALIDATION");
  const text = bulletTextSchema.safeParse(parsed.text);
  if (!text.success) return fail("VALIDATION");

  const created = await db.$transaction(async (tx) => {
    const entry = await tx.entry.findFirst({
      where: { id: parsed.entryId, userId: user.id },
      select: { id: true },
    });
    if (!entry) return null;
    const max = await tx.bullet.aggregate({
      where: { entryId: entry.id, userId: user.id },
      _max: { sortOrder: true },
    });
    const bullet = await tx.bullet.create({
      data: {
        userId: user.id,
        entryId: entry.id,
        text: text.data,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
      select: { id: true },
    });
    await ensureApproved(tx, {
      userId: user.id,
      kind: "BULLET",
      bulletId: bullet.id,
      jobId: null,
      text: text.data,
      origin: "STRENGTHEN",
      reason: parsed.reason,
      sourceRefs: [entry.id, bullet.id],
      isDefault: false,
    });
    return bullet;
  });
  if (!created) return fail("NOT_FOUND");
  revalidatePath("/library");
  return ok(created);
}

export async function suggestProfileWording(
  input: unknown,
): Promise<ActionResult<{ saved: number }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");
  const kind = kindOf(input);
  if (!kind) return fail("VALIDATION");
  const library = await getLibrary(user.id);
  if (!library) return fail("NOT_FOUND");

  const quota = await checkQuota(user, "BULLET_COACH");
  if (!quota.allowed) return fail("QUOTA_EXCEEDED");
  const result = await runStructured({
    kind: "BULLET_COACH",
    userId: user.id,
    usedBonusCredit: quota.useBonus,
    system: WORDING_SYSTEM,
    content: buildWording({
      kind,
      context: libraryContext(library, library.entries[0]?.id ?? ""),
      jobTitle: null,
      company: null,
    }),
    schema: WordingSchema,
    refId: user.id,
  });
  if (!result.ok) return fail("AI_FAILED");

  const evidence = libraryEvidence(library);
  const titles = entryTitles(library);
  const wordingKind = kind === "headline" ? "HEADLINE" : "SUMMARY";
  const max = kind === "headline" ? 80 : PROFILE_LIMITS.summary;
  const approved = await db.wordingVariant.findMany({
    where: { userId: user.id, kind: wordingKind, jobId: null, status: "APPROVED" },
    select: { text: true },
  });
  const alreadySaved = new Set(approved.map((row) => row.text));
  const kept: { text: string; why: string }[] = [];
  for (const option of result.data.options) {
    const reviewed = reviewGrounded({
      text: option.text,
      why: option.why,
      original: "",
      evidence,
      max,
    });
    if (!reviewed.ok) continue;
    if (kind === "headline" && !headlineRankAllowed(reviewed.text, evidence)) continue;
    if (kind === "headline" && !headlineShapeAllowed(reviewed.text, titles)) continue;
    if (kind === "summary" && !reusableSummaryAllowed(reviewed.text, titles)) continue;
    if (alreadySaved.has(reviewed.text) || kept.some((item) => item.text === reviewed.text)) continue;
    kept.push({ text: reviewed.text, why: reviewed.why });
    if (kept.length >= 4) break;
  }
  if (kept.length === 0) return ok({ saved: 0 });

  await db.$transaction(async (tx) => {
    await tx.wordingVariant.deleteMany({
      where: { userId: user.id, kind: wordingKind, jobId: null, status: "PROPOSED" },
    });
    for (const item of kept) {
      await tx.wordingVariant.create({
        data: {
          userId: user.id,
          kind: wordingKind,
          status: "PROPOSED",
          origin: "REWRITE",
          text: item.text,
          reason: item.why,
          sourceRefs: [],
        },
      });
    }
  });
  revalidatePath("/library");
  return ok({ saved: kept.length });
}

export async function approveProfileWording(
  input: unknown,
): Promise<ActionResult<{ isDefault: boolean }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");
  const parsed = approveInput(input);
  if (!parsed) return fail("VALIDATION");
  const variant = await db.wordingVariant.findFirst({
    where: { id: parsed.id, userId: user.id, kind: { in: ["HEADLINE", "SUMMARY"] }, jobId: null },
    select: { id: true, kind: true, text: true },
  });
  if (!variant) return fail("NOT_FOUND");
  const text = parsed.text.trim() || variant.text;
  const max = variant.kind === "HEADLINE" ? PROFILE_LIMITS.headline : PROFILE_LIMITS.summary;
  if (text.length === 0 || text.length > max) return fail("VALIDATION");

  const library = await getLibrary(user.id);
  if (!library) return fail("NOT_FOUND");
  if (variant.kind === "SUMMARY" && !reusableSummaryAllowed(text, entryTitles(library))) {
    return fail("VALIDATION", { text: [copy.summarySpecific] });
  }
  if (variant.kind === "HEADLINE" && !headlineRankAllowed(text, libraryEvidence(library))) {
    return fail("VALIDATION", { text: [copy.headlineRank] });
  }
  if (variant.kind === "HEADLINE" && !headlineShapeAllowed(text, entryTitles(library))) {
    return fail("VALIDATION", { text: [copy.headlineShape] });
  }

  const makeDefault = parsed.makeDefault;
  await db.$transaction(async (tx) => {
    if (makeDefault) {
      await tx.wordingVariant.updateMany({
        where: { userId: user.id, kind: variant.kind, jobId: null, isDefault: true },
        data: { isDefault: false },
      });
      await tx.user.updateMany({
        where: { id: user.id },
        data: variant.kind === "HEADLINE" ? { headline: text } : { summary: text },
      });
    }
    await tx.wordingVariant.updateMany({
      where: { id: variant.id, userId: user.id },
      data: { status: "APPROVED", text, isDefault: makeDefault, origin: "USER" },
    });
  });
  revalidatePath("/library");
  return ok({ isDefault: makeDefault });
}

export async function discardWording(input: unknown): Promise<ActionResult<{ discarded: true }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");
  const id = idOf(input);
  if (!id) return fail("VALIDATION");
  const result = await db.wordingVariant.deleteMany({ where: { id, userId: user.id } });
  if (result.count === 0) return fail("NOT_FOUND");
  revalidatePath("/library");
  return ok({ discarded: true });
}

export async function saveSummaryVariant(input: unknown): Promise<
  ActionResult<{ scope: "job" | "default" }>
> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");
  const parsed = summaryInput(input);
  if (!parsed) return fail("VALIDATION");
  const job = await db.job.findFirst({
    where: { id: parsed.jobId, userId: user.id },
    select: { id: true },
  });
  if (!job) return fail("NOT_FOUND");
  const text = parsed.text.trim();
  if (text.length === 0 || text.length > PROFILE_LIMITS.summary) return fail("VALIDATION");

  if (parsed.asDefault) {
    const library = await getLibrary(user.id);
    if (!library) return fail("NOT_FOUND");
    if (!reusableSummaryAllowed(text, entryTitles(library))) {
      return fail("VALIDATION", { text: [copy.summarySpecific] });
    }
    await db.$transaction(async (tx) => {
      await tx.wordingVariant.updateMany({
        where: { userId: user.id, kind: "SUMMARY", jobId: null, isDefault: true },
        data: { isDefault: false },
      });
      await ensureApproved(tx, {
        userId: user.id,
        kind: "SUMMARY",
        bulletId: null,
        jobId: null,
        text,
        origin: "USER",
        reason: copy.savedFromResume,
        sourceRefs: [],
        isDefault: true,
      });
      await tx.user.updateMany({ where: { id: user.id }, data: { summary: text } });
    });
    revalidatePath("/library");
    return ok({ scope: "default" });
  }

  await ensureApproved(db, {
    userId: user.id,
    kind: "SUMMARY",
    bulletId: null,
    jobId: job.id,
    text,
    origin: "JOB",
    reason: copy.savedForJob,
    sourceRefs: [],
    isDefault: false,
  });
  revalidatePath("/library");
  return ok({ scope: "job" });
}

function idOf(input: unknown): string | null {
  if (!input || typeof input !== "object" || !("id" in input)) return null;
  const id = input.id;
  return typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}

function kindOf(input: unknown): "headline" | "summary" | null {
  if (!input || typeof input !== "object" || !("kind" in input)) return null;
  return input.kind === "headline" || input.kind === "summary" ? input.kind : null;
}

function acceptInput(input: unknown): {
  bulletId: string;
  text: string;
  proposalText: string;
  reason: string;
} | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Record<string, unknown>;
  if (typeof value.bulletId !== "string" || typeof value.text !== "string") return null;
  if (typeof value.proposalText !== "string" || typeof value.reason !== "string") return null;
  if (!/^[0-9a-f-]{36}$/i.test(value.bulletId)) return null;
  return {
    bulletId: value.bulletId,
    text: value.text,
    proposalText: value.proposalText,
    reason: value.reason.slice(0, 200),
  };
}

function undoInput(input: unknown): {
  bulletId: string;
  previousText: string;
  acceptedText: string;
  variantId: string;
} | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Record<string, unknown>;
  if (typeof value.bulletId !== "string" || typeof value.variantId !== "string") return null;
  if (typeof value.previousText !== "string" || typeof value.acceptedText !== "string") return null;
  if (!/^[0-9a-f-]{36}$/i.test(value.bulletId) || !/^[0-9a-f-]{36}$/i.test(value.variantId)) {
    return null;
  }
  return {
    bulletId: value.bulletId,
    previousText: value.previousText,
    acceptedText: value.acceptedText,
    variantId: value.variantId,
  };
}

function draftInput(input: unknown): {
  entryId: string;
  confirmed: string[];
  followUpRound: boolean;
} | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Record<string, unknown>;
  if (typeof value.entryId !== "string" || !/^[0-9a-f-]{36}$/i.test(value.entryId)) return null;
  if (!Array.isArray(value.confirmed)) return null;
  const confirmed = value.confirmed
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 12);
  return {
    entryId: value.entryId,
    confirmed,
    followUpRound: value.followUpRound === true,
  };
}

function addBulletInput(input: unknown): { entryId: string; text: string; reason: string } | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Record<string, unknown>;
  if (typeof value.entryId !== "string" || typeof value.text !== "string") return null;
  if (!/^[0-9a-f-]{36}$/i.test(value.entryId)) return null;
  return {
    entryId: value.entryId,
    text: value.text,
    reason: typeof value.reason === "string" ? value.reason.slice(0, 200) : "",
  };
}

function approveInput(input: unknown): { id: string; text: string; makeDefault: boolean } | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Record<string, unknown>;
  if (typeof value.id !== "string" || !/^[0-9a-f-]{36}$/i.test(value.id)) return null;
  return {
    id: value.id,
    text: typeof value.text === "string" ? value.text : "",
    makeDefault: value.makeDefault !== false,
  };
}

function summaryInput(input: unknown): { jobId: string; text: string; asDefault: boolean } | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Record<string, unknown>;
  if (typeof value.jobId !== "string" || typeof value.text !== "string") return null;
  if (!/^[0-9a-f-]{36}$/i.test(value.jobId)) return null;
  return { jobId: value.jobId, text: value.text, asDefault: value.asDefault === true };
}

function same(left: string, right: string): boolean {
  return left.trim() === right.trim();
}

export type { WordingView };
