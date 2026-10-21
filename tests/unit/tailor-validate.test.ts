import { describe, expect, it } from "vitest";

import { RESUME_LIMITS } from "@/features/tailor/schemas";
import type { TailorOutput } from "@/features/tailor/schemas";
import { validateTailorOutput } from "@/features/tailor/validate";
import type { GuardIssue } from "@/features/tailor/validate";

import {
  baseRequirements,
  jobAnalysis,
  librarySnapshot,
  tailorOutput,
} from "./tailor-fixture";

function guard(
  output: TailorOutput,
  snapshot = librarySnapshot(),
  requirements = baseRequirements,
) {
  return validateTailorOutput(output, snapshot, jobAnalysis(requirements));
}

function withBulletText(ref: string, text: string) {
  const snapshot = librarySnapshot();
  for (const entry of snapshot.entries) {
    for (const bullet of entry.bullets) {
      if (bullet.ref === ref) bullet.text = text;
    }
  }
  return snapshot;
}

describe("validateTailorOutput", () => {
  it("accepts a grounded resume and marks every bullet as not reverted", () => {
    const result = guard(tailorOutput());

    expect(result.reverts).toBe(0);
    expect(result.issues).toEqual([]);
    expect(result.output.summary).toBe("Analyst with reporting experience.");
    expect(result.output.entries.map((entry) => entry.ref)).toEqual([
      "E1",
      "E2",
      "E3",
      "E5",
    ]);
    expect(result.output.entries[0]?.bullets[0]).toEqual({
      sourceRefs: ["E1.B1"],
      text: "Maintained 14 reports for a 20-person team.",
      reverted: false,
    });
    expect(result.output.skills).toEqual([
      { category: "Languages", refs: ["S1", "S2"] },
      { category: null, refs: ["S3"] },
    ]);
  });

  it("does not change the output it was given", () => {
    const output = tailorOutput();
    const before = structuredClone(output);

    guard(output);

    expect(output).toEqual(before);
  });

  it("passes a summary through unchanged when it is longer than the resume cap", () => {
    const output = tailorOutput();
    output.summary = "s".repeat(RESUME_LIMITS.summary + 1);

    const result = guard(output);

    expect(result.output.summary).toHaveLength(RESUME_LIMITS.summary + 1);
    expect(result.issues).toEqual([]);
  });

  it("G1 drops an entry ref that is not on the snapshot", () => {
    const output = tailorOutput();
    output.entries.unshift({
      ref: "E99",
      bullets: [{ sourceRefs: ["E99.B1"], text: "Invented a whole employer." }],
    });

    const result = guard(output);

    expect(result.output.entries.map((entry) => entry.ref)).not.toContain("E99");
    expect(result.issues[0]).toEqual({ code: "G1", ref: "E99" });
    expect(JSON.stringify(result.issues)).not.toContain("Invented");
  });

  it("G2 keeps the first entry when the same ref appears twice", () => {
    const output = tailorOutput();
    output.entries.splice(1, 0, {
      ref: "E1",
      bullets: [{ sourceRefs: ["E1.B1"], text: "A second copy with 8 new claims." }],
    });

    const result = guard(output);
    const copies = result.output.entries.filter((entry) => entry.ref === "E1");

    expect(copies).toHaveLength(1);
    expect(copies[0]?.bullets.map((bullet) => bullet.text)).not.toContain(
      "A second copy with 8 new claims.",
    );
    expect(result.issues).toContainEqual({ code: "G2", ref: "E1" });
  });

  it("G3 removes a source ref that belongs to another entry and keeps the bullet", () => {
    const output = tailorOutput();
    const bullet = output.entries[0]?.bullets[0];
    if (!bullet) throw new Error("missing bullet");
    bullet.sourceRefs = ["E1.B1", "E2.B1"];

    const result = guard(output);

    expect(result.output.entries[0]?.bullets[0]?.sourceRefs).toEqual(["E1.B1"]);
    expect(result.issues).toContainEqual({ code: "G3", ref: "E2.B1" });
  });

  it("G3 drops a bullet when every source ref is missing", () => {
    const output = tailorOutput();
    const entry = output.entries[0];
    if (!entry) throw new Error("missing entry");
    entry.bullets = [
      { sourceRefs: ["E1.B9", "S1"], text: "Cited a skill ref as a bullet." },
    ];

    const result = guard(output);

    expect(result.output.entries[0]?.bullets).toEqual([]);
    expect(result.issues).toEqual([
      { code: "G3", ref: "E1.B9" },
      { code: "G3", ref: "S1" },
    ]);
  });

  it("G3 keeps a repeated source ref once", () => {
    const output = tailorOutput();
    const bullet = output.entries[0]?.bullets[0];
    if (!bullet) throw new Error("missing bullet");
    bullet.sourceRefs = ["E1.B1", "E1.B1"];

    const result = guard(output);

    expect(result.output.entries[0]?.bullets[0]?.sourceRefs).toEqual(["E1.B1"]);
    expect(result.issues).toEqual([]);
  });

  it("G4 reverts a number that is not in the cited sources", () => {
    const output = tailorOutput();
    const bullet = output.entries[0]?.bullets[0];
    if (!bullet) throw new Error("missing bullet");
    bullet.text = "Maintained 99 reports for a 20-person team.";

    const result = guard(output);

    expect(result.reverts).toBe(1);
    expect(result.output.entries[0]?.bullets[0]).toEqual({
      sourceRefs: ["E1.B1"],
      text: "Built and maintained 14 reports for a 20-person team.",
      reverted: true,
    });
    expect(result.issues).toContainEqual({ code: "G4", ref: "E1.B1" });
  });

  it("G4 allows a number that appears on a later cited source", () => {
    const output = tailorOutput();
    const entry = output.entries[0];
    if (!entry) throw new Error("missing entry");
    entry.bullets[0] = {
      sourceRefs: ["E1.B1", "E1.B2"],
      text: "Maintained 14 reports and cut prep to 3 hours.",
    };

    const result = guard(output);

    expect(result.reverts).toBe(0);
    expect(result.output.entries[0]?.bullets[0]?.reverted).toBe(false);
  });

  it("G4 restores the first source, not the second", () => {
    const output = tailorOutput();
    const entry = output.entries[0];
    if (!entry) throw new Error("missing entry");
    entry.bullets[0] = {
      sourceRefs: ["E1.B2", "E1.B1"],
      text: "Shipped 99 features.",
    };

    const result = guard(output);

    expect(result.output.entries[0]?.bullets[0]?.text).toBe(
      "Cut prep time from 2 days to 3 hours.",
    );
    expect(result.issues).toContainEqual({ code: "G4", ref: "E1.B2" });
  });

  it("G4 treats 1,000 and 1 000 as the same number as 1000", () => {
    const snapshot = withBulletText("E1.B1", "Supported 1000 cases and $1200.50 in fees.");
    const output = tailorOutput();
    const bullet = output.entries[0]?.bullets[0];
    if (!bullet) throw new Error("missing bullet");
    bullet.text = "Supported 1,000 cases and $1,200.50 in fees.";

    expect(guard(output, snapshot).reverts).toBe(0);

    bullet.text = "Supported 1 000 cases and $ 1200.50 in fees.";
    expect(guard(output, snapshot).reverts).toBe(0);
  });

  it("G4 reverts $50 when the source only says 50", () => {
    const snapshot = withBulletText("E1.B1", "Saved 50 dollars a week.");
    const output = tailorOutput();
    const bullet = output.entries[0]?.bullets[0];
    if (!bullet) throw new Error("missing bullet");
    bullet.text = "Saved $50 a week.";

    const result = guard(output, snapshot);

    expect(result.reverts).toBe(1);
    expect(result.output.entries[0]?.bullets[0]?.text).toBe(
      "Saved 50 dollars a week.",
    );
  });

  it("G4 treats 20% and 20 as different tokens", () => {
    const snapshot = withBulletText("E1.B1", "Raised accuracy by 20 points.");
    const output = tailorOutput();
    const bullet = output.entries[0]?.bullets[0];
    if (!bullet) throw new Error("missing bullet");
    bullet.text = "Raised accuracy by 20%.";

    expect(guard(output, snapshot).reverts).toBe(1);

    const percentSource = withBulletText("E1.B1", "Raised accuracy by 20%.");
    bullet.text = "Raised accuracy by 20 points.";
    expect(guard(output, percentSource).reverts).toBe(1);

    bullet.text = "Raised accuracy by 20 %.";
    expect(guard(output, percentSource).reverts).toBe(0);
  });

  it("G4 ignores a plus sign after a number and keeps matching decimals distinct", () => {
    const snapshot = withBulletText("E1.B1", "Led 3 analysts and cut latency by 2.5 seconds.");
    const output = tailorOutput();
    const bullet = output.entries[0]?.bullets[0];
    if (!bullet) throw new Error("missing bullet");
    bullet.text = "Led 3+ analysts and cut latency by 2.5 seconds.";
    expect(guard(output, snapshot).reverts).toBe(0);

    bullet.text = "Led 3 analysts and cut latency by 2.50 seconds.";
    expect(guard(output, snapshot).reverts).toBe(1);
  });

  it("G4 counts one revert when the bullet is also longer than 400 characters", () => {
    const output = tailorOutput();
    const bullet = output.entries[0]?.bullets[0];
    if (!bullet) throw new Error("missing bullet");
    bullet.text = `${"word ".repeat(80)} 99`;

    const result = guard(output);
    const codes = result.issues
      .filter((issue) => issue.ref === "E1.B1")
      .map((issue) => issue.code);

    expect(bullet.text.length).toBeGreaterThan(RESUME_LIMITS.bullet);
    expect(result.reverts).toBe(1);
    expect(codes).toEqual(["G4"]);
  });

  it("G5 reverts empty and whitespace-only text", () => {
    const output = tailorOutput();
    const bullets = output.entries[0]?.bullets;
    if (!bullets || !bullets[0] || !bullets[1]) throw new Error("missing bullets");
    bullets[0].text = "";
    bullets[1].text = " \n\t ";

    const result = guard(output);

    expect(result.reverts).toBe(2);
    expect(result.output.entries[0]?.bullets.map((bullet) => bullet.text)).toEqual([
      "Built and maintained 14 reports for a 20-person team.",
      "Cut prep time from 2 days to 3 hours.",
    ]);
    expect(result.issues).toEqual([
      { code: "G5", ref: "E1.B1" },
      { code: "G5", ref: "E1.B2" },
    ]);
  });

  it("G5 keeps 400 characters and reverts 401", () => {
    const output = tailorOutput();
    const bullet = output.entries[0]?.bullets[0];
    if (!bullet) throw new Error("missing bullet");
    bullet.text = "a".repeat(RESUME_LIMITS.bullet);
    expect(guard(output).reverts).toBe(0);

    bullet.text = "b".repeat(RESUME_LIMITS.bullet + 1);
    const reverted = guard(output);
    expect(reverted.reverts).toBe(1);
    expect(reverted.output.entries[0]?.bullets[0]?.reverted).toBe(true);
    expect(reverted.issues).toContainEqual({ code: "G5", ref: "E1.B1" });
  });

  it("G6 keeps the first bullet when source refs match in another order", () => {
    const output = tailorOutput();
    const entry = output.entries[0];
    if (!entry) throw new Error("missing entry");
    entry.bullets = [
      {
        sourceRefs: ["E1.B1", "E1.B2"],
        text: "Maintained 14 reports and cut prep to 3 hours.",
      },
      {
        sourceRefs: ["E1.B2", "E1.B1"],
        text: "Cut prep to 3 hours after maintaining 14 reports.",
      },
    ];

    const result = guard(output);

    expect(result.output.entries[0]?.bullets).toHaveLength(1);
    expect(result.output.entries[0]?.bullets[0]?.text).toBe(
      "Maintained 14 reports and cut prep to 3 hours.",
    );
    expect(result.issues).toContainEqual({ code: "G6", ref: "E1.B2" });
  });

  it("G6 drops a bullet whose refs match only after a bad ref is removed", () => {
    const output = tailorOutput();
    const entry = output.entries[0];
    if (!entry) throw new Error("missing entry");
    entry.bullets = [
      { sourceRefs: ["E1.B1"], text: "Maintained 14 reports for a 20-person team." },
      {
        sourceRefs: ["E1.B1", "E2.B1"],
        text: "Maintained 14 reports for a 20-person team.",
      },
    ];

    const result = guard(output);

    expect(result.output.entries[0]?.bullets).toHaveLength(1);
    expect(result.issues).toEqual([
      { code: "G3", ref: "E2.B1" },
      { code: "G6", ref: "E1.B1" },
    ]);
  });

  it("G7 drops unknown skill refs and categories left empty", () => {
    const output = tailorOutput();
    output.skills = [
      { category: "Languages", refs: ["S1", "S99"] },
      { category: "Missing", refs: [] },
      { category: null, refs: ["NO-SKILL"] },
    ];

    const result = guard(output);

    expect(result.output.skills).toEqual([
      { category: "Languages", refs: ["S1"] },
    ]);
    expect(result.issues).toEqual([
      { code: "G7", ref: "S99" },
      { code: "G7", ref: "NO-SKILL" },
    ]);
  });

  it("G8 drops an unknown requirement id and a repeated one", () => {
    const output = tailorOutput();
    output.requirementMatches = [
      {
        requirementId: "r1",
        verdict: "met",
        evidenceRefs: ["S1"],
        note: "First note.",
      },
      {
        requirementId: "r9",
        verdict: "met",
        evidenceRefs: ["S1"],
        note: "Not a real requirement.",
      },
      {
        requirementId: "r1",
        verdict: "missing",
        evidenceRefs: [],
        note: "Second note.",
      },
      {
        requirementId: "r2",
        verdict: "missing",
        evidenceRefs: [],
        note: "No certification is listed.",
      },
    ];

    const result = guard(output);
    const notes = result.output.requirementMatches.map((match) => match.note);

    expect(notes).toEqual(["First note.", "No certification is listed."]);
    expect(result.issues).toEqual([
      { code: "G8", ref: "r9" },
      { code: "G8", ref: "r1" },
    ]);
  });

  it("G9 adds a missing requirement as not assessed", () => {
    const output = tailorOutput();
    output.requirementMatches = [
      {
        requirementId: "r1",
        verdict: "partial",
        evidenceRefs: ["E2.B1"],
        note: "Related project work.",
      },
    ];

    const result = guard(output);

    expect(result.output.requirementMatches[1]).toEqual({
      requirementId: "r2",
      verdict: "missing",
      evidenceRefs: [],
      note: "Not assessed.",
    });
    expect(result.issues).toContainEqual({ code: "G9", ref: "r2" });
  });

  it("drops every match when the posting has no requirements", () => {
    const output = tailorOutput();
    const result = guard(output, librarySnapshot(), []);

    expect(result.output.requirementMatches).toEqual([]);
    expect(result.issues.map((issue) => issue.code)).toEqual(["G8", "G8"]);
  });

  it("G10 removes an evidence ref that is not on the snapshot", () => {
    const output = tailorOutput();
    const match = output.requirementMatches[0];
    if (!match) throw new Error("missing match");
    match.evidenceRefs = ["E1", "E99", "S1"];
    match.note = "Entry and skill still support it.";

    const result = guard(output);

    expect(result.output.requirementMatches[0]).toEqual({
      requirementId: "r1",
      verdict: "met",
      evidenceRefs: ["E1", "S1"],
      note: "Entry and skill still support it.",
    });
    expect(result.issues).toContainEqual({ code: "G10", ref: "E99" });
  });

  it("G10 downgrades met or partial when no evidence remains", () => {
    const stripped = tailorOutput();
    const strippedMatch = stripped.requirementMatches[0];
    if (!strippedMatch) throw new Error("missing match");
    strippedMatch.evidenceRefs = ["E99"];
    strippedMatch.note = "The model invented a citation.";

    const strippedResult = guard(stripped);
    expect(strippedResult.output.requirementMatches[0]).toMatchObject({
      verdict: "missing",
      evidenceRefs: [],
      note: "The model invented a citation.",
    });
    expect(strippedResult.issues).toContainEqual({ code: "G10", ref: "E99" });
    expect(strippedResult.issues).not.toContainEqual({ code: "G10", ref: "r1" });

    const empty = tailorOutput();
    const emptyMatch = empty.requirementMatches[0];
    if (!emptyMatch) throw new Error("missing match");
    emptyMatch.verdict = "partial";
    emptyMatch.evidenceRefs = [];

    const emptyResult = guard(empty);
    expect(emptyResult.output.requirementMatches[0]?.verdict).toBe("missing");
    expect(emptyResult.issues).toContainEqual({ code: "G10", ref: "r1" });
  });

  it("G10 leaves a missing verdict as missing", () => {
    const output = tailorOutput();
    const match = output.requirementMatches[1];
    if (!match) throw new Error("missing match");
    match.evidenceRefs = ["NOPE"];
    match.note = "Still missing.";

    const result = guard(output);

    expect(result.output.requirementMatches[1]).toEqual({
      requirementId: "r2",
      verdict: "missing",
      evidenceRefs: [],
      note: "Still missing.",
    });
    expect(result.issues).toEqual([{ code: "G10", ref: "NOPE" }]);
  });

  it("G11 appends omitted education entries, in snapshot order, with no bullets", () => {
    const output = tailorOutput();
    output.entries = output.entries.filter(
      (entry) => entry.ref !== "E3" && entry.ref !== "E5",
    );

    const result = guard(output);

    expect(result.output.entries.map((entry) => entry.ref)).toEqual([
      "E1",
      "E2",
      "E3",
      "E5",
    ]);
    expect(result.output.entries[2]?.bullets).toEqual([]);
    expect(result.output.entries[3]?.bullets).toEqual([]);
    expect(result.issues).toEqual([
      { code: "G11", ref: "E3" },
      { code: "G11", ref: "E5" },
    ]);
  });

  it("G11 does not append an omitted project or experience entry", () => {
    const output = tailorOutput();
    output.entries = output.entries.filter((entry) => entry.ref !== "E2");

    const result = guard(output);

    expect(result.output.entries.map((entry) => entry.ref)).not.toContain("E2");
    expect(result.issues.map((issue: GuardIssue) => issue.code)).not.toContain(
      "G11",
    );
  });
});
