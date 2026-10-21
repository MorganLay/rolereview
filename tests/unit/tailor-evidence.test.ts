import { describe, expect, it } from "vitest";

import {
  SKILLS_SECTION_ID,
  bulletElementId,
  entryElementId,
  evidenceLinks,
  resolveEvidenceRef,
  skillElementId,
} from "@/features/tailor/evidence";

import { contentBullet, librarySnapshot, resumeContent } from "./tailor-fixture";

function sample() {
  const snapshot = librarySnapshot();
  const content = resumeContent({
    entries: [
      {
        ref: "E1",
        kind: "EXPERIENCE",
        included: true,
        bullets: [
          contentBullet({
            id: "bullet-1",
            text: "Maintained reports.",
            sourceRefs: ["E1.B1"],
          }),
        ],
      },
    ],
    skills: [{ category: "Languages", names: ["Python"] }],
  });
  return { snapshot, content };
}

describe("resolveEvidenceRef", () => {
  it("scrolls a bullet ref to the resume bullet that cites it", () => {
    const { snapshot, content } = sample();
    const link = resolveEvidenceRef("E1.B1", content, snapshot);

    expect(link).toEqual({
      ref: "E1.B1",
      label: "Built and maintained 14 reports for a 20-person team.",
      elementId: bulletElementId("bullet-1"),
    });
  });

  it("falls back to the entry when the bullet is not on the resume", () => {
    const { snapshot, content } = sample();
    const link = resolveEvidenceRef("E1.B2", content, snapshot);

    expect(link?.elementId).toBe(entryElementId("E1"));
    expect(link?.label).toBe("Cut prep time from 2 days to 3 hours.");
  });

  it("returns nothing when the cited entry is not on the resume", () => {
    const { snapshot, content } = sample();

    expect(resolveEvidenceRef("E4.B1", content, snapshot)).toBeNull();
    expect(resolveEvidenceRef("E4", content, snapshot)).toBeNull();
    expect(resolveEvidenceRef("E9", content, snapshot)).toBeNull();
  });

  it("scrolls an entry ref to that entry", () => {
    const { snapshot, content } = sample();

    expect(resolveEvidenceRef("E1", content, snapshot)).toEqual({
      ref: "E1",
      label: "Junior Program Officer",
      elementId: entryElementId("E1"),
    });
  });

  it("scrolls a skill on the resume to its chip, and a missing skill to the skills section", () => {
    const { snapshot, content } = sample();

    expect(resolveEvidenceRef("S1", content, snapshot)?.elementId).toBe(
      skillElementId("S1"),
    );
    expect(resolveEvidenceRef("S2", content, snapshot)).toEqual({
      ref: "S2",
      label: "SQL",
      elementId: SKILLS_SECTION_ID,
    });
  });

  it("collapses whitespace and shortens a long source line", () => {
    const { snapshot, content } = sample();
    const bullet = snapshot.entries[0]?.bullets[0];
    if (!bullet) throw new Error("missing bullet");
    bullet.text = `Line one.\n${"word ".repeat(30)}`;

    const link = resolveEvidenceRef("E1.B1", content, snapshot);

    expect(link?.label.startsWith("Line one. word")).toBe(true);
    expect(link?.label.endsWith("…")).toBe(true);
    expect(link?.label.length).toBe(80);
  });

  it("drops a blank source line", () => {
    const { snapshot, content } = sample();
    const bullet = snapshot.entries[0]?.bullets[0];
    if (!bullet) throw new Error("missing bullet");
    bullet.text = " \n ";

    expect(resolveEvidenceRef("E1.B1", content, snapshot)).toBeNull();
  });

  it("lists each ref once and skips ones that do not resolve", () => {
    const { snapshot, content } = sample();

    const links = evidenceLinks(
      ["E1.B1", "E1.B1", "missing", "S1"],
      content,
      snapshot,
    );

    expect(links.map((link) => link.ref)).toEqual(["E1.B1", "S1"]);
  });
});
