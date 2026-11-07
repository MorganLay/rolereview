import { describe, expect, it } from "vitest";

import { strings } from "@/copy/strings";
import {
  bulletsBlockingQuickSave,
  firstImportCounts,
} from "@/features/import/confirm";

const kinds = strings.library.entries.kinds;

describe("firstImportCounts", () => {
  it("counts included sections in library order, then skills", () => {
    expect(
      firstImportCounts({
        entries: [
          { included: true, kind: "VOLUNTEER" },
          { included: true, kind: "EXPERIENCE" },
          { included: false, kind: "EXPERIENCE" },
          { included: true, kind: "EDUCATION" },
          { included: true, kind: "PROJECT" },
          { included: false, kind: "PROJECT" },
          { included: true, kind: "EXPERIENCE" },
        ],
        skills: [
          { included: true, name: "Figma" },
          { included: false, name: "Hidden" },
          { included: true, name: "   " },
          { included: true, name: "Research" },
        ],
      }),
    ).toEqual([
      { id: "EXPERIENCE", count: 2, label: kinds.EXPERIENCE.title },
      { id: "PROJECT", count: 1, label: kinds.PROJECT.title },
      { id: "EDUCATION", count: 1, label: kinds.EDUCATION.title },
      { id: "VOLUNTEER", count: 1, label: kinds.VOLUNTEER.title },
      { id: "skills", count: 2, label: strings.library.skills.title },
    ]);
  });

  it("omits an empty section", () => {
    expect(
      firstImportCounts({
        entries: [{ included: true, kind: "CERTIFICATION" }],
        skills: [],
      }),
    ).toEqual([
      { id: "CERTIFICATION", count: 1, label: kinds.CERTIFICATION.title },
    ]);
  });
});

describe("bulletsBlockingQuickSave", () => {
  it("asks about a blank bullet and a bullet over 400 characters", () => {
    const long = "a".repeat(401);
    const blocking = bulletsBlockingQuickSave({
      entries: [
        {
          included: true,
          title: " Designer ",
          bullets: [
            { included: true, text: "a".repeat(400) },
            { included: true, text: `  ${long}  ` },
            { included: false, text: "a".repeat(500) },
            { included: true, text: "   " },
          ],
        },
        {
          included: false,
          title: "Skipped",
          bullets: [{ included: true, text: "" }],
        },
      ],
    });

    expect(blocking).toEqual([
      { entryIndex: 0, bulletIndex: 1, title: "Designer", text: `  ${long}  ` },
      { entryIndex: 0, bulletIndex: 3, title: "Designer", text: "   " },
    ]);
  });
});
