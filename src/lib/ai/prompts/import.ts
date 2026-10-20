import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

/**
 * IMPORT prompt and loose output schema. docs/05-AI.md → IMPORT.
 * Limits are enforced in features/import/extract.ts after the call.
 */

export const SYSTEM = `You extract resumes into structured data for a resume-tailoring app.

Rules:
- Copy text faithfully. Do not rewrite, improve, summarise or merge bullets. Only fix obvious extraction artifacts (broken hyphenation, stray bullet symbols, doubled spaces).
- Never invent information. If a field is not present, use null (or [] for lists).
- Dates: "YYYY-MM" when month and year are known, "YYYY" when only the year is known, otherwise null. "Present"/"Current" → endDate null and isCurrent true.
- kind: paid roles, internships and contract work → EXPERIENCE; personal/academic/open-source work → PROJECT; degrees/diplomas/courses → EDUCATION; certifications/licences → CERTIFICATION; unpaid community work → VOLUNTEER; anything else → OTHER.
- Every bullet belongs to exactly one entry, in original order. Paragraph-style descriptions become one bullet per sentence.
- Skills: include items from any skills section, plus technologies/tools explicitly named in bullets. One skill per item ("React", not "React/Redux" — split those). Use a short category ("Languages", "Frameworks", "Tools", "Cloud", "Data", "Soft skills") or null.
- profile.headline: the line under the name if present, else null. Do not create one.
- Add a warning for anything you could not place or were unsure about (e.g. "Dates for 'Acme' were unclear").`;

export const OutputSchema = z.object({
  profile: z.object({
    fullName: z.string().nullable(),
    headline: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    location: z.string().nullable(),
    links: z.array(z.object({ label: z.string(), url: z.string() })),
    summary: z.string().nullable(),
  }),
  entries: z.array(
    z.object({
      kind: z.enum([
        "EXPERIENCE",
        "PROJECT",
        "EDUCATION",
        "CERTIFICATION",
        "VOLUNTEER",
        "OTHER",
      ]),
      title: z.string(),
      organization: z.string().nullable(),
      location: z.string().nullable(),
      startDate: z.string().nullable(),
      endDate: z.string().nullable(),
      isCurrent: z.boolean(),
      url: z.string().nullable(),
      bullets: z.array(z.string()),
    }),
  ),
  skills: z.array(
    z.object({ name: z.string(), category: z.string().nullable() }),
  ),
  warnings: z.array(z.string()),
});

export type ImportOutput = z.infer<typeof OutputSchema>;

const EXTRACT_INSTRUCTION = "Extract this resume into the schema.";

export function buildContent(
  input: { kind: "pdf"; base64: string } | { kind: "text"; text: string },
): Anthropic.ContentBlockParam[] {
  if (input.kind === "pdf") {
    return [
      {
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: input.base64,
        },
      },
      { type: "text", text: EXTRACT_INSTRUCTION },
    ];
  }
  return [{ type: "text", text: wrapResume(input.text) }];
}

/** Keep the resume inside the wrapper if the file contains the closing tag. */
function wrapResume(text: string): string {
  const safe = text.replace(/<\/\s*resume\s*>/gi, "</ resume>");
  return `<resume>\n${safe}\n</resume>`;
}
