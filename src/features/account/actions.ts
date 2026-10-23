"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Stripe from "stripe";

import { requireUserForAction } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { fail, ok, type ActionResult } from "@/lib/result";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { subscriptionCancelCanContinue } from "./delete";
import { MARKETING_CONSENT_TEXT, nextMarketingConsent } from "./preferences";
import { deleteAccountSchema, preferencesSchema, setTimezoneSchema } from "./schemas";

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

function stripeErrorCode(error: unknown): string | undefined {
  if (error instanceof Stripe.errors.StripeError) return error.code;
  return undefined;
}

/**
 * Cancel Stripe, delete the account, delete the sign-in user, and sign out.
 * Stops before any delete when the auth secret is missing, or when a
 * subscription cannot be cancelled.
 */
export async function deleteAccount(input: unknown): Promise<ActionResult<never>> {
  const user = await requireUserForAction();
  if (!user) return fail("UNAUTHENTICATED");

  const parsed = deleteAccountSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION", parsed.error.flatten().fieldErrors);
  }

  const row = await db.user.findFirst({
    where: { id: user.id },
    select: { id: true, stripeSubscriptionId: true },
  });
  if (!row) return fail("NOT_FOUND");

  if (!env.SUPABASE_SECRET_KEY) {
    console.error("delete account blocked", { userId: user.id, code: "auth_unconfigured" });
    return fail("INTERNAL");
  }

  if (row.stripeSubscriptionId) {
    const stripe = getStripe();
    if (!stripe) {
      console.error("delete account blocked", { userId: user.id, code: "stripe_unconfigured" });
      return fail("INTERNAL");
    }
    try {
      await stripe.subscriptions.cancel(row.stripeSubscriptionId);
    } catch (error) {
      const code = stripeErrorCode(error);
      if (!subscriptionCancelCanContinue(code)) {
        console.error("delete account stripe cancel failed", { userId: user.id, code: code ?? "stripe" });
        return fail("INTERNAL");
      }
    }
  }

  const deleted = await db.user.deleteMany({ where: { id: user.id } });
  if (deleted.count === 0) return fail("NOT_FOUND");

  const admin = createAdminClient();
  if (!admin) {
    console.error("delete account auth client missing", { userId: user.id, code: "auth_unconfigured" });
  } else {
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) {
      console.error("delete account auth delete failed", {
        userId: user.id,
        code: error.code ?? "auth_delete",
      });
    }
  }

  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    console.error("delete account sign-out failed", { userId: user.id, code: "sign_out" });
  }

  redirect("/sign-in");
}

/** End the Supabase session and return to sign-in. */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
