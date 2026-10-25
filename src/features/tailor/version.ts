/**
 * Version names and the submitted-version lock.
 * docs/06-ROADMAP.md → TQ.5. docs/07-DECISIONS.md → D-30.
 */

import { formatJobInstant } from "@/features/jobs/format";

/** Stored `label` cap for a tailored resume or cover letter. */
export const VERSION_LABEL_MAX = 80;

const TITLE_DASH = "\u2014";

/** Blank stores null. A too-long value is rejected by the action schema. */
export function normalizeVersionLabel(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * The name on a version card and in the workspace.
 * A saved label wins. Otherwise "{Company} — {date}" in the user's timezone.
 * A blank company leaves the date on its own.
 */
export function versionTitle(input: {
  label: string | null;
  company: string;
  createdAt: Date | string;
  timeZone: string;
}): string {
  const custom = input.label?.trim() ?? "";
  if (custom.length > 0) return custom;
  const iso =
    input.createdAt instanceof Date ? input.createdAt.toISOString() : input.createdAt;
  const date = formatJobInstant(iso, input.timeZone);
  const company = input.company.trim();
  return company.length > 0 ? `${company} ${TITLE_DASH} ${date}` : date;
}

/** Marking a version submitted freezes its content. A missing stamp is still editable. */
export function versionIsFrozen(submittedAt: Date | null): boolean {
  return submittedAt !== null;
}

/** The next version number on a job. No versions yet starts at 1. */
export function nextVersionNumber(latest: number | null): number {
  return (latest ?? 0) + 1;
}
