/**
 * A drafted library line may use only the confirmed answer and the library text
 * it is grounded in. ROLE lines must also keep the person's own verb.
 */

import { reviewRewrite } from "@/features/library/rewrite-guard";

import type { QuestionKind } from "./filter";
import { roleVerbAllowed } from "./role-verb";

export type DraftDecision =
  | { ok: true; text: string }
  | { ok: false; reason: "empty" | "unchanged" | "number" | "unsupported" | "verb" };

/** A confirm with no entry becomes a skill, or a certification when the requirement is one. */
export function lineDestination(input: {
  kind: QuestionKind;
  requirementKind: string;
  entryId: string | null;
}): "BULLET" | "SKILL" | "CERTIFICATION" | null {
  if (!input.entryId) {
    if (input.kind !== "confirm") return null;
    if (input.requirementKind === "certification") return "CERTIFICATION";
    if (input.requirementKind === "education") return null;
    return "SKILL";
  }
  return "BULLET";
}

export function reviewDraftLine(input: {
  text: string;
  answer: string;
  evidence: readonly string[];
  kind: QuestionKind;
}): DraftDecision {
  const reviewed = reviewRewrite({
    text: input.text,
    why: "From the confirmed answer.",
    question: null,
    original: "",
    evidence: [input.answer, ...input.evidence],
  });
  if (!reviewed.ok) return reviewed;
  if (input.kind === "role" && !roleVerbAllowed(reviewed.text, input.answer)) {
    return { ok: false, reason: "verb" };
  }
  return { ok: true, text: reviewed.text };
}
