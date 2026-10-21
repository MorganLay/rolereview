import { describe, expect, it } from "vitest";

import { ENTRY_KINDS } from "@/features/library/schemas";
import { RESUME_LIMITS } from "@/features/tailor/schemas";
import { assembleResumeContent } from "@/features/tailor/assemble";
import { validateTailorOutput } from "@/features/tailor/validate";

import {
  jobAnalysis,
  librarySnapshot,
  tailorOutput,
} from "./tailor-fixture";

function ids() {
  let next = 1;
  return () => `id-${next++}`;
}

describe("assembleResumeContent", () => {
  it("orders kinds, keeps the model order inside a kind, and switches off what was left out", () => {
    const snapshot = librarySnapshot();
    const validated = validateTailorOutput(
      tailorOutput(),
      snapshot,
      jobAnalysis(),
    ).output;
    const experience = validated.entries[0];
    const education = validated.entries.find((entry) => entry.ref === "E3");
    if (!experience || !education) throw new Error("missing entry");
    experience.bullets = [
      {
        sourceRefs: ["E1.B2"],
        text: "Cut prep time from 2 days to 3 hours.",
        reverted: true,
      },
    ];
    education.bullets = [];

    const content = assembleResumeContent(validated, snapshot, ids());

    expect(content.schemaVersion).toBe(1);
    expect(content.entries.map((entry) => [entry.ref, entry.included])).toEqual([
      ["E1", true],
      ["E4", false],
      ["E2", true],
      ["E3", true],
      ["E5", true],
    ]);
    expect(content.entries.map((entry) => entry.kind)).toEqual([
      "EXPERIENCE",
      "EXPERIENCE",
      "PROJECT",
      "EDUCATION",
      "EDUCATION",
    ]);
    expect(content.entries[0]?.bullets).toEqual([
      {
        id: "id-1",
        text: "Cut prep time from 2 days to 3 hours.",
        included: true,
        sourceRefs: ["E1.B2"],
        reverted: true,
        edited: false,
      },
      {
        id: "id-2",
        text: "Built and maintained 14 reports for a 20-person team.",
        included: false,
        sourceRefs: ["E1.B1"],
        reverted: false,
        edited: false,
      },
    ]);
    expect(content.entries[1]?.bullets[0]).toMatchObject({
      id: "id-3",
      included: false,
      sourceRefs: ["E4.B1"],
    });
    expect(content.entries[3]?.bullets[0]).toMatchObject({
      included: false,
      sourceRefs: ["E3.B1"],
    });
    expect("title" in (content.entries[0] ?? {})).toBe(false);
  });

  it("keeps the model's order when two entries of one kind are both selected", () => {
    const snapshot = librarySnapshot();
    const validated = validateTailorOutput(
      tailorOutput(),
      snapshot,
      jobAnalysis(),
    ).output;
    const intern = {
      ref: "E4",
      bullets: [
        {
          sourceRefs: ["E4.B1"],
          text: "Shelved returns each morning.",
          reverted: false,
        },
      ],
    };
    validated.entries = [intern, ...validated.entries];

    const content = assembleResumeContent(validated, snapshot, ids());
    const experience = content.entries
      .filter((entry) => entry.kind === "EXPERIENCE")
      .map((entry) => entry.ref);

    expect(experience).toEqual(["E4", "E1"]);
    expect(content.entries.find((entry) => entry.ref === "E4")?.included).toBe(
      true,
    );
  });

  it("does not copy a merged bullet's sources back as separate bullets", () => {
    const snapshot = librarySnapshot();
    const validated = validateTailorOutput(
      tailorOutput(),
      snapshot,
      jobAnalysis(),
    ).output;
    const experience = validated.entries[0];
    if (!experience) throw new Error("missing experience");
    experience.bullets = [
      {
        sourceRefs: ["E1.B1", "E1.B2"],
        text: "Maintained 14 reports and cut prep to 3 hours.",
        reverted: false,
      },
    ];

    const content = assembleResumeContent(validated, snapshot, ids());

    expect(content.entries[0]?.bullets).toHaveLength(1);
    expect(content.entries[0]?.bullets[0]?.sourceRefs).toEqual([
      "E1.B1",
      "E1.B2",
    ]);
  });

  it("puts every omitted kind after the selected entries, switched off", () => {
    const snapshot = librarySnapshot();
    snapshot.entries.push(
      {
        ref: "E6",
        id: "entry-6",
        kind: "CERTIFICATION",
        title: "AWS Cloud Practitioner",
        organization: "Amazon",
        location: null,
        startDate: "2024",
        endDate: null,
        isCurrent: false,
        url: null,
        bullets: [],
      },
      {
        ref: "E7",
        id: "entry-7",
        kind: "VOLUNTEER",
        title: "Tutor",
        organization: null,
        location: null,
        startDate: null,
        endDate: null,
        isCurrent: false,
        url: null,
        bullets: [],
      },
      {
        ref: "E8",
        id: "entry-8",
        kind: "OTHER",
        title: "Talk",
        organization: null,
        location: null,
        startDate: null,
        endDate: null,
        isCurrent: false,
        url: null,
        bullets: [],
      },
    );
    const validated = validateTailorOutput(
      tailorOutput(),
      snapshot,
      jobAnalysis(),
    ).output;

    const content = assembleResumeContent(validated, snapshot, ids());

    expect(content.entries.map((entry) => entry.kind)).toEqual([
      "EXPERIENCE",
      "EXPERIENCE",
      "PROJECT",
      "EDUCATION",
      "EDUCATION",
      "CERTIFICATION",
      "VOLUNTEER",
      "OTHER",
    ]);
    expect(ENTRY_KINDS).toEqual([
      "EXPERIENCE",
      "PROJECT",
      "EDUCATION",
      "CERTIFICATION",
      "VOLUNTEER",
      "OTHER",
    ]);
    expect(content.entries.filter((entry) => !entry.included).map((entry) => entry.ref)).toEqual([
      "E4",
      "E6",
      "E7",
      "E8",
    ]);
  });

  it("cuts the summary at 800 characters and a bullet at 400", () => {
    const snapshot = librarySnapshot();
    const longBullet = "c".repeat(RESUME_LIMITS.bullet + 50);
    const intern = snapshot.entries.find((entry) => entry.ref === "E4");
    const internBullet = intern?.bullets[0];
    if (!intern || !internBullet) throw new Error("missing intern");
    internBullet.text = longBullet;
    const validated = validateTailorOutput(
      tailorOutput(),
      snapshot,
      jobAnalysis(),
    ).output;
    validated.summary = "s".repeat(RESUME_LIMITS.summary + 25);
    const selected = validated.entries[0]?.bullets[0];
    if (!selected) throw new Error("missing selected");
    selected.text = longBullet;

    const content = assembleResumeContent(validated, snapshot, ids());
    const unselected = content.entries.find((entry) => entry.ref === "E4");

    expect(content.summary.text).toHaveLength(RESUME_LIMITS.summary);
    expect(content.summary.included).toBe(true);
    expect(content.entries[0]?.bullets[0]?.text).toHaveLength(RESUME_LIMITS.bullet);
    expect(unselected?.bullets[0]?.text).toHaveLength(RESUME_LIMITS.bullet);
  });

  it("resolves skill names and lists a repeated ref once", () => {
    const snapshot = librarySnapshot();
    const validated = validateTailorOutput(
      tailorOutput(),
      snapshot,
      jobAnalysis(),
    ).output;
    validated.skills = [
      { category: "Languages", refs: ["S1", "S1", "S99", "S2"] },
      { category: "Empty", refs: ["S99"] },
    ];

    const content = assembleResumeContent(validated, snapshot, ids());

    expect(content.skills).toEqual([
      { category: "Languages", names: ["Python", "SQL"] },
    ]);
  });

  it("uses nanoid when no id function is passed", () => {
    const snapshot = librarySnapshot();
    const validated = validateTailorOutput(
      tailorOutput(),
      snapshot,
      jobAnalysis(),
    ).output;

    const content = assembleResumeContent(validated, snapshot);
    const id = content.entries[0]?.bullets[0]?.id;

    expect(id).toEqual(expect.any(String));
    expect(id?.length).toBeGreaterThan(0);
  });

  it("skips a selected ref that is not on the snapshot", () => {
    const snapshot = librarySnapshot();
    const validated = validateTailorOutput(
      tailorOutput(),
      snapshot,
      jobAnalysis(),
    ).output;
    validated.entries.unshift({ ref: "E99", bullets: [] });

    const content = assembleResumeContent(validated, snapshot, ids());

    expect(content.entries.map((entry) => entry.ref)).not.toContain("E99");
  });
});
