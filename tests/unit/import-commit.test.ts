import { describe, expect, it } from "vitest";

import { strings } from "@/copy/strings";
import {
  emptySortByKind,
  planImportCommit,
  selectCommitItems,
  type CommitEntryInput,
  type ImportExisting,
} from "@/features/import/commit";
import { commitImportSchema, type CommitImportData } from "@/features/import/schemas";
import { zodFieldErrors } from "@/features/library/schemas";

const saved = strings.library.import.saved;
const bulletTooLong = strings.library.bullets.errors.textLength;
const dateOrder = strings.library.entries.errors.dateOrder;

function profile(
  partial: Partial<CommitImportData["profile"]> = {},
): CommitImportData["profile"] {
  return {
    included: true,
    fullName: "Ada Lovelace",
    headline: "Engineer",
    phone: "",
    location: "Toronto",
    summary: "",
    links: [],
    ...partial,
  };
}

function entry(
  partial: Partial<CommitImportData["entries"][number]> = {},
): CommitImportData["entries"][number] {
  return {
    included: true,
    kind: "EXPERIENCE",
    title: "Engineer",
    organization: "Acme",
    location: "",
    url: "",
    startDate: "2020-01",
    endDate: "",
    isCurrent: true,
    bullets: [{ included: true, text: "Shipped the billing export for 12 teams." }],
    ...partial,
  };
}

function skill(
  partial: Partial<CommitImportData["skills"][number]> = {},
): CommitImportData["skills"][number] {
  return { included: true, name: "TypeScript", category: "Languages", ...partial };
}

function payload(
  partial: Partial<CommitImportData> = {},
): CommitImportData {
  return {
    mode: "append",
    profile: profile(),
    entries: [entry()],
    skills: [skill()],
    ...partial,
  };
}

function existing(partial: Partial<ImportExisting> = {}): ImportExisting {
  return {
    maxSortByKind: emptySortByKind(),
    skillNameKeys: [],
    skillCategories: [],
    maxSkillSort: -1,
    ...partial,
  };
}

function parse(input: CommitImportData) {
  return commitImportSchema.safeParse(input);
}

describe("commitImportSchema", () => {
  it("rejects a checked bullet over 400 characters and keeps an unchecked one", () => {
    const long = "a".repeat(401);
    const rejected = parse(
      payload({
        entries: [entry({ bullets: [{ included: true, text: long }] })],
      }),
    );
    expect(rejected.success).toBe(false);
    if (!rejected.success) {
      expect(zodFieldErrors(rejected.error)["entries.0.bullets.0.text"]).toEqual([
        bulletTooLong,
      ]);
    }

    const kept = parse(
      payload({
        entries: [
          entry({
            included: false,
            title: "",
            bullets: [{ included: true, text: long }],
          }),
        ],
      }),
    );
    expect(kept.success).toBe(true);
  });

  it("rejects an end date before the start", () => {
    const parsed = parse(
      payload({
        entries: [
          entry({
            isCurrent: false,
            startDate: "2020-06",
            endDate: "2019",
          }),
        ],
      }),
    );
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(zodFieldErrors(parsed.error)["entries.0.endDate"]).toEqual([dateOrder]);
    }
  });

  it("does not accept an email field on the profile", () => {
    const parsed = parse({
      ...payload(),
      profile: { ...profile(), email: "other@example.com" } as CommitImportData["profile"],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect("email" in parsed.data.profile).toBe(false);
    }
  });
});

describe("selectCommitItems", () => {
  it("drops unchecked entries, bullets, and skills, and skips an unchecked profile", () => {
    const parsed = parse(
      payload({
        profile: profile({ included: false, fullName: "Should not save" }),
        entries: [
          entry({
            title: "Kept",
            bullets: [
              { included: true, text: "Kept bullet for the role." },
              { included: false, text: "Leave this one out of the library." },
            ],
          }),
          entry({
            included: false,
            title: "Dropped",
            kind: "PROJECT",
            bullets: [{ included: true, text: "This bullet goes with the dropped entry." }],
          }),
        ],
        skills: [
          skill({ name: "TypeScript" }),
          skill({ included: false, name: "Hidden", category: "" }),
        ],
      }),
    );
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const selected = selectCommitItems(parsed.data);
    expect(selected.ok).toBe(true);
    if (!selected.ok) return;
    expect(selected.profile).toBeNull();
    expect(selected.entries.map((item) => item.title)).toEqual(["Kept"]);
    expect(selected.entries[0]?.bullets.map((bullet) => bullet.text)).toEqual([
      "Kept bullet for the role.",
    ]);
    expect(selected.skills.map((item) => item.name)).toEqual(["TypeScript"]);
  });

  it("stores a current role with no end date", () => {
    const parsed = parse(
      payload({
        entries: [entry({ isCurrent: true, startDate: "2020-01", endDate: "2019-01" })],
      }),
    );
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const selected = selectCommitItems(parsed.data);
    expect(selected.ok).toBe(true);
    if (!selected.ok) return;
    expect(selected.entries[0]).toMatchObject({ isCurrent: true, endDate: null });
  });
});

