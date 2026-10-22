import { z } from "zod";

import { strings } from "@/copy/strings";

export const WAITLIST_CONSENT_TEXT = strings.marketing.waitlist.consentLabel;
export const NEWSLETTER_CONSENT_TEXT = strings.marketing.footer.newsletterConsent;
export const KEYWORD_REPORT_CONSENT_TEXT =
  strings.marketing.tools.keyword.emailConsent;

const emailField = z
  .string()
  .trim()
  .email()
  .max(320)
  .transform((value) => value.toLowerCase());

export const joinWaitlistSchema = z.object({
  email: emailField,
  marketingConsent: z.literal(true, {
    error: strings.marketing.waitlist.consentRequired,
  }),
  turnstileToken: z.string().min(1),
  /** Exact checkbox wording at submit time (CASL). */
  consentText: z.literal(WAITLIST_CONSENT_TEXT),
});

export const joinNewsletterSchema = z.object({
  email: emailField,
  marketingConsent: z.literal(true, {
    error: strings.marketing.footer.newsletterConsentRequired,
  }),
  turnstileToken: z.string().min(1),
  consentText: z.literal(NEWSLETTER_CONSENT_TEXT),
});

export const emailKeywordReportSchema = z.object({
  email: emailField,
  marketingConsent: z.literal(true, {
    error: strings.marketing.tools.keyword.emailConsentRequired,
  }),
  turnstileToken: z.string().min(1),
  consentText: z.literal(KEYWORD_REPORT_CONSENT_TEXT),
});

export type JoinWaitlistInput = z.infer<typeof joinWaitlistSchema>;
export type JoinNewsletterInput = z.infer<typeof joinNewsletterSchema>;
export type EmailKeywordReportInput = z.infer<typeof emailKeywordReportSchema>;
