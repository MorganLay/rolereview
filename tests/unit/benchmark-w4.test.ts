import { describe, expect, it } from "vitest";

import type { LibrarySnapshot } from "@/features/library/schemas";

import { applyRoleDates } from "../../benchmarks/write-verify/import-dates";
import { mergeDuplicateRoles, missingSpans, proposedImportPrompt } from "../../benchmarks/write-verify/import-fidelity";
import { writeVerifyW4Prompt } from "../../benchmarks/write-verify/prompt";
import { w3Defects } from "../../benchmarks/write-verify/w3-defects";
import { credentialLine } from "../../benchmarks/write-verify/w4-display";

describe("W4 import fidelity and writing rules", () => {
  it("adds the seniority and recognition rules", () => {
    const prompt = writeVerifyW4Prompt();
    expect(prompt).toContain("Founder-level experience");
    expect(prompt).toContain("as owner and lead designer");
    expect(prompt).toContain("goes under Recognition");
  });

  it("fills one range and leaves a heading with two ranges undated", () => {
    const one = applyRoleDates(library([{ title: "Teacher (Jan–Mar 2016)", startDate: null, endDate: null }]));
    expect(one.snapshot.entries[0]?.startDate).toBe("2016-01");
    expect(one.snapshot.entries[0]?.endDate).toBe("2016-03");
    const two = applyRoleDates(
      library([
        {
          title: "Prior admin roles in sign shop (1999–2004) and medical office (1998–1999).",
          startDate: "1999",
          endDate: "2004",
        },
      ]),
    );
    expect(two.snapshot.entries[0]?.startDate).toBeNull();
    expect(two.snapshot.entries[0]?.endDate).toBeNull();
    expect(two.changes.some((change) => change.action === "cleared")).toBe(true);
  });

  it("keeps the duplicate role that has the fuller dates", () => {
    const snapshot = library([
      {
        title: "Accountant (2010–2013)",
        startDate: "2010",
        endDate: "2013",
        bullets: ["managed $10M+ monthly revenue; raised collections from 40% to 90%"],
      },
      {
        title: "Accountant",
        startDate: null,
        endDate: "2013",
        bullets: ["managed $10M+ monthly revenue", "raised collections from 40% to 90%"],
      },
      {
        title: "Accountant",
        startDate: "2013",
        endDate: null,
        bullets: ["cut the monthly close"],
      },
    ]);
    const merged = mergeDuplicateRoles(snapshot);
    expect(merged.merged).toHaveLength(1);
    expect(merged.snapshot.entries).toHaveLength(2);
    expect(merged.snapshot.entries.some((entry) => entry.startDate === "2010" && entry.endDate === "2013")).toBe(true);
    expect(merged.snapshot.entries.some((entry) => entry.bullets.some((bullet) => bullet.text === "cut the monthly close"))).toBe(true);
  });

  it("lists a source phrase the library dropped", () => {
    const resume = [
      "Education: B.A. Math, State College (2010).",
      "Skills: Excel. Teacher of the Month.",
      "Experience: Teacher (2010–2014): taught algebra.",
    ].join("\n");
    const snapshot = library([
      { title: "B.A. Math", startDate: null, endDate: "2010", kind: "EDUCATION", organization: "State College" },
      { title: "Teacher (2010–2014)", startDate: "2010", endDate: "2014", bullets: ["taught algebra"] },
    ]);
    snapshot.skills = [{ ref: "S1", id: "S1", name: "Excel", category: null }];
    const gaps = missingSpans(resume, snapshot);
    expect(gaps.some((gap) => gap.missingWords.includes("Month") || gap.text.includes("Teacher of the Month"))).toBe(true);
  });

  it("does not flag a bullet that only shares one word with the heading", () => {
    const page = [
      "Experience",
      "Maintenance",
      "- Served as lead mechanic managing 4 technicians across maintenance operations",
      "Senior Graphic Designer",
      "Acme Studio",
      "- Created licensed kids' art and prepared tech packs as senior graphic designer.",
    ].join("\n");
    const defects = w3Defects(page, []);
    expect(defects.titleLines).toEqual(["Created licensed kids' art and prepared tech packs as senior graphic designer."]);
  });

  it("prints a credential once with its school and year", () => {
    const entry = library([{ title: "B.S. Accountancy", startDate: null, endDate: "2006", organization: "CUNY Brooklyn College" }]).entries[0];
    if (!entry) throw new Error("missing entry");
    expect(credentialLine(entry)).toBe("B.S. Accountancy, CUNY Brooklyn College, 2006");
  });

  it("builds the proposed import prompt without editing the source file", () => {
    const system = "Rules:\n- Copy a year into startDate or endDate only when that year is written for that job. If the heading's range is not YYYY or YYYY-MM, keep those words in the title and leave the date fields null. Do not invent an employer, credential, or metric.";
    const next = proposedImportPrompt(system);
    expect(next).toContain("2010–2013");
    expect(next).toContain("Do not stop after the tool list.");
    expect(next).not.toContain("leave the date fields null");
  });
});

function library(
  rows: {
    title: string;
    startDate: string | null;
    endDate?: string | null;
    bullets?: string[];
    kind?: LibrarySnapshot["entries"][number]["kind"];
    organization?: string | null;
  }[],
): LibrarySnapshot {
  return {
    takenAt: "2026-11-15T00:00:00.000Z",
    profile: { fullName: null, headline: null, email: "", phone: null, location: null, links: [], summary: null },
    entries: rows.map((row, index) => ({
      ref: `E${index + 1}`,
      id: `E${index + 1}`,
      kind: row.kind ?? "EXPERIENCE",
      title: row.title,
      organization: row.organization ?? null,
      location: null,
      startDate: row.startDate,
      endDate: row.endDate ?? null,
      isCurrent: false,
      url: null,
      bullets: (row.bullets ?? []).map((text, bullet) => ({ ref: `B${index}-${bullet}`, id: `B${index}-${bullet}`, text })),
    })),
    skills: [],
  };
}
