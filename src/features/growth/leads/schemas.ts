import { z } from "zod";

import { strings } from "@/copy/strings";

export const WAITLIST_CONSENT_TEXT = strings.marketing.waitlist.consentLabel;

export const joinWaitlistSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(320)
    .transform((value) => value.toLowerCase()),
  marketingConsent: z.literal(true, {
    error: strings.marketing.waitlist.consentRequired,
  }),
  turnstileToken: z.string().min(1),
  /** Exact checkbox wording at submit time (CASL). */
  consentText: z.literal(WAITLIST_CONSENT_TEXT),
});

export type JoinWaitlistInput = z.infer<typeof joinWaitlistSchema>;
