/**
 * Evidence links in the match panel.
 * A ref points at a resume bullet, its entry, or a skill chip.
 * docs/02-USER-FLOWS.md → Resume workspace → Match panel.
 */

import type { LibrarySnapshot } from "@/features/library/schemas";

import type { ResumeContent } from "./schemas";

export const SKILLS_SECTION_ID = "resume-skills";
const LABEL_MAX = 80;

export type EvidenceLink = {
  ref: string;
  label: string;
  elementId: string;
};

export function bulletElementId(id: string): string {
  return `resume-bullet-${id}`;
}

export function entryElementId(ref: string): string {
  return `resume-entry-${ref}`;
}

export function skillElementId(ref: string): string {
  return `resume-skill-${ref}`;
}

/** First matching target for each ref. Unknown refs are left out. */
export function evidenceLinks(
  refs: readonly string[],
  content: ResumeContent,
  snapshot: LibrarySnapshot,
): EvidenceLink[] {
  const links: EvidenceLink[] = [];
  const seen = new Set<string>();
  for (const ref of refs) {
    if (seen.has(ref)) continue;
    seen.add(ref);
    const link = resolveEvidenceRef(ref, content, snapshot);
    if (link) links.push(link);
  }
  return links;
}

export function resolveEvidenceRef(
  ref: string,
  content: ResumeContent,
  snapshot: LibrarySnapshot,
): EvidenceLink | null {
  const skill = snapshot.skills.find((item) => item.ref === ref);
  if (skill) {
    const onResume = content.skills.some((group) =>
      group.names.includes(skill.name),
    );
    return {
      ref,
      label: skill.name,
      elementId: onResume ? skillElementId(skill.ref) : SKILLS_SECTION_ID,
    };
  }

  for (const entry of snapshot.entries) {
    const bullet = entry.bullets.find((item) => item.ref === ref);
    if (!bullet) continue;
    const label = linkLabel(bullet.text);
    if (!label) return null;
    const contentEntry = content.entries.find((item) => item.ref === entry.ref);
    const contentBullet = contentEntry?.bullets.find((item) =>
      item.sourceRefs.includes(ref),
    );
    if (contentBullet) {
      return { ref, label, elementId: bulletElementId(contentBullet.id) };
    }
    if (contentEntry) {
      return { ref, label, elementId: entryElementId(entry.ref) };
    }
    return null;
  }

  const entry = snapshot.entries.find((item) => item.ref === ref);
  if (!entry || !content.entries.some((item) => item.ref === entry.ref)) {
    return null;
  }
  return {
    ref,
    label: entry.title.trim(),
    elementId: entryElementId(entry.ref),
  };
}

function linkLabel(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= LABEL_MAX) return flat;
  return `${flat.slice(0, LABEL_MAX - 1)}…`;
}
