import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { strings } from "@/copy/strings";

/**
 * ANALYZE prompt and loose output schema. docs/05-AI.md → ANALYZE.
 * Requirement ids, caps, and salary cleanup live in features/jobs/analyze.ts.
 */

const unknownCompany = strings.jobs.placeholders.company;

export const SYSTEM = `You analyse job postings for a resume-tailoring app. Extract only what the posting states.

- title, company, location: as written. If the company is not named, use "${unknownCompany}".
- seniority: infer from title and years of experience; "unknown" if unclear.
- summary: 1–2 plain sentences describing the role.
- requirements: 5–20 distinct, concrete requirements. Split compound lines ("React and TypeScript" → two requirements). importance "must" for required/minimum qualifications, "nice" for preferred/asset/bonus. Skip generic filler ("team player", "fast-paced environment") unless it is the only requirement of its kind.
- keywords: 10–30 terms an applicant-tracking system would match: tools, technologies, methods, certifications, domain terms. Use the exact spelling from the posting.
- workMode, employmentType, salary (min/max/currency/period), referenceNumber (requisition / competition / selection process number): only if stated; otherwise UNKNOWN / null. Never estimate salary.`;

export const ANALYZE_INPUT_MAX = 15_000;

const requirementKind = z.enum([
  "skill",
  "experience",
  "education",
  "certification",
  "other",
]);

const importance = z.enum(["must", "nice"]);

/** Loose model output. No requirement ids, no length limits. */
export const OutputSchema = z.object({
  title: z.string(),
  company: z.string(),
  location: z.string().nullable(),
  seniority: z.enum(["intern", "entry", "mid", "senior", "lead", "unknown"]),
  workMode: z.enum(["ONSITE", "HYBRID", "REMOTE", "UNKNOWN"]),
  employmentType: z
    .enum([
      "FULL_TIME",
      "PART_TIME",
      "CONTRACT",
      "TEMPORARY",
      "INTERNSHIP",
      "CO_OP",
      "OTHER",
    ])
    .nullable(),
  salary: z
    .object({
      min: z.number().nullable(),
      max: z.number().nullable(),
      currency: z.string().nullable(),
      period: z.enum(["HOUR", "YEAR"]).nullable(),
    })
    .nullable(),
  referenceNumber: z.string().nullable(),
  summary: z.string(),
  requirements: z.array(
    z.object({
      text: z.string(),
      kind: requirementKind,
      importance,
    }),
  ),
  keywords: z.array(z.string()),
});

export type AnalyzeOutput = z.infer<typeof OutputSchema>;

export function buildContent(rawText: string): Anthropic.ContentBlockParam[] {
  const truncated = rawText.slice(0, ANALYZE_INPUT_MAX);
  return [{ type: "text", text: wrapPosting(truncated) }];
}

/** Keep the posting inside the wrapper if the text contains the closing tag. */
function wrapPosting(text: string): string {
  const safe = text.replace(/<\/\s*posting\s*>/gi, "</ posting>");
  return `<posting>\n${safe}\n</posting>`;
}
