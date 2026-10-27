import {
  bulletElementId,
  entryElementId,
  skillElementId,
} from "@/features/tailor/evidence";

export const SUMMARY_SECTION_ID = "resume-summary";

export function entrySectionId(kind: string): string {
  return `resume-section-${kind}`;
}

/** Included entries stay in place. Excluded entries are the collapsed group. */
export function splitByIncluded<T extends { included: boolean }>(
  items: readonly T[],
): { included: T[]; excluded: T[] } {
  const included: T[] = [];
  const excluded: T[] = [];
  for (const item of items) {
    if (item.included) included.push(item);
    else excluded.push(item);
  }
  return { included, excluded };
}

/**
 * A library skill is excluded when its name is not on the resume.
 * The first copy of a repeated name is the one that can be included.
 */
export function excludedSkills<T extends { name: string }>(
  library: readonly T[],
  includedNames: readonly string[],
): T[] {
  const used = new Set(includedNames);
  const seen = new Set<string>();
  const excluded: T[] = [];
  for (const skill of library) {
    if (used.has(skill.name) || seen.has(skill.name)) continue;
    seen.add(skill.name);
    excluded.push(skill);
  }
  return excluded;
}

export function sectionJumpTargets(input: {
  summary: { id: string; label: string };
  sections: readonly { id: string; label: string; count: number }[];
  skills: { id: string; label: string };
}): { id: string; label: string }[] {
  return [
    input.summary,
    ...input.sections
      .filter((section) => section.count > 0)
      .map(({ id, label }) => ({ id, label })),
    input.skills,
  ];
}

type NavEntry = {
  ref: string;
  kind: string;
  included: boolean;
  bullets: readonly { id: string }[];
};

/** Section to open so an evidence link can reach an excluded entry or skill. */
export function excludedGroupKey(input: {
  elementId: string;
  entries: readonly NavEntry[];
  skills: readonly { ref: string; name: string }[];
  includedSkillNames: readonly string[];
}): string | null {
  const includedNames = new Set(input.includedSkillNames);
  for (const skill of input.skills) {
    if (input.elementId !== skillElementId(skill.ref)) continue;
    return includedNames.has(skill.name) ? null : "skills";
  }

  for (const entry of input.entries) {
    const hit =
      input.elementId === entryElementId(entry.ref) ||
      entry.bullets.some((bullet) => input.elementId === bulletElementId(bullet.id));
    if (!hit) continue;
    return entry.included ? null : entry.kind;
  }
  return null;
}
