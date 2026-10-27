import { describe, expect, it } from "vitest";

import { bulletElementId, entryElementId, skillElementId } from "@/features/tailor/evidence";
import {
  excludedGroupKey,
  excludedSkills,
  sectionJumpTargets,
  splitByIncluded,
} from "@/features/tailor/workspace-nav";

describe("excluded items", () => {
  it("counts excluded entries and keeps both orders", () => {
    const split = splitByIncluded([
      { id: "a", included: true },
      { id: "b", included: false },
      { id: "c", included: false },
      { id: "d", included: true },
    ]);

    expect(split.included.map((item) => item.id)).toEqual(["a", "d"]);
    expect(split.excluded.map((item) => item.id)).toEqual(["b", "c"]);
    expect(split.excluded).toHaveLength(2);
  });

  it("counts a skill as excluded only when its name is off the resume", () => {
    const library = [
      { id: "1", name: "React" },
      { id: "2", name: "React" },
      { id: "3", name: "SQL" },
      { id: "4", name: "Figma" },
    ];

    expect(excludedSkills(library, ["React", "SQL"]).map((skill) => skill.name)).toEqual([
      "Figma",
    ]);
    expect(excludedSkills(library, []).map((skill) => skill.id)).toEqual(["1", "3", "4"]);
    expect(excludedSkills(library, ["React", "SQL", "Figma"])).toHaveLength(0);
  });
});

describe("section jump targets", () => {
  it("includes summary, sections that have entries, and skills", () => {
    expect(
      sectionJumpTargets({
        summary: { id: "summary", label: "Summary" },
        sections: [
          { id: "experience", label: "Experience", count: 2 },
          { id: "projects", label: "Projects", count: 0 },
          { id: "education", label: "Education", count: 1 },
        ],
        skills: { id: "skills", label: "Skills" },
      }),
    ).toEqual([
      { id: "summary", label: "Summary" },
      { id: "experience", label: "Experience" },
      { id: "education", label: "Education" },
      { id: "skills", label: "Skills" },
    ]);
  });
});

describe("excluded group for evidence", () => {
  const entries = [
    {
      ref: "job-1",
      kind: "EXPERIENCE",
      included: false,
      bullets: [{ id: "bullet-1" }],
    },
    {
      ref: "job-2",
      kind: "EXPERIENCE",
      included: true,
      bullets: [{ id: "bullet-2" }],
    },
  ];
  const skills = [
    { ref: "skill-react", name: "React" },
    { ref: "skill-sql", name: "SQL" },
  ];

  it("opens the section that holds an excluded entry, bullet, or skill", () => {
    const input = {
      entries,
      skills,
      includedSkillNames: ["React"],
    };

    expect(excludedGroupKey({ ...input, elementId: entryElementId("job-1") })).toBe(
      "EXPERIENCE",
    );
    expect(excludedGroupKey({ ...input, elementId: bulletElementId("bullet-1") })).toBe(
      "EXPERIENCE",
    );
    expect(excludedGroupKey({ ...input, elementId: entryElementId("job-2") })).toBeNull();
    expect(excludedGroupKey({ ...input, elementId: skillElementId("skill-sql") })).toBe(
      "skills",
    );
    expect(excludedGroupKey({ ...input, elementId: skillElementId("skill-react") })).toBeNull();
  });
});
