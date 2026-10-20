import { strings } from "@/copy/strings";

import type { LibrarySkill } from "./types";

export type SkillOptimisticAction =
  | { type: "update"; id: string; name: string; category: string | null }
  | { type: "delete"; id: string }
  | { type: "create"; tempId: string; name: string; category: string | null }
  | { type: "reorder"; id: string; direction: "up" | "down" };

export type SkillGroup = {
  key: string;
  label: string | null;
  skills: LibrarySkill[];
};

/** Case-insensitive key stored on `Skill.nameKey`. */
export function skillNameKey(name: string): string {
  return name.trim().toLowerCase();
}

/** Empty, whitespace, and null share one group. */
export function categoryKey(category: string | null | undefined): string {
  return (category ?? "").trim().toLowerCase();
}

/**
 * Blank becomes null. A case-insensitive match keeps the existing spelling
 * (the first non-blank match in `existing`).
 */
export function resolveCategory(
  typed: string | null,
  existing: readonly (string | null)[],
): string | null {
  const trimmed = (typed ?? "").trim();
  if (trimmed.length === 0) return null;
  const key = trimmed.toLowerCase();
  for (const category of existing) {
    const value = category?.trim() ?? "";
    if (value.length > 0 && value.toLowerCase() === key) return value;
  }
  return trimmed;
}

/** True when another skill already uses this name, ignoring case and surrounding space. */
export function hasDuplicateSkill(
  skills: readonly { id: string; name: string }[],
  name: string,
  exceptId?: string,
): boolean {
  const key = skillNameKey(name);
  if (key.length === 0) return false;
  return skills.some(
    (skill) => skill.id !== exceptId && skillNameKey(skill.name) === key,
  );
}

function compareSkills(a: LibrarySkill, b: LibrarySkill): number {
  return a.sortOrder - b.sortOrder || a.id.localeCompare(b.id);
}

/** Groups by category. Named groups follow the earliest skill; no category is last. */
export function groupSkills(skills: readonly LibrarySkill[]): SkillGroup[] {
  const byKey = new Map<string, LibrarySkill[]>();
  for (const skill of skills) {
    const key = categoryKey(skill.category);
    const group = byKey.get(key);
    if (group) group.push(skill);
    else byKey.set(key, [skill]);
  }

  const groups: SkillGroup[] = [];
  for (const [key, members] of byKey) {
    const ordered = members.slice().sort(compareSkills);
    const named = ordered.find((skill) => categoryKey(skill.category) !== "");
    groups.push({
      key,
      label: named?.category?.trim() || null,
      skills: ordered,
    });
  }

  groups.sort((a, b) => {
    if ((a.label === null) !== (b.label === null)) return a.label === null ? 1 : -1;
    const aMin = a.skills[0]?.sortOrder ?? 0;
    const bMin = b.skills[0]?.sortOrder ?? 0;
    if (aMin !== bMin) return aMin - bMin;
    return (a.label ?? "").localeCompare(b.label ?? "");
  });

  return groups;
}

/** This user's categories first, then the starter list, without case-insensitive repeats. */
export function categorySuggestions(skills: readonly LibrarySkill[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  function add(name: string) {
    const trimmed = name.trim();
    const key = categoryKey(trimmed);
    if (key.length === 0 || seen.has(key)) return;
    seen.add(key);
    result.push(trimmed);
  }

  for (const group of groupSkills(skills)) {
    if (group.label) add(group.label);
  }
  for (const suggestion of strings.library.skills.suggestions) {
    add(suggestion);
  }
  return result;
}

/**
 * Move one skill up or down inside its category.
 * Rewrites that category's sort orders from its current minimum so other
 * categories stay put. Returns null when the skill is missing or already
 * at that end.
 */
export function moveSkillWithinCategory(
  skills: readonly LibrarySkill[],
  id: string,
  direction: "up" | "down",
): { id: string; sortOrder: number }[] | null {
  const target = skills.find((skill) => skill.id === id);
  if (!target) return null;

  const key = categoryKey(target.category);
  const group = skills
    .filter((skill) => categoryKey(skill.category) === key)
    .slice()
    .sort(compareSkills);
  const index = group.findIndex((skill) => skill.id === id);
  const nextIndex = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || nextIndex < 0 || nextIndex >= group.length) return null;

  const reordered = group.slice();
  const current = reordered[index];
  const neighbour = reordered[nextIndex];
  if (!current || !neighbour) return null;
  reordered[index] = neighbour;
  reordered[nextIndex] = current;

  const base = Math.min(...group.map((skill) => skill.sortOrder));
  return reordered.map((skill, offset) => ({
    id: skill.id,
    sortOrder: base + offset,
  }));
}

/** Next skill list while a save is in flight. The server list is unchanged until it succeeds. */
export function applySkillAction(
  current: readonly LibrarySkill[],
  action: SkillOptimisticAction,
): LibrarySkill[] {
  switch (action.type) {
    case "update":
      return current.map((skill) =>
        skill.id === action.id
          ? { ...skill, name: action.name, category: action.category }
          : skill,
      );
    case "delete":
      return current.filter((skill) => skill.id !== action.id);
    case "create": {
      const max = current.reduce(
        (highest, skill) => Math.max(highest, skill.sortOrder),
        -1,
      );
      return [
        ...current,
        {
          id: action.tempId,
          name: action.name,
          category: action.category,
          sortOrder: max + 1,
        },
      ];
    }
    case "reorder": {
      const next = moveSkillWithinCategory(current, action.id, action.direction);
      if (!next) return current.slice();
      const orders = new Map(next.map((row) => [row.id, row.sortOrder]));
      return current.map((skill) => {
        const sortOrder = orders.get(skill.id);
        return sortOrder === undefined ? skill : { ...skill, sortOrder };
      });
    }
  }
}
