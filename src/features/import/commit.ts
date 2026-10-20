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

export type ImportExisting = {
  /** Highest sortOrder in each section, or -1 when that section is empty. */
  maxSortByKind: Record<EntryKind, number>;
  skillNameKeys: readonly string[];
  skillCategories: readonly (string | null)[];
  maxSkillSort: number;
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

export type ImportPlan = {
  replace: boolean;
  profile: UpdateProfileData | null;
  entries: PlannedEntry[];
  skills: PlannedSkill[];
  skippedSkills: number;
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
  if (
    input.profile === null &&
    input.entries.length === 0 &&
    input.skills.length === 0
  ) {
    return { ok: false, reason: "empty" };
  }

  const nextSort = replace ? emptySortByKind() : { ...input.existing.maxSortByKind };
  const entries: PlannedEntry[] = input.entries.map((entry) => {
    const sortOrder = nextSort[entry.kind] + 1;
    nextSort[entry.kind] = sortOrder;
    return {
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
    };
  });

  const seen = new Set<string>(replace ? [] : input.existing.skillNameKeys);
  const categories: (string | null)[] = replace
    ? []
    : [...input.existing.skillCategories];
  let skillSort = replace ? -1 : input.existing.maxSkillSort;
  const skills: PlannedSkill[] = [];
  let skippedSkills = 0;
  for (const skill of input.skills) {
    const nameKey = skillNameKey(skill.name);
    if (seen.has(nameKey)) {
      skippedSkills += 1;
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

  return {
    ok: true,
    plan: {
      replace,
      profile: input.profile,
      entries,
      skills,
      skippedSkills,
    },
  };
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
