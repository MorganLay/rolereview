"use server";

import { revalidatePath } from "next/cache";

import { strings } from "@/copy/strings";
import { requireUserForAction } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, ok, type ActionResult } from "@/lib/result";

import { zodFieldErrors } from "../library/schemas";

import {
  emptySortByKind,
  planImportCommit,
  selectCommitItems,
} from "./commit";
import type { ExtractedResume } from "./extract";
import { extractResumeForUser } from "./extract-resume";
import {
  coerceExtractInput,
  commitImportSchema,
  extractResumeSchema,
} from "./schemas";

const errors = strings.library.import.errors;

/** Read a resume into a review payload. Nothing is saved. */
export async function extractResume(
  input: unknown,
): Promise<ActionResult<ExtractedResume>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");

  const parsed = extractResumeSchema.safeParse(coerceExtractInput(input));
  if (!parsed.success) {
    const fields = zodFieldErrors(parsed.error);
    if (Object.keys(fields).length === 0) {
      return fail("VALIDATION", { file: [errors.fileType] });
    }
    return fail("VALIDATION", fields);
  }

  return extractResumeForUser(user, parsed.data);
}

export type CommitImportResult = {
  redirectTo: "/library" | "/dashboard";
  entries: number;
  bullets: number;
  skills: number;
  skippedSkills: number;
  mergedRoles: number;
  profile: boolean;
};

const importErrors = strings.library.import;

/** Save the checked review rows. Email is the sign-in address and is not written. */
export async function commitImport(
  input: unknown,
): Promise<ActionResult<CommitImportResult>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");

  const parsed = commitImportSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", zodFieldErrors(parsed.error));

  const selected = selectCommitItems(parsed.data);
  if (!selected.ok) return fail("VALIDATION", selected.fields);

  const row = await db.user.findFirst({
    where: { id: user.id },
    select: {
      onboardingCompletedAt: true,
      entries: {
        select: {
          id: true,
          kind: true,
          title: true,
          organization: true,
          startDate: true,
          endDate: true,
          sortOrder: true,
          bullets: { select: { text: true, sortOrder: true } },
        },
      },
      skills: { select: { id: true, name: true, nameKey: true, category: true, sortOrder: true } },
    },
  });
  if (!row) return fail("NOT_FOUND");

  const maxSortByKind = emptySortByKind();
  for (const entry of row.entries) {
    maxSortByKind[entry.kind] = Math.max(maxSortByKind[entry.kind], entry.sortOrder);
  }
  let maxSkillSort = -1;
  for (const skill of row.skills) {
    maxSkillSort = Math.max(maxSkillSort, skill.sortOrder);
  }

  const planned = planImportCommit({
    mode: parsed.data.mode,
    profile: selected.profile,
    entries: selected.entries,
    skills: selected.skills,
    existing: {
      maxSortByKind,
      maxSkillSort,
      skillNameKeys: row.skills.map((skill) => skill.nameKey),
      skillCategories: row.skills.map((skill) => skill.category),
      skills: row.skills.map((skill) => ({
        id: skill.id,
        name: skill.name,
        nameKey: skill.nameKey,
      })),
      entries: row.entries,
    },
  });
  if (!planned.ok) {
    return fail("VALIDATION", { form: [importErrors.errors.nothingSelected] });
  }

  const plan = planned.plan;
  try {
    await db.$transaction(async (tx) => {
      if (plan.replace) {
        await tx.entry.deleteMany({ where: { userId: user.id } });
        await tx.skill.deleteMany({ where: { userId: user.id } });
      }
      if (plan.profile) {
        const profile = plan.profile;
        const updated = await tx.user.updateMany({
          where: { id: user.id },
          data: {
            fullName: profile.fullName,
            headline: profile.headline,
            phone: profile.phone,
            location: profile.location,
            summary: profile.summary,
            links: profile.links,
          },
        });
        if (updated.count === 0) throw new Error("USER_MISSING");
      }
      for (const entry of plan.entries) {
        await tx.entry.create({
          data: {
            userId: user.id,
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
                userId: user.id,
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
            userId: user.id,
            name: skill.name,
            nameKey: skill.nameKey,
            category: skill.category,
            sortOrder: skill.sortOrder,
          })),
        });
      }
      for (const update of plan.skillUpdates) {
        const renamed = await tx.skill.updateMany({
          where: { id: update.id, userId: user.id },
          data: { name: update.name, nameKey: update.nameKey },
        });
        if (renamed.count === 0) throw new Error("SKILL_MISSING");
      }
      for (const update of plan.bulletUpdates) {
        const owned = await tx.entry.findFirst({
          where: { id: update.entryId, userId: user.id },
          select: { id: true },
        });
        if (!owned) throw new Error("ENTRY_MISSING");
        await tx.bullet.createMany({
          data: update.bullets.map((bullet) => ({
            userId: user.id,
            entryId: owned.id,
            text: bullet.text,
            sortOrder: bullet.sortOrder,
          })),
        });
      }
    });
  } catch (error) {
    if (isUniqueViolation(error)) return fail("CONFLICT");
    if (
      error instanceof Error &&
      (error.message === "USER_MISSING" ||
        error.message === "ENTRY_MISSING" ||
        error.message === "SKILL_MISSING")
    ) {
      return fail("NOT_FOUND");
    }
    throw error;
  }

  revalidatePath("/library");
  revalidatePath("/dashboard");

  const bullets =
    plan.entries.reduce((sum, entry) => sum + entry.bullets.length, 0) +
    plan.bulletUpdates.reduce((sum, update) => sum + update.bullets.length, 0);
  return ok({
    redirectTo: row.onboardingCompletedAt === null ? "/dashboard" : "/library",
    entries: plan.entries.length,
    bullets,
    skills: plan.skills.length,
    skippedSkills: plan.skippedSkills,
    mergedRoles: plan.mergedRoles,
    profile: plan.profile !== null,
  });
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "P2002"
  );
}
