import type { EntryKind } from "@/generated/prisma/client";
import type { FieldErrors } from "@/lib/result";

import {
  bulletTextSchema,
  createEntrySchema,
  createSkillSchema,
  updateProfileSchema,
  zodFieldErrors,
  type UpdateProfileData,
} from "../library/schemas";
import { parseSkillQualifier } from "../library/skill-qualifier";
import { resolveCategory, skillNameKey } from "../library/skill-state";
import type { CommitImportData } from "./schemas";

/**
 * Which checked rows to write, and where they sit in each section.
 * Nothing here touches the database. docs/02-USER-FLOWS.md → /library/import.
 */

export type CommitEntryInput = {
  kind: EntryKind;
  title: string;
  organization: string | null;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  url: string | null;
  bullets: { text: string }[];
};

export type CommitSkillInput = {
  name: string;
  category: string | null;
};

/** Enough of a saved record to recognise it on the import review. */
export type ImportRoleHint = {
  kind: EntryKind;
  title: string;
  organization: string | null;
  startDate: string | null;
  endDate: string | null;
};

export type ExistingImportEntry = {
  id: string;
  kind: EntryKind;
  title: string;
  organization: string | null;
  startDate: string | null;
  endDate: string | null;
  bullets: readonly { text: string; sortOrder: number }[];
};

export type ImportExisting = {
  /** Highest sortOrder in each section, or -1 when that section is empty. */
  maxSortByKind: Record<EntryKind, number>;
  skillNameKeys: readonly string[];
  skillCategories: readonly (string | null)[];
  maxSkillSort: number;
  /** Saved skills, so a later import can put a stated level back on the name. */
  skills?: readonly { id: string; name: string; nameKey: string }[];
  /** Roles already saved. Append merges a matching record instead of copying it. */
  entries?: readonly ExistingImportEntry[];
};

export type PlannedEntry = Omit<CommitEntryInput, "bullets"> & {
  sortOrder: number;
  bullets: { text: string; sortOrder: number }[];
};

export type PlannedSkill = {
  name: string;
  nameKey: string;
  category: string | null;
  sortOrder: number;
};

export type PlannedSkillUpdate = {
  id: string;
  name: string;
  nameKey: string;
};

export type PlannedBulletUpdate = {
  entryId: string;
  bullets: { text: string; sortOrder: number }[];
};

export type ImportPlan = {
  replace: boolean;
  profile: UpdateProfileData | null;
  entries: PlannedEntry[];
  /** New bullets on a role the library already has. Existing bullet text is kept. */
  bulletUpdates: PlannedBulletUpdate[];
  skills: PlannedSkill[];
  /** A saved skill whose name dropped a level the new resume still states. */
  skillUpdates: PlannedSkillUpdate[];
  skippedSkills: number;
  mergedRoles: number;
};

export function emptySortByKind(): Record<EntryKind, number> {
  return {
    EXPERIENCE: -1,
    PROJECT: -1,
    EDUCATION: -1,
    CERTIFICATION: -1,
    VOLUNTEER: -1,
    OTHER: -1,
  };
}

/**
 * Keep checked rows only, and apply the library transforms (trim, blank → null,
 * current roles store no end date). Unchecked entries drop their bullets.
 */
export function selectCommitItems(
  input: CommitImportData,
):
  | {
      ok: true;
      profile: UpdateProfileData | null;
      entries: CommitEntryInput[];
      skills: CommitSkillInput[];
    }
  | { ok: false; fields: FieldErrors } {
  let profile: UpdateProfileData | null = null;
  if (input.profile.included) {
    const parsed = updateProfileSchema.safeParse(input.profile);
    if (!parsed.success) {
      return { ok: false, fields: prefixFields(zodFieldErrors(parsed.error), "profile") };
    }
    profile = parsed.data;
  }

  const entries: CommitEntryInput[] = [];
  for (const [index, entry] of input.entries.entries()) {
    if (!entry.included) continue;
    const parsed = createEntrySchema.safeParse(entry);
    if (!parsed.success) {
      return {
        ok: false,
        fields: prefixFields(zodFieldErrors(parsed.error), `entries.${index}`),
      };
    }
    const bullets: { text: string }[] = [];
    for (const [bulletIndex, bullet] of entry.bullets.entries()) {
      if (!bullet.included) continue;
      const text = bulletTextSchema.safeParse(bullet.text);
      if (!text.success) {
        return {
          ok: false,
          fields: prefixFields(
            zodFieldErrors(text.error),
            `entries.${index}.bullets.${bulletIndex}.text`,
          ),
        };
      }
      bullets.push({ text: text.data });
    }
    entries.push({ ...parsed.data, bullets });
  }

  const skills: CommitSkillInput[] = [];
  for (const [index, skill] of input.skills.entries()) {
    if (!skill.included) continue;
    const parsed = createSkillSchema.safeParse(skill);
    if (!parsed.success) {
      return {
        ok: false,
        fields: prefixFields(zodFieldErrors(parsed.error), `skills.${index}`),
      };
    }
    skills.push(parsed.data);
  }

  return { ok: true, profile, entries, skills };
}

