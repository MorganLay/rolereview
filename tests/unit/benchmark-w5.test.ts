import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { LibrarySnapshot } from "@/features/library/schemas";
import type { ResumeContent } from "@/features/tailor/schemas";

import { prepareEvidence } from "../../benchmarks/lib/evidence";
import { loadCase } from "../../benchmarks/lib/load";
import { applyW5Cut } from "../../benchmarks/write-verify/cut";
import { applyRoleDates } from "../../benchmarks/write-verify/import-dates";
import { applyRepair, dedupeLibrary, missingSpans, repairPrompt } from "../../benchmarks/write-verify/import-fidelity";
import { cutW5Prompt, writeVerifyW4Prompt } from "../../benchmarks/write-verify/prompt";
import { readerDefects } from "../../benchmarks/write-verify/w3-defects";

const W3 = path.join(process.cwd(), "benchmarks", "results", "write-verify-w3-2026-11-15T09-21-40-878Z");
const W4 = path.join(process.cwd(), "benchmarks", "results", "write-verify-w4-2026-11-15T21-09-45-413Z");
const CASES = [
  "P006-J047",
  "P011-J052",
  "P012-J037",
  "P014-J055",
  "P001-J001",
  "P008-J024",
  "P010-J028",
  "P013-J040",
  "P016-J050",
  "P017-J043",
];

