import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { bulletOpportunity } from "@/features/library/opportunity";
import { bulletRole, bulletStrength } from "@/features/library/strength";
import type { LibrarySnapshot } from "@/features/library/schemas";
import type { JobAnalysis } from "@/features/jobs/schemas";
import { composeResume } from "@/features/tailor/compose";
import { unsupportedClaim } from "@/features/tailor/grounding";
import type { ValidatedTailorOutput } from "@/features/tailor/schemas";
import { validateTailorOutput } from "@/features/tailor/validate";

import { jobAnalysis, librarySnapshot, tailorOutput } from "./tailor-fixture";
import {
  checkForbidden,
  checkNoCounts,
  postingForModel,
} from "../../scripts/gis-score";

const SPARSE = "Responsible for updating maps and making sure information is right.";
const NAMED = "Used ArcGIS Pro, SQL and Python for GIS data tasks.";
const MEASURED = "Maintained 18,400 water and stormwater asset features in ArcGIS Pro.";

describe("GIS bullet guidance", () => {
  it("asks for a number the person has and does not invent one", () => {
    const strength = bulletStrength(SPARSE, ["ArcGIS Pro"]);
    const opportunity = bulletOpportunity(strength, bulletRole("EXPERIENCE", SPARSE), SPARSE);
    const advice = [...strength.fixes, opportunity.diagnosis ?? "", strength.example ?? ""].join(
      " ",
    );
    expect(strength.passed).not.toContain("metric");
    expect(advice).toMatch(/If you have a number|a number you have/);
    expect(advice).toMatch(/which tool or method did you use/);
    expect(advice).toMatch(/Only add facts you already have/);
    expect(advice).not.toMatch(/\d/);
    expect(advice).not.toContain("18,400");
  });

  it("treats a named GIS tool as specific", () => {
    const strength = bulletStrength(NAMED, []);
    expect(strength.passed).toContain("specific");
    expect(strength.fixes.join(" ")).not.toMatch(/name a tool|Name a tool|tool or method/i);
  });
});

describe("GIS fabrication guard", () => {
  it("drops a metric and an ArcGIS Server claim that the source does not state", () => {
    const snapshot = librarySnapshot();
    const source = snapshot.entries[0]?.bullets[0];
    if (!source) throw new Error("missing bullet");
    source.text = NAMED;
    const output = tailorOutput();
    const bullet = output.entries[0]?.bullets[0];
    if (!bullet) throw new Error("missing rewrite");
    bullet.sourceRefs = [source.ref];
    bullet.text = "Administered ArcGIS Server and maintained 18,400 features.";

    const result = validateTailorOutput(output, snapshot, jobAnalysis());
    expect(result.output.entries[0]?.bullets[0]?.text).toBe(NAMED);
    expect(result.reverts).toBeGreaterThan(0);
  });

  it("does not call JavaScript met from ArcGIS and Python evidence", () => {
    const snapshot = librarySnapshot();
    const source = snapshot.entries[1]?.bullets[0];
    if (!source) throw new Error("missing project bullet");
    source.text = "Developed ArcPy validation scripts for attribute domains.";
    const output = tailorOutput();
    output.requirementMatches[0] = {
      requirementId: "r1",
      verdict: "met",
      evidenceRefs: [source.ref],
      note: "Python scripting covers the web stack.",
    };
    const result = validateTailorOutput(output, snapshot, jobAnalysis([
      {
        id: "r1",
        text: "JavaScript and TypeScript web development",
        kind: "experience",
        importance: "must",
      },
      {
        id: "r2",
        text: "AWS certification",
        kind: "certification",
        importance: "nice",
      },
    ]));
    expect(result.issues).toContainEqual({ code: "G15", ref: "r1" });
    expect(result.output.requirementMatches[0]?.verdict).toBe("partial");
  });

  it("treats ArcGIS Server as unsupported when the source only says ArcGIS Pro", () => {
    expect(unsupportedClaim("Administered ArcGIS Server.", [NAMED])).toBeTruthy();
    expect(unsupportedClaim(MEASURED, [MEASURED])).toBeNull();
  });
});