export function planImportCommit(input: {
  mode: "append" | "replace";
  profile: UpdateProfileData | null;
  entries: readonly CommitEntryInput[];
  skills: readonly CommitSkillInput[];
  existing: ImportExisting;
}): { ok: true; plan: ImportPlan } | { ok: false; reason: "empty" } {
  const replace = input.mode === "replace";
  const nextSort = replace ? emptySortByKind() : { ...input.existing.maxSortByKind };
  const library = replace ? [] : [...(input.existing.entries ?? [])];
  const updates = new Map<string, PlannedBulletUpdate>();
  const knownBullets = new Map<string, Set<string>>();
  for (const saved of library) {
    knownBullets.set(
      saved.id,
      new Set(saved.bullets.map((bullet) => bulletKey(bullet.text))),
    );
  }
  const entries: PlannedEntry[] = [];
  for (const entry of input.entries) {
    const saved = library
      .filter((item) => sameImportedRecord(item, entry))
      .sort((left, right) => right.bullets.length - left.bullets.length)[0];
    if (saved) {
      const seen = knownBullets.get(saved.id) ?? new Set<string>();
      const next =
        saved.bullets.reduce((max, bullet) => Math.max(max, bullet.sortOrder), -1) +
        1 +
        (updates.get(saved.id)?.bullets.length ?? 0);
      const added: { text: string; sortOrder: number }[] = [];
      for (const bullet of entry.bullets) {
        const key = bulletKey(bullet.text);
        if (seen.has(key)) continue;
        seen.add(key);
        added.push({ text: bullet.text, sortOrder: next + added.length });
      }
      knownBullets.set(saved.id, seen);
      if (added.length > 0) {
        const current = updates.get(saved.id);
        updates.set(saved.id, {
          entryId: saved.id,
          bullets: [...(current?.bullets ?? []), ...added],
        });
      }
      continue;
    }

    const pending = entries.find((item) => sameImportedRecord(item, entry));
    if (pending) {
      const seen = new Set(pending.bullets.map((bullet) => bulletKey(bullet.text)));
      for (const bullet of entry.bullets) {
        const key = bulletKey(bullet.text);
        if (seen.has(key)) continue;
        seen.add(key);
        pending.bullets.push({ text: bullet.text, sortOrder: pending.bullets.length });
      }
      continue;
    }

    const sortOrder = nextSort[entry.kind] + 1;
    nextSort[entry.kind] = sortOrder;
    entries.push({
      kind: entry.kind,
      title: entry.title,
      organization: entry.organization,
      location: entry.location,
      startDate: entry.startDate,
      endDate: entry.endDate,
      isCurrent: entry.isCurrent,
      url: entry.url,
      sortOrder,
      bullets: entry.bullets.map((bullet, index) => ({
        text: bullet.text,
        sortOrder: index,
      })),
    });
  }
  const bulletUpdates = [...updates.values()];

  const seen = new Set<string>(replace ? [] : input.existing.skillNameKeys);
  const categories: (string | null)[] = replace
    ? []
    : [...input.existing.skillCategories];
  let skillSort = replace ? -1 : input.existing.maxSkillSort;
  const skills: PlannedSkill[] = [];
  const skillUpdates: PlannedSkillUpdate[] = [];
  let skippedSkills = 0;
  const savedSkills = replace ? [] : (input.existing.skills ?? []);
  for (const skill of input.skills) {
    const parsed = parseSkillQualifier(skill.name);
    const nameKey = skillNameKey(skill.name);
    if (seen.has(nameKey)) {
      skippedSkills += 1;
      continue;
    }
    const bareKey = skillNameKey(parsed.tool);
    if (parsed.qualifier) {
      const bare = savedSkills.find(
        (item) => item.nameKey === bareKey && !parseSkillQualifier(item.name).qualifier,
      );
      const qualifiedSaved = savedSkills.some((item) => item.nameKey === nameKey);
      if (bare && !qualifiedSaved && !replace) {
        skillUpdates.push({ id: bare.id, name: skill.name, nameKey });
        seen.add(bareKey);
        seen.add(nameKey);
        continue;
      }
    } else if (
      savedSkills.some((item) => {
        const held = parseSkillQualifier(item.name);
        return held.qualifier !== null && skillNameKey(held.tool) === nameKey;
      }) ||
      skillUpdates.some((item) => skillNameKey(parseSkillQualifier(item.name).tool) === nameKey)
    ) {
      skippedSkills += 1;
      seen.add(nameKey);
      continue;
    }
    seen.add(nameKey);
    const category = resolveCategory(skill.category, categories);
    categories.push(category);
    skillSort += 1;
    skills.push({
      name: skill.name,
      nameKey,
      category,
      sortOrder: skillSort,
    });
  }

  if (
    input.profile === null &&
    entries.length === 0 &&
    skills.length === 0 &&
    bulletUpdates.length === 0 &&
    skillUpdates.length === 0
  ) {
    return { ok: false, reason: "empty" };
  }

  return {
    ok: true,
    plan: {
      replace,
      profile: input.profile,
      entries,
      bulletUpdates,
      skills,
      skillUpdates,
      skippedSkills,
      mergedRoles: bulletUpdates.length,
    },
  };
}

