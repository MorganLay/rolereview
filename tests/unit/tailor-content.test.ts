import { describe, expect, it } from "vitest";

import { assembleResumeContent } from "@/features/tailor/assemble";
import { applyResumeEdit, formatSavedTime, resumeSkills } from "@/features/tailor/content";
import type { ResumeContent } from "@/features/tailor/schemas";
import { validateTailorOutput } from "@/features/tailor/validate";

import { jobAnalysis, librarySnapshot, tailorOutput } from "./tailor-fixture";

function ids() {
  let next = 1;
  return () => `id-${next++}`;
}

function tailored() {
  const snapshot = librarySnapshot();
  const aiOutput = validateTailorOutput(tailorOutput(), snapshot, jobAnalysis()).output;
  const stored = assembleResumeContent(aiOutput, snapshot, ids());
  return {
    snapshot,
    aiOutput,
    stored,
    incoming: structuredClone(stored) as ResumeContent,
  };
}

function bullet(content: ResumeContent, entryRef: string, bulletId: string) {
  return content.entries
    .find((entry) => entry.ref === entryRef)
    ?.bullets.find((item) => item.id === bulletId);
}

describe("formatSavedTime", () => {
  it("formats the clock in the user's timezone", () => {
    expect(formatSavedTime("2026-10-20T14:42:00.000Z", "America/Toronto")).toBe("10:42");
  });

  it("returns nothing for a bad timestamp", () => {
    expect(formatSavedTime("nope", "America/Toronto")).toBe("");
  });
});

