import "server-only";

import type { AiCallKind } from "@/generated/prisma/enums";

/**
 * Model ids, effort, and max output tokens. docs/05-AI.md.
 * Thinking tokens count toward maxTokens.
 */

const TAILOR_TASK = { model: "claude-sonnet-5-5", effort: "medium", maxTokens: 16000 } as const;

/** Job questions use the tailor model. Set this to "haiku" to try the smaller model. */
const JOB_QUESTIONS_PROFILE: "tailor" | "haiku" = "tailor";

export const AI_TASKS = {
  IMPORT: { model: "claude-sonnet-5-5", effort: "medium", maxTokens: 16000 },
  ANALYZE: { model: "claude-haiku-5-5", effort: "low", maxTokens: 4000 },
  TAILOR: TAILOR_TASK,
  COVER_LETTER: { model: "claude-sonnet-5-5", effort: "medium", maxTokens: 12000 },
  FREE_TOOL: { model: "claude-haiku-5-5", effort: "low", maxTokens: 4000 },
  PREP_KIT: { model: "claude-sonnet-5-5", effort: "low", maxTokens: 12000 },
  BULLET_COACH: { model: "claude-haiku-5-5", effort: "medium", maxTokens: 3000 },
  JOB_QUESTIONS:
    (JOB_QUESTIONS_PROFILE as "tailor" | "haiku") === "haiku"
      ? { model: "claude-haiku-5-5", effort: "low", maxTokens: 4000 }
      : TAILOR_TASK,
} as const satisfies Record<
  AiCallKind,
  { model: string; effort: "low" | "medium"; maxTokens: number }
>;
