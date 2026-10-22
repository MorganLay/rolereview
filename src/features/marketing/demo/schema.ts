import { z } from "zod";

import { JobAnalysis } from "@/features/jobs/schemas";
import { LibrarySnapshot } from "@/features/library/schemas";
import { MatchReport, ResumeContent } from "@/features/tailor/schemas";

/** Marketing demo personas. Labels live in strings. docs/09-MARKETING.md → section 6. */
export const DEMO_PERSONAS = ["cs-grad", "bi-analyst", "retail-changer"] as const;

/** Marketing demo postings, from evals/fixtures/postings. */
export const DEMO_POSTINGS = ["junior-dev", "data-analyst", "frontend"] as const;

export const DemoPersonaId = z.enum(DEMO_PERSONAS);
export const DemoPostingId = z.enum(DEMO_POSTINGS);

export const DemoFixture = z.object({
  persona: DemoPersonaId,
  posting: DemoPostingId,
  jobLabel: z.string().trim().min(1),
  snapshot: LibrarySnapshot,
  analysis: JobAnalysis,
  content: ResumeContent,
  match: MatchReport,
});

export type DemoPersonaId = z.infer<typeof DemoPersonaId>;
export type DemoPostingId = z.infer<typeof DemoPostingId>;
export type DemoFixture = z.infer<typeof DemoFixture>;

export function isDemoPersona(value: string): value is DemoPersonaId {
  return DEMO_PERSONAS.some((persona) => persona === value);
}

export function isDemoPosting(value: string): value is DemoPostingId {
  return DEMO_POSTINGS.some((posting) => posting === value);
}
