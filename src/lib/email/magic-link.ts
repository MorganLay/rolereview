import "server-only";

import { render } from "@react-email/render";
import { Resend } from "resend";

import { strings } from "@/copy/strings";
import type { EmailTransport, OutboundEmail } from "@/lib/email/send";
import { MagicLinkEmail } from "@/lib/email/templates/magic-link";
import { env } from "@/lib/env";

export type MagicLinkSendResult = { ok: true; id: string } | { ok: false; code: string };

async function resendTransport(message: OutboundEmail): Promise<{ id: string } | { error: string }> {
  const key = env.RESEND_API_KEY;
  if (!key) return { error: "unconfigured" };
  const resend = new Resend(key);
  const result = await resend.emails.send(
    {
      from: message.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
    },
    { idempotencyKey: message.idempotencyKey },
  );
  if (result.error) return { error: result.error.name };
  return { id: result.data.id };
}

/** Transactional sign-in link. Does not write EmailLog. */
export async function sendMagicLinkEmail(
  input: {
    to: string;
    from: string;
    signInUrl: string;
    preferencesUrl: string;
    mailingAddress: string | null;
    idempotencyKey: string;
  },
  transport: EmailTransport = { send: resendTransport },
): Promise<MagicLinkSendResult> {
  if (!input.from) return { ok: false, code: "unconfigured" };

  const html = await render(
    MagicLinkEmail({
      signInUrl: input.signInUrl,
      preferencesUrl: input.preferencesUrl,
      mailingAddress: input.mailingAddress,
    }),
  );

  try {
    const sent = await transport.send({
      to: input.to,
      from: input.from,
      subject: strings.email.magicLink.subject,
      html,
      idempotencyKey: input.idempotencyKey,
    });
    if ("error" in sent) return { ok: false, code: sent.error };
    return { ok: true, id: sent.id };
  } catch (error) {
    return { ok: false, code: error instanceof Error ? error.name : "throw" };
  }
}
