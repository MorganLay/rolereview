import "server-only";

import { render } from "@react-email/render";
import { Resend } from "resend";

import { strings } from "@/copy/strings";
import { db } from "@/lib/db";
import { publicMailingAddress } from "@/lib/email/address";
import { decideEmailSend, type EmailTemplateName } from "@/lib/email/decide";
import { WelcomeEmail } from "@/lib/email/templates/welcome";
import { env } from "@/lib/env";

export type EmailSendResult =
  | { status: "sent"; providerMessageId: string }
  | { status: "skipped"; reason: "already-sent" | "no-consent" | "no-address" | "unconfigured" | "unknown-template" }
  | { status: "failed" };

export type OutboundEmail = {
  to: string;
  from: string;
  subject: string;
  html: string;
  idempotencyKey: string;
};

export type EmailTransport = {
  send: (message: OutboundEmail) => Promise<{ id: string } | { error: string }>;
};

type SendEmailInput = {
  to: string;
  template: EmailTemplateName;
  refKey: string;
  recipientKey: string;
  marketingConsentAt?: Date | null;
};

function appOrigin(): string {
  return env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
}

async function resendTransport(message: OutboundEmail): Promise<{ id: string } | { error: string }> {
  const resend = new Resend(env.RESEND_API_KEY);
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

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "P2002"
  );
}

/**
 * Send one template, once per recipient and ref. A missing Resend config or a
 * failed send does not throw. Marketing templates are refused without consent
 * and without a real mailing address.
 */
export async function sendEmail(
  input: SendEmailInput,
  transport: EmailTransport = { send: resendTransport },
): Promise<EmailSendResult> {
  const mailingAddress = publicMailingAddress(env.MAILING_ADDRESS);
  const existing = await db.emailLog.findFirst({
    where: {
      recipientKey: input.recipientKey,
      template: input.template,
      refKey: input.refKey,
    },
    select: { id: true },
  });

  const decision = decideEmailSend({
    template: input.template,
    alreadySent: existing !== null,
    marketingConsent: input.marketingConsentAt != null,
    configured: Boolean(env.RESEND_API_KEY && env.EMAIL_FROM),
    hasMailingAddress: mailingAddress !== null,
  });

  if (decision !== "send") {
    if (decision === "unconfigured" || decision === "unknown-template") {
      console.info("email skipped", {
        template: input.template,
        recipientKey: input.recipientKey,
        code: decision,
      });
    }
    return { status: "skipped", reason: decision };
  }

  if (input.template !== "welcome") {
    console.error("email send failed", {
      template: input.template,
      recipientKey: input.recipientKey,
      code: "no-renderer",
    });
    return { status: "failed" };
  }

  const origin = appOrigin();
  const html = await render(
    WelcomeEmail({
      libraryUrl: `${origin}/library/import`,
      preferencesUrl: `${origin}/settings?tab=preferences`,
      mailingAddress,
    }),
  );

  const from = env.EMAIL_FROM;
  if (!from) return { status: "skipped", reason: "unconfigured" };

  const sent = await transport.send({
    to: input.to,
    from,
    subject: strings.email.welcome.subject,
    html,
    idempotencyKey: `${input.template}:${input.recipientKey}:${input.refKey}`,
  });

  if ("error" in sent) {
    console.error("email send failed", {
      template: input.template,
      recipientKey: input.recipientKey,
      code: sent.error,
    });
    return { status: "failed" };
  }

  try {
    await db.emailLog.create({
      data: {
        recipientKey: input.recipientKey,
        template: input.template,
        refKey: input.refKey,
        providerMessageId: sent.id,
      },
    });
  } catch (error) {
    if (!isUniqueViolation(error)) {
      console.error("email log failed", {
        template: input.template,
        recipientKey: input.recipientKey,
        code: "log",
      });
    }
  }

  return { status: "sent", providerMessageId: sent.id };
}

/** Welcome is transactional. Failure does not block account creation. */
export async function sendWelcomeEmail(input: {
  to: string;
  recipientKey: string;
}): Promise<EmailSendResult> {
  try {
    return await sendEmail({
      to: input.to,
      template: "welcome",
      refKey: "signup",
      recipientKey: input.recipientKey,
    });
  } catch (error) {
    console.error("welcome email failed", {
      recipientKey: input.recipientKey,
      code: error instanceof Error ? error.name : "throw",
    });
    return { status: "failed" };
  }
}
