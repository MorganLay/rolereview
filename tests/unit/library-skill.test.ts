import { describe, expect, it } from "vitest";

import { strings } from "@/copy/strings";
import {
  createSkillSchema,
  SKILL_LIMITS,
  skillNameSchema,
  updateSkillSchema,
} from "@/features/library/schemas";
import {
  applySkillAction,
  categorySuggestions,
  groupSkills,
  hasDuplicateSkill,
  moveSkillWithinCategory,
  resolveCategory,
  skillNameKey,
} from "@/features/library/skill-state";
import type { LibrarySkill } from "@/features/library/types";

const errors = strings.library.skills.errors;
const otherUserId = "00000000-0000-4000-8000-000000000099";

function skill(
  id: string,
  name: string,
  category: string | null,
  sortOrder: number,
): LibrarySkill {
  return { id, name, category, sortOrder };
}

describe("skillNameSchema", () => {
  it("trims and accepts 50 characters", () => {
    const name = "a".repeat(SKILL_LIMITS.name);
    expect(skillNameSchema.parse(`  ${name}  `)).toBe(name);
  });

  it("rejects empty and whitespace-only names", () => {
    for (const value of ["", "   ", "\n\t"]) {
      const parsed = skillNameSchema.safeParse(value);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0]?.message).toBe(errors.name);
      }
    }
  });

  it("rejects 51 characters", () => {
    const parsed = skillNameSchema.safeParse("a".repeat(SKILL_LIMITS.name + 1));
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe(errors.nameLength);
    }
  });

  it("keeps plus signs, slashes, and quotes", () => {
    expect(skillNameSchema.parse(`C++ / "SQL"`)).toBe(`C++ / "SQL"`);
  });
});

describe("skill action schemas", () => {
  it("trims the name, blanks the category, and strips a client-supplied userId", () => {
    const parsed = createSkillSchema.parse({
      name: "  React  ",
      category: "   ",
      userId: otherUserId,
    });
    expect(parsed).toEqual({ name: "React", category: null });
    expect("userId" in parsed).toBe(false);
  });

  it("rejects a category over 40 characters and a non-uuid id", () => {
    const created = createSkillSchema.safeParse({
      name: "React",
      category: "a".repeat(SKILL_LIMITS.category + 1),
    });
    expect(created.success).toBe(false);
    if (!created.success) {
      expect(created.error.issues[0]?.message).toBe(errors.categoryLength);
    }

    const updated = updateSkillSchema.safeParse({
      id: "not-an-id",
      name: "React",
      category: "",
    });
    expect(updated.success).toBe(false);
  });
});

describe("skillNameKey", () => {
  it.each([
    ["React", "react"],
    ["  SQL  ", "sql"],
    ["C++", "c++"],
    ["TypeScript", "typescript"],
  ])("maps %j to %j", (name, key) => {
    expect(skillNameKey(name)).toBe(key);
  });
});

describe("resolveCategory", () => {
  it.each([
    [null, [] as (string | null)[], null],
    ["   ", [], null],
    ["cloud", ["Cloud"], "Cloud"],
    ["  Languages  ", [null, "  ", "Languages"], "Languages"],
    ["Design", ["Tools"], "Design"],
    ["data", ["Data viz", "Data"], "Data"],
  ])("resolves %j against existing categories", (typed, existing, expected) => {
    expect(resolveCategory(typed, existing)).toBe(expected);
  });
});

describe("hasDuplicateSkill", () => {
  const skills = [
    { id: "a", name: "React" },
    { id: "b", name: "  SQL " },
  ];

  it("matches case and surrounding space, and ignores the skill being edited", () => {
    expect(hasDuplicateSkill(skills, "react")).toBe(true);
    expect(hasDuplicateSkill(skills, "sql")).toBe(true);
    expect(hasDuplicateSkill(skills, "react", "a")).toBe(false);
    expect(hasDuplicateSkill(skills, "Vue")).toBe(false);
    expect(hasDuplicateSkill(skills, "   ")).toBe(false);
  });
});

