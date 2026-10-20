"use server";

import { revalidatePath } from "next/cache";

import { requireUserForAction } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, ok, type ActionResult } from "@/lib/result";

import { moveWithinSection } from "./order";
import {
  createBulletSchema,
  createEntrySchema,
  deleteBulletSchema,
  deleteEntrySchema,
  profileFieldErrors,
  reorderBulletSchema,
  reorderEntrySchema,
  updateBulletSchema,
  updateEntrySchema,
  updateProfileSchema,
  zodFieldErrors,
} from "./schemas";

/** Save the library profile. Email is the sign-in address and is not written here. */
export async function updateProfile(
  input: unknown,
): Promise<ActionResult<{ saved: true }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");

  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION", profileFieldErrors(parsed.error));
  }

  const result = await db.user.updateMany({
    where: { id: user.id },
    data: {
      fullName: parsed.data.fullName,
      headline: parsed.data.headline,
      phone: parsed.data.phone,
      location: parsed.data.location,
      summary: parsed.data.summary,
      links: parsed.data.links,
    },
  });

  if (result.count === 0) return fail("NOT_FOUND");

  revalidatePath("/library");
  return ok({ saved: true });
}

/** Append an entry to the end of its section. */
export async function createEntry(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");

  const parsed = createEntrySchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", zodFieldErrors(parsed.error));

  const data = parsed.data;
  const created = await db.$transaction(async (tx) => {
    const max = await tx.entry.aggregate({
      where: { userId: user.id, kind: data.kind },
      _max: { sortOrder: true },
    });
    return tx.entry.create({
      data: {
        userId: user.id,
        kind: data.kind,
        title: data.title,
        organization: data.organization,
        location: data.location,
        url: data.url,
        startDate: data.startDate,
        endDate: data.endDate,
        isCurrent: data.isCurrent,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
      select: { id: true },
    });
  });

  revalidatePath("/library");
  return ok({ id: created.id });
}

/** Update one owned entry. Kind stays in the section it was created in. */
export async function updateEntry(
  input: unknown,
): Promise<ActionResult<{ saved: true }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");

  const parsed = updateEntrySchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", zodFieldErrors(parsed.error));

  const { id, ...data } = parsed.data;
  const result = await db.entry.updateMany({
    where: { id, userId: user.id },
    data,
  });
  if (result.count === 0) return fail("NOT_FOUND");

  revalidatePath("/library");
  return ok({ saved: true });
}

/** Delete one owned entry. Bullets cascade with the row. */
export async function deleteEntry(
  input: unknown,
): Promise<ActionResult<{ deleted: true }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");

  const parsed = deleteEntrySchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", zodFieldErrors(parsed.error));

  const result = await db.entry.deleteMany({
    where: { id: parsed.data.id, userId: user.id },
  });
  if (result.count === 0) return fail("NOT_FOUND");

  revalidatePath("/library");
  return ok({ deleted: true });
}

/** Swap an entry with its neighbour in the same section. */
export async function reorderEntry(
  input: unknown,
): Promise<ActionResult<{ moved: boolean }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");

  const parsed = reorderEntrySchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", zodFieldErrors(parsed.error));

  const entry = await db.entry.findFirst({
    where: { id: parsed.data.id, userId: user.id },
    select: { id: true, kind: true },
  });
  if (!entry) return fail("NOT_FOUND");

  const siblings = await db.entry.findMany({
    where: { userId: user.id, kind: entry.kind },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { id: true },
  });

  const next = moveWithinSection(siblings, entry.id, parsed.data.direction);
  if (!next) return ok({ moved: false });

  await db.$transaction(async (tx) => {
    for (const row of next) {
      await tx.entry.updateMany({
        where: { id: row.id, userId: user.id },
        data: { sortOrder: row.sortOrder },
      });
    }
  });

  revalidatePath("/library");
  return ok({ moved: true });
}

/** Append a bullet to an owned entry. */
export async function createBullet(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");

  const parsed = createBulletSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", zodFieldErrors(parsed.error));

  const entry = await db.entry.findFirst({
    where: { id: parsed.data.entryId, userId: user.id },
    select: { id: true },
  });
  if (!entry) return fail("NOT_FOUND");

  const created = await db.$transaction(async (tx) => {
    const max = await tx.bullet.aggregate({
      where: { entryId: entry.id, userId: user.id },
      _max: { sortOrder: true },
    });
    return tx.bullet.create({
      data: {
        userId: user.id,
        entryId: entry.id,
        text: parsed.data.text,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
      select: { id: true },
    });
  });

  revalidatePath("/library");
  return ok({ id: created.id });
}

/** Update the text of one owned bullet. */
export async function updateBullet(
  input: unknown,
): Promise<ActionResult<{ saved: true }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");

  const parsed = updateBulletSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", zodFieldErrors(parsed.error));

  const result = await db.bullet.updateMany({
    where: { id: parsed.data.id, userId: user.id },
    data: { text: parsed.data.text },
  });
  if (result.count === 0) return fail("NOT_FOUND");

  revalidatePath("/library");
  return ok({ saved: true });
}

/** Delete one owned bullet. No confirmation dialog. */
export async function deleteBullet(
  input: unknown,
): Promise<ActionResult<{ deleted: true }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");

  const parsed = deleteBulletSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", zodFieldErrors(parsed.error));

  const result = await db.bullet.deleteMany({
    where: { id: parsed.data.id, userId: user.id },
  });
  if (result.count === 0) return fail("NOT_FOUND");

  revalidatePath("/library");
  return ok({ deleted: true });
}

/** Swap a bullet with its neighbour on the same entry. */
export async function reorderBullet(
  input: unknown,
): Promise<ActionResult<{ moved: boolean }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");

  const parsed = reorderBulletSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", zodFieldErrors(parsed.error));

  const bullet = await db.bullet.findFirst({
    where: { id: parsed.data.id, userId: user.id },
    select: { id: true, entryId: true },
  });
  if (!bullet) return fail("NOT_FOUND");

  const siblings = await db.bullet.findMany({
    where: { userId: user.id, entryId: bullet.entryId },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { id: true },
  });

  const next = moveWithinSection(siblings, bullet.id, parsed.data.direction);
  if (!next) return ok({ moved: false });

  await db.$transaction(async (tx) => {
    for (const row of next) {
      await tx.bullet.updateMany({
        where: { id: row.id, userId: user.id },
        data: { sortOrder: row.sortOrder },
      });
    }
  });

  revalidatePath("/library");
  return ok({ moved: true });
}
