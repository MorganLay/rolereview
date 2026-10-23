"use server";

import { randomUUID } from "node:crypto";

import {
  MAGIC_LINK_LIMIT,
  MAGIC_LINK_TEMPLATE,
  MAGIC_LINK_WINDOW_MS,
  magicLinkBlocked,
  magicLinkOriginAllowed,
  magicLinkRecipientKey,
  magicLinkRedirectUrl,
  magicLinkSignInUrl,
  requestMagicLinkSchema,
} from "@/features/auth/magic-link";
import { db } from "@/lib/db";
import { publicMailingAddress } from "@/lib/email/address";
import { sendMagicLinkEmail } from "@/lib/email/magic-link";
import { env } from "@/lib/env";
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
  if (!env.SUPABASE_SECRET_KEY || !env.RESEND_API_KEY || !from) {
    console.error("magic link failed", { code: "unconfigured" });
    return fail("INTERNAL");
  }

  const admin = createAdminClient();
  if (!admin) {
    console.error("magic link failed", { code: "auth_unconfigured" });
    return fail("INTERNAL");
  }

  const recipientKey = magicLinkRecipientKey(parsed.data.email, env.IP_HASH_SALT ?? "rolerefine");
  const since = new Date(Date.now() - MAGIC_LINK_WINDOW_MS);
  const recent = await db.emailLog.count({
    where: { template: MAGIC_LINK_TEMPLATE, recipientKey, sentAt: { gte: since } },
  });
  if (magicLinkBlocked(recent, MAGIC_LINK_LIMIT)) return fail("RATE_LIMITED");

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

  return ok({ sent: true });
}
