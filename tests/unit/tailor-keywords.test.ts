import { describe, expect, it } from "vitest";

import { keywordCoverage } from "@/features/tailor/keywords";

import {
  contentBullet,
  librarySnapshot,
  resumeContent,
} from "./tailor-fixture";

function coverage(keywords: string[], content = sample()) {
  return keywordCoverage(content, librarySnapshot(), keywords);
}

function sample() {
  return resumeContent({
    summary: { text: "Analyst who ships React services.", included: true },
    entries: [
      {
        ref: "E1",
        kind: "EXPERIENCE",
        included: true,
        bullets: [
          contentBullet({
            id: "b1",
            text: "Built C++ and C# tools, plus ASP.NET apps.",
          }),
          contentBullet({
            id: "b2",
            text: "Left this off.",
            included: false,
          }),
        ],
      },
      {
        ref: "E2",
        kind: "PROJECT",
        included: false,
        bullets: [
          contentBullet({ id: "b3", text: "Secret Booking work in JavaScript." }),
        ],
      },
    ],
    skills: [
      { category: "Languages", names: ["Python", "SQL"] },
      { category: null, names: ["IBM Cognos"] },
    ],
  });
}

describe("keywordCoverage", () => {
  it("matches a whole word or phrase and keeps the keyword's spelling", () => {
    const result = coverage(["react", "Machine  Learning", "PYTHON"]);

    expect(result.covered).toEqual(["react", "PYTHON"]);
    expect(result.missing).toEqual(["Machine  Learning"]);
    expect(result.pct).toBe(67);
  });

  it("does not let Java match JavaScript, or C# match C++", () => {
    const result = coverage(["Java", "JavaScript", "C#", "C++", ".NET"]);

    expect(result.covered).toEqual(["C#", "C++"]);
    expect(result.missing).toEqual(["Java", "JavaScript", ".NET"]);
  });

  it("matches .NET and a phrase when they stand alone", () => {
    const content = sample();
    const bullet = content.entries[0]?.bullets[0];
    if (!bullet) throw new Error("missing bullet");
    bullet.text = "Used .NET daily for machine learning work.";

    const result = coverage([".NET", "machine learning", "ASP.NET"], content);

    expect(result.covered).toEqual([".NET", "machine learning"]);
    expect(result.missing).toEqual(["ASP.NET"]);
  });

  it("ignores excluded entries, excluded bullets, and contact details", () => {
    const result = coverage([
      "Booking",
      "Left",
      "Ottawa",
      "morgan@example.com",
      "Junior Program Officer",
      "Python",
    ]);

    expect(result.covered).toEqual(["Junior Program Officer", "Python"]);
    expect(result.missing).toEqual([
      "Booking",
      "Left",
      "Ottawa",
      "morgan@example.com",
    ]);
  });

  it("skips the summary when it is switched off", () => {
    const content = sample();
    content.summary.included = false;

    const result = coverage(["React", "Python"], content);

    expect(result.covered).toEqual(["Python"]);
    expect(result.missing).toEqual(["React"]);
  });

  it("counts a keyword beside punctuation", () => {
    const content = sample();
    content.summary.text = "React, SQL.";

    expect(coverage(["React", "SQL"], content).covered).toEqual(["React", "SQL"]);
  });

  it("returns zero coverage when there are no keywords", () => {
    expect(coverage([])).toEqual({ covered: [], missing: [], pct: 0 });
  });

  it("treats a blank keyword as missing", () => {
    const result = coverage(["", "   ", "Python"]);

    expect(result.covered).toEqual(["Python"]);
    expect(result.missing).toEqual(["", "   "]);
    expect(result.pct).toBe(33);
  });

  it("reports 100 when every keyword is covered", () => {
    expect(coverage(["Python", "SQL", "IBM Cognos"]).pct).toBe(100);
  });
});
