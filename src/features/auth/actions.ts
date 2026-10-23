"use server";

import { randomUUID } from "node:crypto";

import { headers } from "next/headers";

import {
  MAGIC_LINK_LIMIT,
  MAGIC_LINK_TEMPLATE,
  MAGIC_LINK_WINDOW_MS,
  magicLinkBlocked,
  magicLinkIpBlocked,
  magicLinkOriginAllowed,
  magicLinkRecipientKey,
  magicLinkRedirectUrl,
  magicLinkSignInUrl,
  requestMagicLinkSchema,
} from "@/features/auth/magic-link";
import { db } from "@/lib/db";
import { emailSendingEnabled } from "@/lib/deploy";
import { publicMailingAddress } from "@/lib/email/address";
import { sendMagicLinkEmail } from "@/lib/email/magic-link";
import { env } from "@/lib/env";
import { clientIpForLimit, hashClientIp } from "@/lib/iphash";
import { fail, ok, type ActionResult } from "@/lib/result";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeRedirectPath } from "@/lib/supabase/redirect";

const LINK_TYPES = new Set(["signup", "magiclink", "email"]);

/**
 * Generate a Supabase magic link and send it with Resend.
 * Does not use the built-in mailer (that path is rate-limited).
 */
export async function requestMagicLink(input: unknown): Promise<ActionResult<{ sent: true }>> {
  const parsed = requestMagicLinkSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION");

  const next = safeRedirectPath(parsed.data.next);
  if (!magicLinkOriginAllowed(parsed.data.origin, env.NEXT_PUBLIC_APP_URL, env.NODE_ENV)) {
    return fail("VALIDATION");
  }

  const from = env.EMAIL_FROM;
  if (!emailSendingEnabled(env.VERCEL_ENV)) {
    console.error("magic link failed", { code: "preview" });
    return fail("INTERNAL");
  }
  if (!env.SUPABASE_SECRET_KEY || !env.RESEND_API_KEY || !from) {
    console.error("magic link failed", { code: "unconfigured" });
    return fail("INTERNAL");
  }

  const admin = createAdminClient();
  if (!admin) {
    console.error("magic link failed", { code: "auth_unconfigured" });
    return fail("INTERNAL");
  }

  const headerStore = await headers();
  const remoteIp = clientIpForLimit(headerStore, env.NODE_ENV);
  if (!remoteIp) return fail("RATE_LIMITED");
  const ipHash = hashClientIp(remoteIp);
  if (!ipHash) return fail("INTERNAL");

  const recipientKey = magicLinkRecipientKey(parsed.data.email, env.IP_HASH_SALT ?? "rolerefine");
  const since = new Date(Date.now() - MAGIC_LINK_WINDOW_MS);
  const [recent, ipRuns] = await Promise.all([
    db.emailLog.count({
      where: { template: MAGIC_LINK_TEMPLATE, recipientKey, sentAt: { gte: since } },
    }),
    db.freeToolRun.count({
      where: { ipHash, tool: "MAGIC_LINK" },
    }),
  ]);
  if (magicLinkBlocked(recent, MAGIC_LINK_LIMIT)) return fail("RATE_LIMITED");
  if (magicLinkIpBlocked(ipRuns)) return fail("RATE_LIMITED");

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: parsed.data.email,
    options: { redirectTo: magicLinkRedirectUrl(parsed.data.origin, next) },
  });
  const tokenHash = data?.properties?.hashed_token;
  const type = data?.properties?.verification_type;
  if (error || !tokenHash || !type || !LINK_TYPES.has(type)) {
    console.error("magic link failed", { code: error?.code ?? "generate" });
    return fail("INTERNAL");
  }

  const refKey = randomUUID();
  const sent = await sendMagicLinkEmail({
    to: parsed.data.email,
    from,
    signInUrl: magicLinkSignInUrl({
      origin: parsed.data.origin,
      tokenHash,
      type,
      next,
    }),
    preferencesUrl: `${parsed.data.origin}/settings?tab=preferences`,
    mailingAddress: publicMailingAddress(env.MAILING_ADDRESS),
    idempotencyKey: `${MAGIC_LINK_TEMPLATE}:${recipientKey}:${refKey}`,
  });
  if (!sent.ok) {
    console.error("magic link failed", { code: sent.code });
    return fail("INTERNAL");
  }

  try {
    await db.emailLog.create({
      data: {
        recipientKey,
        template: MAGIC_LINK_TEMPLATE,
        refKey,
        providerMessageId: sent.id,
      },
    });
  } catch {
    console.error("magic link failed", { code: "log" });
  }

  try {
    await db.freeToolRun.create({
      data: { tool: "MAGIC_LINK", ipHash, success: true },
    });
  } catch {
    console.error("magic link failed", { code: "ip_log" });
  }

  return ok({ sent: true });
}
