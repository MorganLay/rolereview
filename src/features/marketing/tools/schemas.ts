import { z } from "zod";

import { strings } from "@/copy/strings";

const copy = strings.marketing.tools.keyword;

export const TOOL_LIMITS = {
  postingMax: 30_000,
  resumeMax: 30_000,
} as const;

export const checkKeywordSchema = z.object({
  posting: z
    .string()
    .trim()
    .min(1, { error: copy.errors.postingRequired })
    .max(TOOL_LIMITS.postingMax, { error: copy.errors.postingLong }),
  resume: z
    .string()
    .trim()
    .min(1, { error: copy.errors.resumeRequired })
    .max(TOOL_LIMITS.resumeMax, { error: copy.errors.resumeLong }),
  turnstileToken: z.string().min(1, { error: strings.marketing.waitlist.captchaRequired }),
});

export type CheckKeywordInput = z.infer<typeof checkKeywordSchema>;

export type KeywordReport = {
  coveragePct: number;
  covered: string[];
  missing: string[];
  mustHaves: string[];
};
