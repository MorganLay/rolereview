"use server";

import { cookies, headers } from "next/headers";

import { isPublicLeadLimited } from "@/features/growth/leads/limit";
import { captureServerEvent } from "@/lib/analytics";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { clientIpForLimit, hashClientIp } from "@/lib/iphash";
import { fail, ok, type ActionResult } from "@/lib/result";
import {
  ATTRIBUTION_COOKIE,
  parseAttributionCookie,
} from "@/lib/supabase/attribution";
import { verifyTurnstile } from "@/lib/turnstile";

import {
  emailKeywordReportSchema,
  joinNewsletterSchema,
  joinWaitlistSchema,
} from "./schemas";
import { shareRefFromLeadId } from "./share-ref";

type PublicLeadGate =
  | { ok: true; ipHash: string }
  | { ok: false; code: "CAPTCHA_FAILED" | "RATE_LIMITED" | "INTERNAL" };

async function gatePublicLead(turnstileToken: string): Promise<PublicLeadGate> {
  const headerStore = await headers();
  const remoteIp = clientIpForLimit(headerStore, env.NODE_ENV);
  if (!remoteIp) return { ok: false, code: "RATE_LIMITED" };

  const captchaOk = await verifyTurnstile(turnstileToken, remoteIp);
  if (!captchaOk) return { ok: false, code: "CAPTCHA_FAILED" };

  const ipHash = hashClientIp(remoteIp);
  if (!ipHash) return { ok: false, code: "INTERNAL" };

  const runCount = await db.freeToolRun.count({
    where: { ipHash, tool: "PUBLIC_LEAD" },
  });
  if (isPublicLeadLimited(runCount)) return { ok: false, code: "RATE_LIMITED" };

  return { ok: true, ipHash };
}

async function recordPublicLead(ipHash: string): Promise<void> {
  await db.freeToolRun.create({
    data: { tool: "PUBLIC_LEAD", ipHash, success: true },
  });
}

export async function joinWaitlist(
  input: unknown,
): Promise<ActionResult<{ shareRef: string }>> {
  const parsed = joinWaitlistSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION", parsed.error.flatten().fieldErrors);
  }

  const { email, consentText, turnstileToken } = parsed.data;
  const gated = await gatePublicLead(turnstileToken);
  if (!gated.ok) return fail(gated.code);

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

  await recordPublicLead(gated.ipHash);
  await captureServerEvent(lead.id, "lead_captured", { source: "waitlist" });

  return ok({ shareRef: shareRefFromLeadId(lead.id) });
}

export async function joinNewsletter(input: unknown): Promise<ActionResult<Record<string, never>>> {
  const parsed = joinNewsletterSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION", parsed.error.flatten().fieldErrors);
  }

  const { email, consentText, turnstileToken } = parsed.data;
  const gated = await gatePublicLead(turnstileToken);
  if (!gated.ok) return fail(gated.code);

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

  await recordPublicLead(gated.ipHash);
  await captureServerEvent(lead.id, "lead_captured", { source: "newsletter" });

  return ok({});
}

export async function emailKeywordReport(
  input: unknown,
): Promise<ActionResult<Record<string, never>>> {
  const parsed = emailKeywordReportSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION", parsed.error.flatten().fieldErrors);
  }

  const { email, consentText, turnstileToken } = parsed.data;
  const gated = await gatePublicLead(turnstileToken);
  if (!gated.ok) return fail(gated.code);

  const cookieStore = await cookies();
  const attribution = parseAttributionCookie(
    cookieStore.get(ATTRIBUTION_COOKIE)?.value,
  );

  const now = new Date();

  const lead = await db.lead.upsert({
    where: { email },
    create: {
      email,
      source: "tool:keyword-checker",
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

  await recordPublicLead(gated.ipHash);
  await captureServerEvent(lead.id, "lead_captured", {
    source: "tool:keyword-checker",
  });

  return ok({});
}