describe("applyResumeEdit", () => {
  it("keeps section order and the tailored order inside a section", () => {
    const { snapshot, aiOutput, stored } = tailored();
    const reversed: ResumeContent = {
      ...stored,
      entries: [...stored.entries].reverse(),
    };
    const incoming = structuredClone(reversed);
    const experience = incoming.entries.filter((entry) => entry.kind === "EXPERIENCE");
    const first = experience[0];
    const second = experience[1];
    if (!first || !second) throw new Error("missing experience");
    incoming.entries = incoming.entries.map((entry) => {
      if (entry.ref === first.ref) return second;
      if (entry.ref === second.ref) return first;
      return entry;
    });

    const result = applyResumeEdit({ stored: reversed, incoming, snapshot, aiOutput });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content.entries.map((entry) => entry.ref)).toEqual([
      "E4",
      "E1",
      "E2",
      "E5",
      "E3",
    ]);
    expect(stored.entries.map((entry) => entry.ref)).toEqual(["E1", "E4", "E2", "E3", "E5"]);
  });

  it("reorders bullets inside an entry and leaves source refs on the stored bullet", () => {
    const { snapshot, aiOutput, stored, incoming } = tailored();
    const entry = incoming.entries.find((item) => item.ref === "E1");
    if (!entry) throw new Error("missing E1");
    const [first, second] = entry.bullets;
    if (!first || !second) throw new Error("missing bullets");
    first.sourceRefs = ["E2.B1"];
    entry.bullets = [second, first];

    const result = applyResumeEdit({ stored, incoming, snapshot, aiOutput });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content.entries.find((item) => item.ref === "E1")?.bullets.map((item) => item.id)).toEqual([
      second.id,
      first.id,
    ]);
    const storedBullet = stored.entries
      .find((item) => item.ref === "E1")
      ?.bullets.find((item) => item.id === first.id);
    expect(bullet(result.content, "E1", first.id)?.sourceRefs).toEqual(storedBullet?.sourceRefs);
    expect(storedBullet?.sourceRefs).not.toEqual(["E2.B1"]);
  });

  it("applies include toggles without clearing the other ones", () => {
    const { snapshot, aiOutput, stored, incoming } = tailored();
    incoming.summary.included = false;
    const entry = incoming.entries[0];
    const nested = entry?.bullets[0];
    if (!entry || !nested) throw new Error("missing bullet");
    entry.included = false;
    nested.included = false;

    const result = applyResumeEdit({ stored, incoming, snapshot, aiOutput });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content.summary.included).toBe(false);
    expect(result.content.entries[0]?.included).toBe(false);
    expect(result.content.entries[0]?.bullets[0]?.included).toBe(false);
    expect(result.content.entries[0]?.bullets[1]?.included).toBe(true);
  });

  it("trims summary and bullet text", () => {
    const { snapshot, aiOutput, stored, incoming } = tailored();
    incoming.summary.text = "  Analyst with reporting experience.  ";
    const entry = incoming.entries.find((item) => item.ref === "E1");
    const target = entry?.bullets[0];
    if (!target) throw new Error("missing bullet");
    target.text = "  Maintained 14 reports for a 20-person team.  ";

    const result = applyResumeEdit({ stored, incoming, snapshot, aiOutput });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content.summary.text).toBe("Analyst with reporting experience.");
    expect(bullet(result.content, "E1", target.id)?.text).toBe(
      "Maintained 14 reports for a 20-person team.",
    );
    expect(bullet(result.content, "E1", target.id)).toMatchObject({
      edited: false,
      reverted: false,
    });
  });

  it("marks a rewritten bullet restored when the text is the source again", () => {
    const { snapshot, aiOutput, stored, incoming } = tailored();
    const target = incoming.entries.find((item) => item.ref === "E1")?.bullets[0];
    if (!target) throw new Error("missing bullet");
    target.text = "Built and maintained 14 reports for a 20-person team.";

    const result = applyResumeEdit({ stored, incoming, snapshot, aiOutput });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(bullet(result.content, "E1", target.id)).toMatchObject({
      edited: true,
      reverted: true,
    });
  });

  it("marks a rewrite edited when the text is neither the tailored line nor the source", () => {
    const { snapshot, aiOutput, stored, incoming } = tailored();
    const target = incoming.entries.find((item) => item.ref === "E1")?.bullets[0];
    if (!target) throw new Error("missing bullet");
    target.text = "Kept the weekly reports current for the team.";
    target.edited = false;
    target.reverted = true;

    const result = applyResumeEdit({ stored, incoming, snapshot, aiOutput });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(bullet(result.content, "E1", target.id)).toMatchObject({
      edited: true,
      reverted: false,
    });
  });

  it("keeps a guard-restored bullet marked restored", () => {
    const snapshot = librarySnapshot();
    const aiOutput = validateTailorOutput(tailorOutput(), snapshot, jobAnalysis()).output;
    const original = aiOutput.entries[0]?.bullets[0];
    if (!original) throw new Error("missing bullet");
    original.text = "Built and maintained 14 reports for a 20-person team.";
    original.reverted = true;
    const stored = assembleResumeContent(aiOutput, snapshot, ids());
    const incoming = structuredClone(stored) as ResumeContent;

    const result = applyResumeEdit({ stored, incoming, snapshot, aiOutput });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content.entries[0]?.bullets[0]).toMatchObject({
      edited: false,
      reverted: true,
    });
  });

  it("treats an untouched library bullet as neither edited nor restored", () => {
    const { snapshot, aiOutput, stored, incoming } = tailored();
    const result = applyResumeEdit({ stored, incoming, snapshot, aiOutput });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const intern = bullet(result.content, "E4", result.content.entries.find((entry) => entry.ref === "E4")?.bullets[0]?.id ?? "");
    expect(intern).toMatchObject({ edited: false, reverted: false, included: false });
  });

  it("marks a library bullet edited when its text changes", () => {
    const { snapshot, aiOutput, stored, incoming } = tailored();
    const intern = incoming.entries.find((entry) => entry.ref === "E4")?.bullets[0];
    if (!intern) throw new Error("missing intern bullet");
    intern.text = "Shelved the morning returns.";

    const result = applyResumeEdit({ stored, incoming, snapshot, aiOutput });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(bullet(result.content, "E4", intern.id)).toMatchObject({
      edited: true,
      reverted: false,
    });
  });

  it("matches a tailored line when the model listed source refs in another order", () => {
    const { snapshot, aiOutput, stored, incoming } = tailored();
    const aiBullet = aiOutput.entries[0]?.bullets[0];
    const storedBullet = stored.entries[0]?.bullets[0];
    const incomingBullet = incoming.entries[0]?.bullets[0];
    if (!aiBullet || !storedBullet || !incomingBullet) throw new Error("missing bullet");
    aiBullet.sourceRefs = ["E1.B2", "E1.B1"];
    aiBullet.text = incomingBullet.text;
    storedBullet.sourceRefs = ["E1.B1", "E1.B2"];

    const result = applyResumeEdit({ stored, incoming, snapshot, aiOutput });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content.entries[0]?.bullets[0]).toMatchObject({
      edited: false,
      sourceRefs: ["E1.B1", "E1.B2"],
    });
  });

  it("keeps stored edited flags when the tailored output is missing", () => {
    const { snapshot, stored, incoming } = tailored();
    const result = applyResumeEdit({ stored, incoming, snapshot, aiOutput: null });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content.entries[0]?.bullets[0]).toMatchObject({
      edited: false,
      reverted: false,
    });
  });

  it("rejects a bullet that is blank, too long, new, missing, or moved", () => {
    const blank = tailored();
    const blankBullet = blank.incoming.entries[0]?.bullets[0];
    if (!blankBullet) throw new Error("missing bullet");
    blankBullet.text = "   ";
    expect(applyResumeEdit(blank)).toMatchObject({ ok: false, issue: "bulletText" });

    const long = tailored();
    const longBullet = long.incoming.entries[0]?.bullets[0];
    if (!longBullet) throw new Error("missing bullet");
    longBullet.text = "a".repeat(401);
    expect(applyResumeEdit(long)).toMatchObject({ ok: false, issue: "bulletText" });

    const kept = tailored();
    const keptBullet = kept.incoming.entries[0]?.bullets[0];
    if (!keptBullet) throw new Error("missing bullet");
    keptBullet.text = "a".repeat(400);
    expect(applyResumeEdit(kept).ok).toBe(true);

    const added = tailored();
    added.incoming.entries[0]?.bullets.push({
      id: "extra",
      text: "A new line.",
      included: true,
      sourceRefs: ["E1.B1"],
      reverted: false,
      edited: false,
    });
    expect(applyResumeEdit(added)).toMatchObject({ ok: false, issue: "bullets" });

    const dropped = tailored();
    dropped.incoming.entries[0]?.bullets.pop();
    expect(applyResumeEdit(dropped)).toMatchObject({ ok: false, issue: "bullets" });

    const moved = tailored();
    const movedBullet = moved.incoming.entries[0]?.bullets.shift();
    const project = moved.incoming.entries.find((entry) => entry.ref === "E2");
    if (!movedBullet || !project) throw new Error("missing move");
    project.bullets.push(movedBullet);
    expect(applyResumeEdit(moved)).toMatchObject({ ok: false, issue: "bullets" });
  });

  it("rejects a summary past 800 characters and allows an empty one", () => {
    const long = tailored();
    long.incoming.summary.text = "a".repeat(801);
    expect(applyResumeEdit(long)).toMatchObject({ ok: false, issue: "summary" });

    const empty = tailored();
    empty.incoming.summary.text = "   ";
    const result = applyResumeEdit(empty);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content.summary.text).toBe("");
  });

  it("rejects an entry set that is not the snapshot", () => {
    const missing = tailored();
    missing.stored.entries.pop();
    missing.incoming.entries.pop();
    expect(applyResumeEdit(missing)).toMatchObject({ ok: false, issue: "entries" });

    const extra = tailored();
    const copy = structuredClone(extra.incoming.entries[0]);
    if (!copy) throw new Error("missing entry");
    copy.ref = "E9";
    extra.incoming.entries.push(copy);
    extra.stored.entries.push(structuredClone(copy));
    expect(applyResumeEdit(extra)).toMatchObject({ ok: false, issue: "entries" });
  });

  it("rejects a bullet whose first source is not on that entry", () => {
    const { snapshot, aiOutput, stored, incoming } = tailored();
    const target = stored.entries[0]?.bullets[0];
    if (!target) throw new Error("missing bullet");
    target.sourceRefs = ["E9.B9"];
    const result = applyResumeEdit({ stored, incoming, snapshot, aiOutput });
    expect(result).toMatchObject({ ok: false, issue: "sources" });
  });

  it("files skills under the snapshot category and keeps the chosen order", () => {
    const { snapshot, aiOutput, stored, incoming } = tailored();
    incoming.skills = [
      { category: "Soft skills", names: ["IBM Cognos", "SQL", "Python"] },
    ];

    const result = applyResumeEdit({ stored, incoming, snapshot, aiOutput });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content.skills).toEqual([
      { category: "Languages", names: ["SQL", "Python"] },
      { category: null, names: ["IBM Cognos"] },
    ]);
    expect("title" in (result.content.entries[0] ?? {})).toBe(false);
  });

  it("rejects an unknown, duplicate, or differently spelled skill", () => {
    const unknown = tailored();
    unknown.incoming.skills = [{ category: "Tools", names: ["Excel"] }];
    expect(applyResumeEdit(unknown)).toMatchObject({ ok: false, issue: "skills" });

    const duplicate = tailored();
    duplicate.incoming.skills = [
      { category: "Languages", names: ["Python", "Python"] },
    ];
    expect(applyResumeEdit(duplicate)).toMatchObject({ ok: false, issue: "skills" });

    const spelling = tailored();
    spelling.incoming.skills = [{ category: "Languages", names: ["python"] }];
    expect(applyResumeEdit(spelling)).toMatchObject({ ok: false, issue: "skills" });

    const empty = tailored();
    empty.incoming.skills = [];
    const result = applyResumeEdit(empty);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content.skills).toEqual([]);
  });

  it("uses the snapshot kind when the incoming kind differs", () => {
    const { snapshot, aiOutput, stored, incoming } = tailored();
    const project = incoming.entries.find((entry) => entry.ref === "E2");
    if (!project) throw new Error("missing project");
    project.kind = "EXPERIENCE";

    const result = applyResumeEdit({ stored, incoming, snapshot, aiOutput });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content.entries.find((entry) => entry.ref === "E2")?.kind).toBe("PROJECT");
  });
});

describe("resumeSkills", () => {
  it("returns nothing when a name is not on the snapshot", () => {
    expect(resumeSkills(librarySnapshot(), ["Excel"])).toBeNull();
  });
});