/**
 * Same kind, title, and organization. A start month matches exactly; a year
 * matches a year-only date. An experience row with no organization also needs
 * a shared year, so two untitled roles are not treated as one.
 */
export function sameImportedRecord(
  left: {
    kind: string;
    title: string;
    organization: string | null;
    startDate: string | null;
    endDate: string | null;
  },
  right: {
    kind: string;
    title: string;
    organization: string | null;
    startDate: string | null;
    endDate: string | null;
  },
): boolean {
  if (left.kind !== right.kind) return false;
  const title = normalizeRecord(left.title);
  if (!title || title !== normalizeRecord(right.title)) return false;
  const orgLeft = normalizeRecord(left.organization);
  const orgRight = normalizeRecord(right.organization);
  if (orgLeft !== orgRight) return false;
  if (!orgLeft && left.kind === "EXPERIENCE") return sharedYear(left, right);
  return datesCompatible(left, right);
}

function sharedYear(
  left: { startDate: string | null; endDate: string | null },
  right: { startDate: string | null; endDate: string | null },
): boolean {
  const a = yearOf(left.startDate) ?? yearOf(left.endDate);
  const b = yearOf(right.startDate) ?? yearOf(right.endDate);
  return a !== null && a === b;
}

function datesCompatible(
  left: { startDate: string | null; endDate: string | null },
  right: { startDate: string | null; endDate: string | null },
): boolean {
  const a = (left.startDate || left.endDate || "").trim();
  const b = (right.startDate || right.endDate || "").trim();
  if (!a || !b) return true;
  if (a.length >= 7 && b.length >= 7) return a.slice(0, 7) === b.slice(0, 7);
  return a.slice(0, 4) === b.slice(0, 4);
}

function yearOf(value: string | null): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed.length >= 4 ? trimmed.slice(0, 4) : null;
}

function normalizeRecord(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function bulletKey(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function prefixFields(fields: FieldErrors, prefix: string): FieldErrors {
  const next: FieldErrors = {};
  for (const [key, messages] of Object.entries(fields)) {
    if (!messages) continue;
    const path = key === "form" || key.length === 0 ? prefix : `${prefix}.${key}`;
    next[path] = messages;
  }
  return next;
}
