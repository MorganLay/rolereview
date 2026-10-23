"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUserForAction } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, ok, type ActionResult } from "@/lib/result";
import { createClient } from "@/lib/supabase/server";

import { MARKETING_CONSENT_TEXT, nextMarketingConsent } from "./preferences";
import { preferencesSchema, setTimezoneSchema } from "./schemas";

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

/** Save timezone, email switches, and marketing consent for the signed-in user. */
export async function updatePreferences(
  input: unknown,
): Promise<ActionResult<{ timezone: string }>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");

  const parsed = preferencesSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION", parsed.error.flatten().fieldErrors);
  }

  const current = await db.user.findFirst({
    where: { id: user.id },
    select: { marketingConsentAt: true, marketingConsentText: true },
  });
  if (!current) return fail("NOT_FOUND");

  const consent = nextMarketingConsent({
    requested: parsed.data.marketingConsent,
    existingAt: current.marketingConsentAt,
    existingText: current.marketingConsentText,
    now: new Date(),
    text: MARKETING_CONSENT_TEXT,
  });

  const result = await db.user.updateMany({
    where: { id: user.id },
    data: {
      timezone: parsed.data.timezone,
      emailRemindersEnabled: parsed.data.emailRemindersEnabled,
      weeklyDigestEnabled: parsed.data.weeklyDigestEnabled,
      marketingConsentAt: consent.marketingConsentAt,
      marketingConsentText: consent.marketingConsentText,
    },
  });
  if (result.count === 0) return fail("NOT_FOUND");

  revalidatePath("/settings");
  return ok({ timezone: parsed.data.timezone });
}

/** End the Supabase session and return to sign-in. */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
