import { describe, expect, it } from "vitest";

import type { LibrarySnapshot } from "@/features/library/schemas";
import type { JobAnalysis } from "@/features/jobs/schemas";
import { composeResume } from "@/features/tailor/compose";
import { dominates } from "@/features/tailor/overlap";
import type { ValidatedTailorOutput } from "@/features/tailor/schemas";

const VAGUE_DASH = "Made dashboards for operations.";
const SPECIFIC_DASH =
  "Created three dashboard views so operations staff could monitor maintenance and prioritize follow-up.";
const VAGUE_SCRIPT = "Made scripts to save time on data tasks.";
const SPECIFIC_SCRIPT =
  "Developed validation scripts in Python that cut a weekly check from six hours to two.";
const VAGUE_ASSET = "Helped keep the asset records updated.";
const SPECIFIC_ASSET = "Maintained 2400 asset records in the geodatabase from field notes and drawings.";
const TICKETS = "Closed 40 tickets for the front desk.";
const LEDGER = "Reconciled the monthly ledger in Excel for the finance team.";

const TERMS = ["dashboards", "python", "records", "scripts", "maintenance"];

describe("evidence preference", () => {
  it("prefers a more specific claim and does not prefer a number by itself", () => {
    expect(dominates(SPECIFIC_DASH, VAGUE_DASH, TERMS)).toBe(true);
    expect(dominates(VAGUE_DASH, SPECIFIC_DASH, TERMS)).toBe(false);
    expect(dominates(SPECIFIC_SCRIPT, VAGUE_SCRIPT, TERMS)).toBe(true);
    expect(dominates(SPECIFIC_ASSET, VAGUE_ASSET, TERMS)).toBe(true);
    expect(dominates(TICKETS, LEDGER, ["excel", "finance", "ledger"])).toBe(false);
    expect(dominates("Updated 15 dashboards.", SPECIFIC_DASH, TERMS)).toBe(false);
    expect(
      dominates(
        SPECIFIC_SCRIPT,
        "Made Python scripts to save time on routine data tasks.",
        TERMS,
      ),
    ).toBe(true);
    expect(
      dominates(
        "Worked with engineering teams to define layer requirements and trained 12 field staff.",
        "Worked with engineers and other teams.",
        ["staff", "requirements"],
      ),
    ).toBe(true);
  });

  it("keeps the specific library lines and leaves the vague ones off the resume", () => {
    const snapshot = snapshotWithBoth();
    const before = snapshot.entries[0]?.bullets.map((bullet) => bullet.text);
    const output: ValidatedTailorOutput = {
      summary: "Analyst who maintains operational records.",
      entries: [
        {
          ref: "E1",
          bullets: [
            { sourceRefs: ["E1.B1"], text: VAGUE_DASH, reverted: false },
            {
              sourceRefs: ["E1.B3"],
              text: "Made Python scripts to save time on routine data tasks.",
              reverted: false,
            },
            { sourceRefs: ["E1.B5"], text: VAGUE_ASSET, reverted: false },
            { sourceRefs: ["E1.B7"], text: TICKETS, reverted: false },
          ],
        },
      ],
      skills: [],
      requirementMatches: [],
    };
    const composition = composeResume({
      output,
      snapshot,
      analysis: analysis(),
      length: 1,
    });
    const text = composition.output.entries
      .flatMap((entry) => entry.bullets.map((bullet) => bullet.text))
      .join("\n");
    expect(text).toContain(SPECIFIC_DASH);
    expect(text).toContain(SPECIFIC_SCRIPT);
    expect(text).toContain(SPECIFIC_ASSET);
    expect(text).toContain(TICKETS);
    expect(text).not.toContain(VAGUE_DASH);
    expect(text).not.toContain(VAGUE_SCRIPT);
    expect(text).not.toContain("routine data tasks");
    expect(text).not.toContain(VAGUE_ASSET);
    expect(snapshot.entries[0]?.bullets.map((bullet) => bullet.text)).toEqual(before);
  });

  it("replaces a thin source when the draft adds a requirement word the source never stated", () => {
    const richer = "Developed validation scripts that cut a weekly check from six hours to two.";
    const snapshot = snapshotWithBoth();
    const entry = snapshot.entries[0];
    if (!entry) throw new Error("missing entry");
    entry.bullets = [
      { ref: "E1.B3", id: "b3", text: VAGUE_SCRIPT },
      { ref: "E1.B4", id: "b4", text: richer },
    ];
    const output: ValidatedTailorOutput = {
      summary: "Analyst who writes scripts.",
      entries: [
        {
          ref: "E1",
          bullets: [
            {
              sourceRefs: ["E1.B3"],
              text: "Made Python scripts to save time on routine data tasks.",
              reverted: false,
            },
          ],
        },
      ],
      skills: [],
      requirementMatches: [],
    };
    const composition = composeResume({
      output,
      snapshot,
      analysis: analysis(),
      length: 1,
    });
    const text = composition.output.entries
      .flatMap((item) => item.bullets.map((bullet) => bullet.text))
      .join("\n");
    expect(text).toContain(richer);
    expect(text).not.toContain("routine data tasks");
  });

  it("unpacks a combined thin line when one source has a more specific claim", () => {
    const maps = "Responsible for updating maps and making sure information is right.";
    const snapshot = snapshotWithBoth();
    const entry = snapshot.entries[0];
    if (!entry) throw new Error("missing entry");
    entry.bullets = [
      ...entry.bullets,
      { ref: "E1.B8", id: "b8", text: maps },
    ];
    const output: ValidatedTailorOutput = {
      summary: "Analyst who maintains operational records.",
      entries: [
        {
          ref: "E1",
          bullets: [
            {
              sourceRefs: ["E1.B3", "E1.B8"],
              text: "Made scripts to save time and responsible for updating maps and making sure information is right.",
              reverted: false,
            },
          ],
        },
      ],
      skills: [],
      requirementMatches: [],
    };
    const composition = composeResume({
      output,
      snapshot,
      analysis: analysis(),
      length: 1,
    });
    const text = composition.output.entries
      .flatMap((item) => item.bullets.map((bullet) => bullet.text))
      .join("\n");
    expect(text).toContain(SPECIFIC_SCRIPT);
    expect(text).toContain(maps);
    expect(text).not.toContain("Made scripts to save time and responsible");
  });
});

