/**
 * Source chips for a letter paragraph.
 * docs/02-USER-FLOWS.md → Cover letter workspace.
 * docs/05-AI.md → COVER_LETTER refs.
 */

import { strings } from "@/copy/strings";
import type { LibrarySnapshot } from "@/features/library/schemas";

import { POSTING_REF, WHY_REF } from "./schemas";

const copy = strings.jobs.letters;

export type LetterSourceChip = {
  ref: string;
  kind: "library" | "posting" | "why";
  title: string;
  text: string;
};

type SnapshotEntry = LibrarySnapshot["entries"][number];

/** Library items, "from the posting", or "from your notes". Unknown refs are dropped. */
export function letterSourceChips(
  refs: readonly string[],
  snapshot: LibrarySnapshot,
): LetterSourceChip[] {
  const entries = new Map<string, SnapshotEntry>();
  const bullets = new Map<string, { entry: SnapshotEntry; text: string }>();
  const skills = new Map<string, string>();

  for (const entry of snapshot.entries) {
    entries.set(entry.ref, entry);
    for (const bullet of entry.bullets) {
      bullets.set(bullet.ref, { entry, text: bullet.text });
    }
  }
  for (const skill of snapshot.skills) {
    skills.set(skill.ref, skill.name);
  }

  const chips: LetterSourceChip[] = [];
  const seen = new Set<string>();
  for (const ref of refs) {
    if (seen.has(ref)) continue;
    seen.add(ref);
    const chip = chipFor(ref, entries, bullets, skills);
    if (chip) chips.push(chip);
  }
  return chips;
}

function chipFor(
  ref: string,
  entries: Map<string, SnapshotEntry>,
  bullets: Map<string, { entry: SnapshotEntry; text: string }>,
  skills: Map<string, string>,
): LetterSourceChip | null {
  if (ref === POSTING_REF) {
    return { ref, kind: "posting", title: copy.fromPosting, text: copy.fromPosting };
  }
  if (ref === WHY_REF) {
    return { ref, kind: "why", title: copy.fromNotes, text: copy.fromNotes };
  }

  const bullet = bullets.get(ref);
  if (bullet) {
    const title = bullet.entry.title.trim() || copy.untitledSource;
    return { ref, kind: "library", title, text: bullet.text };
  }

  const entry = entries.get(ref);
  if (entry) {
    const title = entry.title.trim() || copy.untitledSource;
    const parts = [entry.organization, entry.location].filter(
      (part): part is string => Boolean(part && part.trim()),
    );
    return {
      ref,
      kind: "library",
      title,
      text: parts.length > 0 ? `${title} · ${parts.join(" · ")}` : title,
    };
  }

  const skill = skills.get(ref);
  if (skill) return { ref, kind: "library", title: skill, text: skill };

  return null;
}
