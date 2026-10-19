"use server";

import { revalidatePath } from "next/cache";

import { requireUserForAction } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, ok, type ActionResult } from "@/lib/result";

import { profileFieldErrors, updateProfileSchema } from "./schemas";

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
