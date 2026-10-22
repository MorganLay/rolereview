"use server";

import { cookies, headers } from "next/headers";

import { captureServerEvent } from "@/lib/analytics";
import { db } from "@/lib/db";
import { fail, ok, type ActionResult } from "@/lib/result";
import {
  ATTRIBUTION_COOKIE,
  parseAttributionCookie,
} from "@/lib/supabase/attribution";
import { verifyTurnstile } from "@/lib/turnstile";

import { joinNewsletterSchema, joinWaitlistSchema } from "./schemas";
import { shareRefFromLeadId } from "./share-ref";

export async function joinWaitlist(
  input: unknown,
): Promise<ActionResult<{ shareRef: string }>> {
  const parsed = joinWaitlistSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION", parsed.error.flatten().fieldErrors);
  }

  const { email, consentText, turnstileToken } = parsed.data;

  const headerStore = await headers();
  const remoteIp =
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerStore.get("x-real-ip");

  const captchaOk = await verifyTurnstile(turnstileToken, remoteIp);
  if (!captchaOk) return fail("CAPTCHA_FAILED");

  const cookieStore = await cookies();
  const attribution = parseAttributionCookie(
    cookieStore.get(ATTRIBUTION_COOKIE)?.value,
  );

  const now = new Date();

  const lead = await db.lead.upsert({
    where: { email },
    create: {
      email,
      source: "waitlist",
      foundingOffer: true,
      marketingConsentAt: now,
      consentText,
      utmSource: attribution?.utmSource ?? null,
      utmMedium: attribution?.utmMedium ?? null,
      utmCampaign: attribution?.utmCampaign ?? null,
      referrer: attribution?.referrer ?? attribution?.ref ?? null,
    },
    update: {
      foundingOffer: true,
      marketingConsentAt: now,
      consentText,
      // Keep original UTM on duplicate; refresh consent for re-submits.
    },
    select: { id: true },
  });

  await captureServerEvent(lead.id, "lead_captured", { source: "waitlist" });

  return ok({ shareRef: shareRefFromLeadId(lead.id) });
}

export async function joinNewsletter(input: unknown): Promise<ActionResult<Record<string, never>>> {
  const parsed = joinNewsletterSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION", parsed.error.flatten().fieldErrors);
  }

  const { email, consentText, turnstileToken } = parsed.data;

  const headerStore = await headers();
  const remoteIp =
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerStore.get("x-real-ip");

  const captchaOk = await verifyTurnstile(turnstileToken, remoteIp);
  if (!captchaOk) return fail("CAPTCHA_FAILED");

  const cookieStore = await cookies();
  const attribution = parseAttributionCookie(
    cookieStore.get(ATTRIBUTION_COOKIE)?.value,
  );

  const now = new Date();

  const lead = await db.lead.upsert({
    where: { email },
    create: {
      email,
      source: "newsletter",
      foundingOffer: false,
      marketingConsentAt: now,
      consentText,
      utmSource: attribution?.utmSource ?? null,
      utmMedium: attribution?.utmMedium ?? null,
      utmCampaign: attribution?.utmCampaign ?? null,
      referrer: attribution?.referrer ?? attribution?.ref ?? null,
    },
    update: {
      marketingConsentAt: now,
      consentText,
    },
    select: { id: true },
  });

  await captureServerEvent(lead.id, "lead_captured", { source: "newsletter" });

  return ok({});
}