describe("W5 import check, cuts, and reader defects", () => {
  it("reports zero missing spans before repair on the five empty repairs", () => {
    const empty: string[] = [];
    for (const caseId of CASES) {
      const repairPath = path.join(W4, `${caseId}.import.repair.call.json`);
      let placements = -1;
      try {
        const repair = JSON.parse(readFileSync(repairPath, "utf8")) as { data?: { placements?: unknown[] } };
        placements = repair.data?.placements?.length ?? 0;
      } catch {
        placements = -1;
      }
      if (placements !== 0) continue;
      empty.push(caseId);
      const testCase = loadCase(caseId);
      if (!testCase) throw new Error(caseId);
      const resume = prepareEvidence(testCase).evidence.resume;
      const saved = JSON.parse(readFileSync(path.join(W3, `${caseId}.import.library.json`), "utf8")) as LibrarySnapshot;
      const gaps = missingSpans(resume, applyRoleDates(saved).snapshot);
      expect(gaps, caseId).toEqual([]);
    }
    expect(empty).toHaveLength(5);
  });

  it("keeps a real dropped phrase and does not invent a repair", () => {
    const testCase = loadCase("P010-J028");
    if (!testCase) throw new Error("P010");
    const resume = prepareEvidence(testCase).evidence.resume;
    const saved = JSON.parse(readFileSync(path.join(W3, "P010-J028.import.library.json"), "utf8")) as LibrarySnapshot;
    const gaps = missingSpans(resume, applyRoleDates(saved).snapshot);
    expect(gaps.length).toBeGreaterThan(0);
    expect(gaps.some((gap) => gap.text.toLowerCase().includes("teacher of the month") || gap.missingWords.some((word) => /hsa|month/i.test(word)))).toBe(true);

    const repaired = applyRepair({ snapshot: saved, resume, spans: gaps, placements: [] });
    expect(repaired.placed).toBe(0);
    expect(repaired.snapshot.entries).toHaveLength(saved.entries.length);
    expect(repaired.snapshot.skills).toHaveLength(saved.skills.length);
  });

  it("asks the repair to keep an honors sentence off a single degree", () => {
    expect(repairPrompt()).toContain("names no single school");
    expect(repairPrompt()).toContain("not a line under one degree");
    expect(writeVerifyW4Prompt()).toContain("Founder-level experience");
    expect(cutW5Prompt()).toContain("oldest or least relevant");
    expect(cutW5Prompt()).toContain("unless every other option is used");
  });

  it("drops an exact duplicate entry and a repeated bullet", () => {
    const snapshot = library([
      { title: "B.S. Accountancy", organization: "CUNY", bullets: ["Raised collections from 40% to 90% while managing revenue."] },
      { title: "B.S. Accountancy", organization: "CUNY", bullets: ["Raised collections from 40% to 90% while managing revenue."] },
    ]);
    snapshot.entries[0]?.bullets.push({
      ref: "B9",
      id: "B9",
      text: "Raised collections from 40% to 90% while managing revenue.",
    });
    const cleaned = dedupeLibrary(snapshot);
    expect(cleaned.removedEntries).toEqual(["E2"]);
    expect(cleaned.snapshot.entries).toHaveLength(1);
    expect(cleaned.snapshot.entries[0]?.bullets).toHaveLength(1);
  });

  it("refuses the first line and the only line that holds a number", () => {
    const snapshot = library([{ title: "Manager", bullets: [] }]);
    const content = {
      entries: [
        {
          ref: "E1",
          included: true,
          bullets: [
            { id: "first", text: "Led the plant installation.", included: true, sourceRefs: ["B1"] },
            { id: "note", text: "Filed the weekly notes for the crew.", included: true, sourceRefs: ["B2"] },
            { id: "money", text: "Saved $10M on the energy contract.", included: true, sourceRefs: ["B3"] },
          ],
        },
      ],
    } as ResumeContent;
    const cut = applyW5Cut(content, snapshot, {
      reason: "Oldest lines first.",
      drop: ["first", "note", "money"],
      merge: [],
    });
    const kept = cut.content.entries[0]?.bullets.filter((bullet) => bullet.included).map((bullet) => bullet.id);
    expect(kept).toContain("first");
    expect(kept).toContain("money");
    expect(kept).not.toContain("note");
    expect(cut.log.reason).toBe("Oldest lines first.");
  });

  it("counts a repeated block and a two-role heading, and notes a library copy", () => {
    const page = [
      "Experience",
      "Maintenance",
      "- Served as lead mechanic across maintenance operations.",
      "Prior admin roles in sign shop (1999–2004) and medical office (1998–1999).",
      "- Held earlier administrative roles.",
      "Education",
      "B.S. Accountancy, CUNY Brooklyn College, 2006",
      "- B.S. Accountancy, CUNY Brooklyn College, 2006",
      "Skills",
      "HTML/CSS/PHP and Flash/ActionScript for the storefront.",
    ].join("\n");
    const defects = readerDefects(page, ["Served as lead mechanic across maintenance operations."]);
    expect(defects.duplicates.length).toBeGreaterThan(0);
    expect(defects.badHeadings.some((line) => line.includes("1999"))).toBe(true);
    expect(defects.packedLines.some((line) => line.includes("HTML/CSS/PHP"))).toBe(true);
    expect(defects.titleRestatements).toEqual([]);
    expect(defects.notes.libraryLines).toHaveLength(1);
    expect(defects.total).toBe(defects.duplicates.length + defects.packedLines.length + defects.badHeadings.length);
    const sameTitle = ["Experience", "High School Math Teacher", "2009 – Present", "- Taught algebra.", "High School Math Teacher", "2005 – 2009", "- Taught geometry.", "Skills", "Accounting: AP/AR, G/L, BS/IS/CF"].join("\n");
    const quiet = readerDefects(sameTitle, []);
    expect(quiet.duplicates).toEqual([]);
    expect(quiet.packedLines).toEqual([]);
  });
});

function library(
  rows: { title: string; organization?: string; bullets: string[] }[],
): LibrarySnapshot {
  return {
    takenAt: "2026-11-15T00:00:00.000Z",
    profile: { fullName: null, headline: null, email: "", phone: null, location: null, links: [], summary: null },
    entries: rows.map((row, index) => ({
      ref: `E${index + 1}`,
      id: `E${index + 1}`,
      kind: "EXPERIENCE",
      title: row.title,
      organization: row.organization ?? null,
      location: null,
      startDate: null,
      endDate: null,
      isCurrent: false,
      url: null,
      bullets: row.bullets.map((text, bullet) => ({ ref: `B${index}-${bullet}`, id: `B${index}-${bullet}`, text })),
    })),
    skills: [],
  };
}
