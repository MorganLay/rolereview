/**
 * Chooses a calm improvement action from the deterministic strength result.
 * Excellent lines with no material issue get no prompt.
 */

import type { BulletRole, BulletStrength, StrengthConcern } from "./strength";

export const IMPROVE_KINDS = ["clarify", "evidence", "detail", "repetition"] as const;

export type ImproveKind = (typeof IMPROVE_KINDS)[number];

export type BulletOpportunity = {
  kind: ImproveKind | null;
  /** Concise diagnosis from the existing strength checks. */
  diagnosis: string | null;
};

/**
 * Prefer clarity, then evidence, then missing detail.
 * A Strong/Excellent line with only a missing number is offered detail, not a rewrite push.
 */
export function bulletOpportunity(
  strength: BulletStrength,
  role: BulletRole = "accomplishment",
): BulletOpportunity {
  const diagnosis = primaryDiagnosis(strength);
  if (strength.fixes.length === 0) {
    return { kind: null, diagnosis: null };
  }

  const order: StrengthConcern[] =
    role === "record" ? ["clarity", "evidence"] : ["clarity", "evidence", "missing"];

  for (const concern of order) {
    if (strength.concerns[concern].length === 0) continue;
    if (concern === "clarity") return { kind: "clarify", diagnosis };
    if (concern === "evidence") return { kind: "evidence", diagnosis };
    if (concern === "missing") {
      if (strength.score >= 4) return { kind: "detail", diagnosis };
      return { kind: "clarify", diagnosis };
    }
  }

  return { kind: "clarify", diagnosis };
}

function primaryDiagnosis(strength: BulletStrength): string | null {
  return strength.fixes[0] ?? null;
}