describe("planImportCommit", () => {
  const kept: CommitEntryInput = {
    kind: "EXPERIENCE",
    title: "Engineer",
    organization: "Acme",
    location: null,
    startDate: "2020-01",
    endDate: null,
    isCurrent: true,
    url: null,
    bullets: [{ text: "First line." }, { text: "Second line." }],
  };

  it("refuses to plan a save when nothing is selected", () => {
    expect(
      planImportCommit({
        mode: "replace",
        profile: null,
        entries: [],
        skills: [],
        existing: existing({
          maxSortByKind: { ...emptySortByKind(), EXPERIENCE: 4 },
          skillNameKeys: ["react"],
          maxSkillSort: 2,
        }),
      }),
    ).toEqual({ ok: false, reason: "empty" });
  });

  it("appends after the existing section and skips a skill the library already has", () => {
    const plan = planImportCommit({
      mode: "append",
      profile: null,
      entries: [kept, { ...kept, kind: "PROJECT", title: "Side project", bullets: [] }],
      skills: [
        { name: "TypeScript", category: "languages" },
        { name: "typescript", category: "Tools" },
        { name: "Python", category: "languages" },
      ],
      existing: existing({
        maxSortByKind: { ...emptySortByKind(), EXPERIENCE: 4 },
        skillNameKeys: ["typescript"],
        skillCategories: ["Languages"],
        maxSkillSort: 3,
      }),
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.plan.replace).toBe(false);
    expect(plan.plan.entries.map((item) => [item.kind, item.sortOrder])).toEqual([
      ["EXPERIENCE", 5],
      ["PROJECT", 0],
    ]);
    expect(plan.plan.entries[0]?.bullets.map((bullet) => bullet.sortOrder)).toEqual([0, 1]);
    expect(plan.plan.skippedSkills).toBe(2);
    expect(plan.plan.skills).toEqual([
      { name: "Python", nameKey: "python", category: "Languages", sortOrder: 4 },
    ]);
  });

  it("replaces from the start and does not keep an existing skill name", () => {
    const plan = planImportCommit({
      mode: "replace",
      profile: null,
      entries: [kept],
      skills: [{ name: "TypeScript", category: "languages" }],
      existing: existing({
        maxSortByKind: { ...emptySortByKind(), EXPERIENCE: 9 },
        skillNameKeys: ["typescript"],
        skillCategories: ["Languages"],
        maxSkillSort: 8,
      }),
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.plan.replace).toBe(true);
    expect(plan.plan.entries[0]?.sortOrder).toBe(0);
    expect(plan.plan.skippedSkills).toBe(0);
    expect(plan.plan.skills).toEqual([
      { name: "TypeScript", nameKey: "typescript", category: "languages", sortOrder: 0 },
    ]);
  });

  it("adds new bullets to the same role instead of creating a second copy", () => {
    const vague = "Responsible for updating maps and making sure information is right.";
    const measured = "Maintained 18,400 water and stormwater asset features in ArcGIS Pro.";
    const plan = planImportCommit({
      mode: "append",
      profile: null,
      entries: [
        {
          ...kept,
          title: "GIS Analyst",
          organization: "Maplehaven Regional Services",
          startDate: "2023-09",
          bullets: [{ text: measured }, { text: vague }],
        },
        {
          ...kept,
          title: "GIS Technician",
          organization: "Cedar Ridge Environmental",
          startDate: "2021-06",
          endDate: "2023-08",
          isCurrent: false,
          bullets: [{ text: "Collected more than 600 GPS observations." }],
        },
      ],
      skills: [
        { name: "ArcGIS Pro", category: "Tools" },
        { name: "ArcGIS Dashboards", category: "Tools" },
      ],
      existing: existing({
        maxSortByKind: { ...emptySortByKind(), EXPERIENCE: 1, EDUCATION: 0 },
        skillNameKeys: ["arcgis pro"],
        skillCategories: ["Tools"],
        maxSkillSort: 0,
        entries: [
          {
            id: "role-analyst",
            kind: "EXPERIENCE",
            title: "GIS Analyst",
            organization: "Maplehaven Regional Services",
            startDate: "2023-09",
            endDate: null,
            bullets: [
              { text: vague, sortOrder: 0 },
              { text: "Used ArcGIS Pro, SQL and Python for GIS data tasks.", sortOrder: 1 },
            ],
          },
          {
            id: "role-tech",
            kind: "EXPERIENCE",
            title: "GIS Technician",
            organization: "Cedar Ridge Environmental",
            startDate: "2021-06",
            endDate: "2023-08",
            bullets: [{ text: "Worked with GPS equipment and field data.", sortOrder: 0 }],
          },
        ],
      }),
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.plan.entries).toEqual([]);
    expect(plan.plan.mergedRoles).toBe(2);
    expect(plan.plan.bulletUpdates).toEqual([
      { entryId: "role-analyst", bullets: [{ text: measured, sortOrder: 2 }] },
      {
        entryId: "role-tech",
        bullets: [{ text: "Collected more than 600 GPS observations.", sortOrder: 1 }],
      },
    ]);
    expect(plan.plan.skippedSkills).toBe(1);
    expect(plan.plan.skills.map((skill) => skill.name)).toEqual(["ArcGIS Dashboards"]);
  });

  it("does not merge a role at a different employer", () => {
    const plan = planImportCommit({
      mode: "append",
      profile: null,
      entries: [{ ...kept, organization: "Other Co", bullets: [{ text: "A new line here." }] }],
      skills: [],
      existing: existing({
        entries: [
          {
            id: "role-1",
            kind: "EXPERIENCE",
            title: "Engineer",
            organization: "Acme",
            startDate: "2020-01",
            endDate: null,
            bullets: [{ text: "First line.", sortOrder: 0 }],
          },
        ],
      }),
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.plan.entries).toHaveLength(1);
    expect(plan.plan.mergedRoles).toBe(0);
  });

  it("puts a stated level on a skill that was saved as the bare tool", () => {
    const plan = planImportCommit({
      mode: "append",
      profile: null,
      entries: [],
      skills: [{ name: "basic FME", category: "Tools" }],
      existing: existing({
        skillNameKeys: ["fme"],
        skillCategories: ["Tools"],
        maxSkillSort: 0,
        skills: [{ id: "skill-fme", name: "FME", nameKey: "fme" }],
      }),
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.plan.skills).toEqual([]);
    expect(plan.plan.skillUpdates).toEqual([
      { id: "skill-fme", name: "basic FME", nameKey: "basic fme" },
    ]);
  });
});

describe("import save summary", () => {
  it("names only what was saved", () => {
    expect(
      saved({
        entries: 4,
        bullets: 11,
        skills: 6,
        skippedSkills: 2,
        mergedRoles: 0,
        profile: true,
      }),
    ).toBe(
      "Updated your profile. Saved 4 entries, 11 bullets, and 6 skills. 2 skills were already in your library.",
    );
    expect(
      saved({
        entries: 1,
        bullets: 1,
        skills: 0,
        skippedSkills: 1,
        mergedRoles: 0,
        profile: false,
      }),
    ).toBe("Saved 1 entry and 1 bullet. 1 skill was already in your library.");
    expect(
      saved({
        entries: 0,
        bullets: 3,
        skills: 0,
        skippedSkills: 0,
        mergedRoles: 2,
        profile: false,
      }),
    ).toBe(
      "Saved 3 bullets. Added new bullets to 2 roles you already have.",
    );
    expect(
      saved({
        entries: 0,
        bullets: 0,
        skills: 0,
        skippedSkills: 0,
        mergedRoles: 0,
        profile: true,
      }),
    ).toBe("Updated your profile.");
  });
});