describe("early-career GIS ranking", () => {
  it("keeps the capstone and internship ahead of customer service", () => {
    const snapshot = morganSnapshot();
    const analysis = gisAnalysis();
    const output: ValidatedTailorOutput = {
      summary: "Recent geography graduate interested in GIS and mapping.",
      entries: [
        {
          ref: "E_retail",
          bullets: [
            {
              sourceRefs: ["E_retail.B1"],
              text: "Helped people with questions and worked with the team.",
              reverted: false,
            },
          ],
        },
        {
          ref: "E_edu",
          bullets: [
            {
              sourceRefs: ["E_edu.B1"],
              text: "B.A. in Geography with a minor in GIS.",
              reverted: false,
            },
          ],
        },
      ],
      skills: [],
      requirementMatches: [
        {
          requirementId: "r1",
          verdict: "partial",
          evidenceRefs: ["E_heat.B1"],
          note: "The capstone uses ArcGIS Pro.",
        },
      ],
    };
    const composition = composeResume({
      output,
      snapshot,
      analysis,
      length: 1,
    });
    const refs = composition.output.entries.map((entry) => entry.ref);
    expect(refs).toContain("E_heat");
    expect(refs).toContain("E_intern");
    expect(refs).not.toContain("E_retail");
    const heat = refs.indexOf("E_heat");
    const course = refs.indexOf("E_story");
    if (course !== -1) expect(heat).toBeLessThan(course);
  });
});

describe("requirement gap labels", () => {
  it("stores a requirement id as the requirement text", () => {
    const output = tailorOutput();
    output.plan = {
      narrative: "A grounded story.",
      priorities: ["Python"],
      gaps: ["r1", "r99", "SQL is not shown as production work."],
      hiringFor: "The work in the posting.",
      positioning: "The strongest defensible evidence.",
      evidence: [],
      closeCall: false,
    };
    const result = validateTailorOutput(output, librarySnapshot(), jobAnalysis());
    expect(result.output.plan?.gaps).toEqual(["Python", "SQL is not shown as production work."]);
    expect(result.output.plan?.gaps.join(" ")).not.toMatch(/\br\d+\b/);
  });
});

describe("posting answer key", () => {
  it("removes the expectation block and keeps the vacancy text", () => {
    const posting = postingForModel(
      "Title: GIS Developer\n\nBuild maps with JavaScript.\n\nTEST EXPECTATIONS\nMUST NOT present JavaScript as a fact.\n",
    );
    expect(posting).toContain("Build maps with JavaScript.");
    expect(posting).not.toContain("TEST EXPECTATIONS");
    expect(posting).not.toContain("MUST NOT");
  });

  it("flags an invented count and an unsupported tool on resume text", () => {
    expect(checkNoCounts("Maintained water layers in ArcGIS Pro.", ["18400", "420"]).pass).toBe(
      true,
    );
    expect(checkNoCounts("Maintained 18,400 features.", ["18400"]).pass).toBe(false);
    expect(checkForbidden("Maintained layers in ArcGIS Pro.", ["javascript", "postgis"]).pass).toBe(
      true,
    );
    expect(checkForbidden("Built JavaScript web maps.", ["javascript"]).pass).toBe(false);
    expect(
      checkForbidden("Maintained an enterprise geodatabase.", ["arcgis enterprise"]).pass,
    ).toBe(true);
  });
});

describe("ground truth stays out of model inputs", () => {
  it("does not place the oracle in prompt or feature source", () => {
    const root = process.cwd();
    const files = walk(path.join(root, "src")).filter((file) => /\.(ts|tsx)$/.test(file));
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toContain("fixture_ground_truth");
      expect(text, file).not.toContain("verified_benchmark_facts");
      expect(text, file).not.toContain("18,400");
    }
  });
});