describe("groupSkills", () => {
  const skills = [
    skill("sql", "SQL", null, 0),
    skill("go", "Go", "Languages", 5),
    skill("react", "React", "Frameworks", 2),
    skill("vue", "Vue", "frameworks", 3),
    skill("excel", "Excel", "  ", 1),
  ];

  it("groups case-insensitively, orders by earliest skill, and puts no category last", () => {
    const groups = groupSkills(skills);
    expect(groups.map((group) => group.label)).toEqual([
      "Frameworks",
      "Languages",
      null,
    ]);
    expect(groups[0]?.skills.map((item) => item.name)).toEqual(["React", "Vue"]);
    expect(groups[2]?.skills.map((item) => item.name)).toEqual(["SQL", "Excel"]);
  });

  it("does not mutate the input list", () => {
    const snapshot = skills.map((item) => item.sortOrder);
    groupSkills(skills);
    expect(skills.map((item) => item.sortOrder)).toEqual(snapshot);
  });
});

describe("categorySuggestions", () => {
  it("lists the user's categories first, then starters, without case-insensitive repeats", () => {
    const skills = [
      skill("go", "Go", "Languages", 0),
      skill("figma", "Figma", "Design", 1),
      skill("talk", "Mentoring", "soft skills", 2),
    ];
    expect(categorySuggestions(skills)).toEqual([
      "Languages",
      "Design",
      "soft skills",
      "Frameworks",
      "Tools",
      "Cloud",
      "Data",
    ]);
  });

  it("returns only the starter list when the library has no skills", () => {
    expect(categorySuggestions([])).toEqual([
      ...strings.library.skills.suggestions,
    ]);
  });
});

describe("moveSkillWithinCategory", () => {
  const skills = [
    skill("react", "React", "Frameworks", 0),
    skill("vue", "Vue", "Frameworks", 1),
    skill("go", "Go", "Languages", 2),
  ];

  it("swaps within the category and leaves the other category out", () => {
    expect(moveSkillWithinCategory(skills, "vue", "up")).toEqual([
      { id: "vue", sortOrder: 0 },
      { id: "react", sortOrder: 1 },
    ]);
    expect(moveSkillWithinCategory(skills, "react", "up")).toBeNull();
    expect(moveSkillWithinCategory(skills, "go", "down")).toBeNull();
    expect(moveSkillWithinCategory(skills, "missing", "down")).toBeNull();
  });

  it("breaks a tie on sort order so the moved skill actually changes place", () => {
    const tied = [
      skill("b", "Vue", "Frameworks", 0),
      skill("a", "React", "Frameworks", 0),
    ];
    expect(moveSkillWithinCategory(tied, "b", "up")).toEqual([
      { id: "b", sortOrder: 0 },
      { id: "a", sortOrder: 1 },
    ]);
  });

  it("treats a blank category as the same group as null", () => {
    const uncategorized = [
      skill("sql", "SQL", null, 4),
      skill("excel", "Excel", "  ", 6),
    ];
    expect(moveSkillWithinCategory(uncategorized, "excel", "up")).toEqual([
      { id: "excel", sortOrder: 4 },
      { id: "sql", sortOrder: 5 },
    ]);
  });

  it("does not mutate the input list", () => {
    const snapshot = skills.map((item) => ({ ...item }));
    moveSkillWithinCategory(skills, "vue", "up");
    expect(skills).toEqual(snapshot);
  });
});

describe("applySkillAction", () => {
  const skills = [
    skill("react", "React", "Frameworks", 0),
    skill("vue", "Vue", "Frameworks", 1),
  ];

  it("updates, appends, and deletes without touching the other rows", () => {
    expect(
      applySkillAction(skills, {
        type: "update",
        id: "vue",
        name: "Vue.js",
        category: "Frameworks",
      }),
    ).toEqual([skills[0], skill("vue", "Vue.js", "Frameworks", 1)]);

    expect(
      applySkillAction(skills, {
        type: "create",
        tempId: "go",
        name: "Go",
        category: "Languages",
      }),
    ).toEqual([...skills, skill("go", "Go", "Languages", 2)]);

    expect(applySkillAction(skills, { type: "delete", id: "react" })).toEqual([skills[1]]);
  });

  it("reorders only the category that moved", () => {
    const withLanguage = [...skills, skill("go", "Go", "Languages", 2)];
    expect(
      applySkillAction(withLanguage, { type: "reorder", id: "vue", direction: "up" }),
    ).toEqual([
      skill("react", "React", "Frameworks", 1),
      skill("vue", "Vue", "Frameworks", 0),
      skill("go", "Go", "Languages", 2),
    ]);
  });
});
