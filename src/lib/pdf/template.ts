/**
 * Which resume PDF to render.
 * docs/03-ARCHITECTURE.md → Exports. Modern and Compact fall back to Classic.
 */

export const RESUME_TEMPLATES = ["classic", "modern", "compact"] as const;

export type ResumeTemplateId = (typeof RESUME_TEMPLATES)[number];

export function resolveResumeTemplate(
  requested: string | null,
  stored: string,
  entitlements: { modern: boolean; compact: boolean },
): ResumeTemplateId {
  const chosen = parseTemplate(requested) ?? parseTemplate(stored) ?? "classic";
  if (chosen === "modern" && !entitlements.modern) return "classic";
  if (chosen === "compact" && !entitlements.compact) return "classic";
  return chosen;
}

function parseTemplate(value: string | null | undefined): ResumeTemplateId | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "classic" || normalized === "modern" || normalized === "compact") {
    return normalized;
  }
  return null;
}