function walk(dir: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "generated") continue;
      found.push(...walk(full));
    } else {
      found.push(full);
    }
  }
  return found;
}

function morganSnapshot(): LibrarySnapshot {
  return {
    takenAt: "2026-11-11T00:00:00.000Z",
    profile: {
      fullName: "Morgan Quinn",
      headline: null,
      email: "morgan.quinn@example.com",
      phone: null,
      location: "London, ON",
      links: [],
      summary: "Recent geography graduate interested in GIS, environmental data, and mapping.",
    },
    entries: [
      {
        ref: "E_intern",
        id: "intern",
        kind: "EXPERIENCE",
        title: "GIS Intern",
        organization: "Clearbrook Conservation Office",
        location: "London, ON",
        startDate: "2024-05",
        endDate: "2024-08",
        isCurrent: false,
        url: null,
        bullets: [
          {
            ref: "E_intern.B1",
            id: "ib1",
            text: "Updated some trails and park data on maps.",
          },
          {
            ref: "E_intern.B2",
            id: "ib2",
            text: "Went into the field to collect GPS points with staff.",
          },
        ],
      },
      {
        ref: "E_retail",
        id: "retail",
        kind: "EXPERIENCE",
        title: "Customer Service Associate",
        organization: "Westbridge Market",
        location: "London, ON",
        startDate: "2022-06",
        endDate: "2024-04",
        isCurrent: false,
        url: null,
        bullets: [
          {
            ref: "E_retail.B1",
            id: "rb1",
            text: "Helped people with questions and worked with the team.",
          },
          {
            ref: "E_retail.B2",
            id: "rb2",
            text: "Handled busy shifts and kept information accurate.",
          },
        ],
      },
      {
        ref: "E_heat",
        id: "heat",
        kind: "PROJECT",
        title: "Urban Heat Mapping",
        organization: null,
        location: null,
        startDate: "2025",
        endDate: "2025",
        isCurrent: false,
        url: null,
        bullets: [
          {
            ref: "E_heat.B1",
            id: "hb1",
            text: "Used ArcGIS Pro and QGIS to compare tree cover and surface temperature across city neighbourhoods.",
          },
        ],
      },
      {
        ref: "E_story",
        id: "story",
        kind: "PROJECT",
        title: "Community Trail StoryMap — Coursework",
        organization: null,
        location: null,
        startDate: "2024",
        endDate: "2024",
        isCurrent: false,
        url: null,
        bullets: [
          {
            ref: "E_story.B1",
            id: "sb1",
            text: "Created a public-facing ArcGIS StoryMap explaining local trail access using open GIS data.",
          },
        ],
      },
      {
        ref: "E_edu",
        id: "edu",
        kind: "EDUCATION",
        title: "B.A., Geography; minor in GIS",
        organization: "Eastern Valley University",
        location: null,
        startDate: null,
        endDate: "2025",
        isCurrent: false,
        url: null,
        bullets: [
          {
            ref: "E_edu.B1",
            id: "eb1",
            text: "B.A. in Geography with a minor in GIS.",
          },
        ],
      },
    ],
    skills: [
      { ref: "S1", id: "s1", name: "ArcGIS Pro", category: "Tools" },
      { ref: "S2", id: "s2", name: "QGIS", category: "Tools" },
      { ref: "S3", id: "s3", name: "GPS", category: "Tools" },
    ],
  };
}

function gisAnalysis(): JobAnalysis {
  return {
    title: "GIS Analyst, Municipal Assets",
    company: "Northshore Public Works",
    location: "Ontario",
    seniority: "entry",
    workMode: "HYBRID",
    employmentType: "FULL_TIME",
    salary: null,
    referenceNumber: null,
    summary: "Maintain spatial data and maps for municipal assets.",
    requirements: [
      {
        id: "r1",
        text: "Applied ArcGIS Pro experience",
        kind: "experience",
        importance: "must",
      },
    ],
    keywords: ["GIS", "ArcGIS Pro", "QGIS", "GPS", "maps", "Python"],
  };
}
