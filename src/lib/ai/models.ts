import "server-only";

import type { AiCallKind } from "@/generated/prisma/enums";

/**
 * Model ids, effort, and max output tokens. docs/05-AI.md.
 * Thinking tokens count toward maxTokens.
 */
export const AI_TASKS = {
  IMPORT: { model: "claude-sonnet-5-5", effort: "medium", maxTokens: 16000 },
  ANALYZE: { model: "claude-haiku-5-5", effort: "low", maxTokens: 4000 },
  TAILOR: { model: "claude-sonnet-5-5", effort: "medium", maxTokens: 16000 },
  COVER_LETTER: { model: "claude-sonnet-5-5", effort: "medium", maxTokens: 12000 },
  FREE_TOOL: { model: "claude-haiku-5-5", effort: "low", maxTokens: 4000 },
  PREP_KIT: { model: "claude-sonnet-5-5", effort: "low", maxTokens: 12000 },
  BULLET_COACH: { model: "claude-haiku-5-5", effort: "medium", maxTokens: 3000 },
} as const satisfies Record<
  AiCallKind,
  { model: string; effort: "low" | "medium"; maxTokens: number }
>;
