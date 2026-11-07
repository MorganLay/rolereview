import { strings } from "@/copy/strings";
import { BULLET_LIMITS, ENTRY_KINDS } from "@/features/library/schemas";

type EntryKind = (typeof ENTRY_KINDS)[number];

const kinds = strings.library.entries.kinds;

export type ImportCount = {
  id: EntryKind | "skills";
  count: number;
  label: string;
};

type CountEntry = { included: boolean; kind: EntryKind };
type CountSkill = { included: boolean; name: string };

/** Sections that have something to save, in library order, then skills. */
export function firstImportCounts(draft: {
  entries: readonly CountEntry[];
  skills: readonly CountSkill[];
}): ImportCount[] {
  const counts: ImportCount[] = [];
  for (const kind of ENTRY_KINDS) {
    const count = draft.entries.filter(
      (entry) => entry.included && entry.kind === kind,
    ).length;
    if (count === 0) continue;
    counts.push({ id: kind, count, label: kinds[kind].title });
  }
  const skills = draft.skills.filter(
    (skill) => skill.included && skill.name.trim().length > 0,
  ).length;
  if (skills > 0) {
    counts.push({
      id: "skills",
      count: skills,
      label: strings.library.skills.title,
    });
  }
  return counts;
}

export type BlockingBullet = {
  entryIndex: number;
  bulletIndex: number;
  title: string;
  text: string;
};

type BlockingEntry = {
  included: boolean;
  title: string;
  bullets: readonly { included: boolean; text: string }[];
};

/**
 * Included bullets that `commitImport` would reject.
 * A blank bullet and a bullet over 400 characters both need a decision here.
 */
export function bulletsBlockingQuickSave(draft: {
  entries: readonly BlockingEntry[];
}): BlockingBullet[] {
  const blocking: BlockingBullet[] = [];
  draft.entries.forEach((entry, entryIndex) => {
    if (!entry.included) return;
    entry.bullets.forEach((bullet, bulletIndex) => {
      if (!bullet.included) return;
      const length = bullet.text.trim().length;
      if (length > 0 && length <= BULLET_LIMITS.text) return;
      blocking.push({
        entryIndex,
        bulletIndex,
        title: entry.title.trim(),
        text: bullet.text,
      });
    });
  });
  return blocking;
}