function analysis(): JobAnalysis {
  return {
    title: "Operations analyst",
    company: "Northwind",
    location: null,
    seniority: "mid",
    workMode: "UNKNOWN",
    employmentType: null,
    salary: null,
    referenceNumber: null,
    summary: "Maintain operational records and the tools the team uses.",
    requirements: [
      { id: "r1", text: "Python scripts", kind: "skill", importance: "must" },
      { id: "r2", text: "Operational dashboards", kind: "experience", importance: "must" },
    ],
    keywords: TERMS,
  };
}

function snapshotWithBoth(): LibrarySnapshot {
  return {
    takenAt: "2026-11-11T00:00:00.000Z",
    profile: {
      fullName: "Avery Example",
      headline: null,
      email: "avery@example.com",
      phone: null,
      location: "Ottawa, ON",
      links: [],
      summary: null,
    },
    entries: [
      {
        ref: "E1",
        id: "entry-1",
        kind: "EXPERIENCE",
        title: "Analyst",
        organization: "Maple Team",
        location: null,
        startDate: "2023-09",
        endDate: null,
        isCurrent: true,
        url: null,
        bullets: [
          { ref: "E1.B1", id: "b1", text: VAGUE_DASH },
          { ref: "E1.B2", id: "b2", text: SPECIFIC_DASH },
          { ref: "E1.B3", id: "b3", text: VAGUE_SCRIPT },
          { ref: "E1.B4", id: "b4", text: SPECIFIC_SCRIPT },
          { ref: "E1.B5", id: "b5", text: VAGUE_ASSET },
          { ref: "E1.B6", id: "b6", text: SPECIFIC_ASSET },
          { ref: "E1.B7", id: "b7", text: TICKETS },
        ],
      },
    ],
    skills: [{ ref: "S1", id: "s1", name: "Python", category: "Languages" }],
  };
}
