/**
 * Section order and contact links stored on a tailored resume.
 * Older resumes omit both fields and keep the original layout.
 */

import { ENTRY_KINDS, type LibrarySnapshot } from "@/features/library/schemas";

import type { ResumeContact, ResumeContent } from "./schemas";

export type EntryKind = (typeof ENTRY_KINDS)[number];

export function resumeSectionOrder(order: readonly string[] | undefined): EntryKind[] {
  const allowed = new Set<string>(ENTRY_KINDS);
  const next: EntryKind[] = [];
  for (const kind of order ?? []) {
    if (!allowed.has(kind) || next.includes(kind as EntryKind)) continue;
    next.push(kind as EntryKind);
  }
  for (const kind of ENTRY_KINDS) {
    if (!next.includes(kind)) next.push(kind);
  }
  return next;
}

/** Selected links when this resume recorded them. Otherwise every profile link. */
export function resumeContactLinks(
  content: Pick<ResumeContent, "contacts">,
  profile: LibrarySnapshot["profile"],
): { label: string; url: string }[] {
  if (!content.contacts) return profile.links;
  return content.contacts.map((link: ResumeContact) => ({
    label: link.label,
    url: link.url,
  }));
}
