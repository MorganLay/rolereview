import { describe, expect, it } from "vitest";

import { postProcessImport } from "@/features/import/extract";
import { guidanceQuestion } from "@/features/library/guidance";
import {
  parseSkillQualifier,
  restoreSkillQualifiers,
  visibleFileText,
} from "@/features/library/skill-qualifier";
import { raisedProficiency } from "@/features/tailor/grounding";

describe("skill levels", () => {
  it("keeps a stated level and does not invent one", () => {
    expect(parseSkillQualifier("basic FME")).toMatchObject({ tool: "FME", qualifier: "basic" });
    expect(parseSkillQualifier("ArcGIS Pro (coursework)")).toMatchObject({
      tool: "ArcGIS Pro",
      qualifier: "coursework",
    });
    expect(parseSkillQualifier("Python").qualifier).toBeNull();

    const restored = restoreSkillQualifiers(
      [{ name: "FME" }, { name: "Python" }, { name: "ArcGIS Pro" }, { name: "SQL" }],
      "Skills: basic FME, basic Python, ArcGIS Pro (coursework), SQL",
    );
    expect(restored.map((skill) => skill.name)).toEqual([
      "basic FME",
      "basic Python",
      "ArcGIS Pro (coursework)",
      "SQL",
    ]);
  });

  it("reads a level from the file text and from a warning the model wrote", () => {
    const bytes = new TextEncoder().encode("Skills basic FME and ArcGIS Pro (coursework)");
    expect(visibleFileText(bytes)).toContain("basic FME");
    const extracted = postProcessImport(
      {
        profile: {
          fullName: "Avery Example",
          headline: null,
          email: null,
          phone: null,
          location: null,
          links: [],
          summary: null,
        },
        entries: [],
        skills: [
          { name: "FME", category: "Tools" },
          { name: "Python", category: "Languages" },
          { name: "ArcGIS Pro", category: "Tools" },
        ],
        warnings: ["Recorded basic Python as Python."],
      },
      visibleFileText(bytes),
    );
    expect(extracted.skills.map((skill) => skill.name)).toEqual([
      "basic FME",
      "basic Python",
      "ArcGIS Pro (coursework)",
    ]);
  });

  it("does not treat a basic skill as professional experience", () => {
    expect(raisedProficiency("Professional FME development.", ["basic FME"])).not.toBeNull();
    expect(
      raisedProficiency("Professional ArcGIS Pro experience.", ["ArcGIS Pro (coursework)"]),
    ).not.toBeNull();
    expect(raisedProficiency("Familiar with FME.", ["basic FME"])).toBeNull();
  });
});

describe("weak bullet questions", () => {
  it("asks for a tool, a deliverable, and a result without inventing them", () => {
    const question = guidanceQuestion(
      "Responsible for updating maps and making sure information is right.",
    );
    expect(question).toMatch(/which tool or method did you use/);
    expect(question).toMatch(/what did you deliver/);
    expect(question).toMatch(/count, size, or time/);
    expect(question).toMatch(/Only add facts you already have/);
    expect(question).not.toMatch(/\d/);
    expect(question).not.toContain("ArcGIS");
  });
});
