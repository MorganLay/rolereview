"use server";

import { redirect } from "next/navigation";

import { requireUserForAction } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, ok, type ActionResult } from "@/lib/result";
import { createClient } from "@/lib/supabase/server";

import { setTimezoneSchema } from "./schemas";

/** Persist browser timezone on first app load (and when the client sends it). */
export async function setTimezone(
  input: unknown,
): Promise<ActionResult<{ timezone: string }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");

  const parsed = setTimezoneSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION", parsed.error.flatten().fieldErrors);
  }

  const { timezone } = parsed.data;
  const result = await db.user.updateMany({
    where: { id: user.id },
    data: { timezone },
  });
  if (result.count === 0) return fail("NOT_FOUND");

  return ok({ timezone });
}

/** End the Supabase session and return to sign-in. */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
