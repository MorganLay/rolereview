import { describe, expect, it } from "vitest";

import type { LibrarySnapshot } from "@/features/library/schemas";
import type { ResumeContent } from "@/features/tailor/schemas";
import { contentDisposition, resumePdfFilename } from "@/lib/pdf/filename";
import { resumePdfLines, resumePdfModel } from "@/lib/pdf/model";
import { renderResumePdf } from "@/lib/pdf/render";
import { resolveResumeTemplate } from "@/lib/pdf/template";
import { SEED_LIBRARY } from "../../prisma/library-seed";

import {
  contentBullet,
  librarySnapshot,
  resumeContent,
} from "./tailor-fixture";

const EN_DASH = "\u2013";
const DOT = "\u00b7";

const free = { modern: false, compact: false };
const pro = { modern: true, compact: true };

describe("resolveResumeTemplate", () => {
  it("falls back to Classic when Modern or Compact is not entitled", () => {
    expect(resolveResumeTemplate("modern", "classic", free)).toBe("classic");
    expect(resolveResumeTemplate("compact", "classic", free)).toBe("classic");
    expect(resolveResumeTemplate(null, "modern", free)).toBe("classic");
    expect(resolveResumeTemplate(null, "compact", free)).toBe("classic");
    expect(resolveResumeTemplate("modern", "classic", pro)).toBe("modern");
    expect(resolveResumeTemplate("compact", "compact", pro)).toBe("compact");
    expect(resolveResumeTemplate("nope", "classic", pro)).toBe("classic");
    expect(resolveResumeTemplate(null, "poster", free)).toBe("classic");
    expect(resolveResumeTemplate(" CLASSIC ", "modern", free)).toBe("classic");
  });
});

describe("resumePdfFilename", () => {
  it("joins name, company, and title with hyphens", () => {
    expect(resumePdfFilename("Morgan Example", "Northwind", "Data Analyst")).toBe(
      "Morgan-Example-Northwind-Data-Analyst.pdf",
    );
    expect(resumePdfFilename(null, "  ", "")).toBe("Resume.pdf");
    expect(resumePdfFilename("José Álvarez", "A&B", "C++")).toBe(
      "Jose-Alvarez-A-B-C.pdf",
    );
    expect(contentDisposition("Jose-Alvarez.pdf")).toContain(
      'filename="Jose-Alvarez.pdf"',
    );
  });
});

describe("resumePdfModel", () => {
  it("keeps included sections in resume order and drops everything else", () => {
    const model = resumePdfModel(sample(), librarySnapshot());

    expect(resumePdfLines(model)).toEqual([
      "Morgan Example",
      "Data & reporting analyst",
      `Ottawa, ON ${DOT} morgan@example.com ${DOT} 613-555-0100`,
      "Portfolio: https://example.com",
      "Summary",
      "Analyst with reporting experience.",
      "Experience",
      "Junior Program Officer",
      `Canada Revenue Agency ${DOT} Ottawa, ON ${DOT} Nov 2023 ${EN_DASH} Present`,
      "https://example.com/role",
      "- Maintained 14 reports for a 20-person team.",
      "Projects",
      "Booking bot",
      `Mar 2025 ${EN_DASH} Apr 2025`,
      "- Wrote a Python bot that booked rooms.",
      "Education",
      "B.CS. Honours",
      `Carleton University ${DOT} Ottawa, ON ${DOT} 2023`,
      "- Completed a compilers course.",
      "Skills",
      "Languages: Python, SQL",
      "IBM Cognos",
    ]);
  });

  it("drops a non-http link and an excluded summary", () => {
    const snapshot = librarySnapshot();
    snapshot.profile.links = [{ label: "Site", url: "javascript:alert(1)" }];
    const model = resumePdfModel(
      resumeContent({
        summary: { text: "Hidden.", included: false },
        entries: [],
        skills: [],
      }),
      snapshot,
    );

    expect(model.links).toEqual([]);
    expect(model.summary).toBeNull();
    expect(resumePdfLines(model)).toEqual([
      "Morgan Example",
      "Data & reporting analyst",
      `Ottawa, ON ${DOT} morgan@example.com ${DOT} 613-555-0100`,
    ]);
  });
});

describe("renderResumePdf", () => {
  it("fits a typical resume on one Letter page", async () => {
    const model = typicalResume();
    const classic = await renderResumePdf(model, "classic");
    const compact = await renderResumePdf(model, "compact");
    const modern = await renderResumePdf(model, "modern");

    expect(classic.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdfPageCount(classic)).toBe(1);
    expect(pdfPageCount(compact)).toBe(1);
    expect(pdfPageCount(modern)).toBe(1);
  }, 20000);
});

function pdfPageCount(pdf: Buffer): number {
  const text = pdf.toString("latin1");
  return text.match(/\/Type\s*\/Page(?!s)\b/g)?.length ?? 0;
}

function sample() {
  return resumeContent({
    summary: { text: "Analyst with reporting experience.", included: true },
    entries: [
      {
        ref: "E2",
        kind: "PROJECT",
        included: true,
        bullets: [
          contentBullet({
            id: "p1",
            text: "Wrote a Python bot\nthat booked rooms.",
          }),
        ],
      },
      {
        ref: "E1",
        kind: "EXPERIENCE",
        included: true,
        bullets: [
          contentBullet({
            id: "e1",
            text: "Maintained 14 reports for a 20-person team.",
          }),
          contentBullet({
            id: "e2",
            text: "Left off.",
            included: false,
          }),
        ],
      },
      {
        ref: "E4",
        kind: "EXPERIENCE",
        included: false,
        bullets: [contentBullet({ id: "e4", text: "Shelved returns each morning." })],
      },
      {
        ref: "missing",
        kind: "EXPERIENCE",
        included: true,
        bullets: [contentBullet({ id: "gone", text: "Not in the snapshot." })],
      },
      {
        ref: "E3",
        kind: "EDUCATION",
        included: true,
        bullets: [contentBullet({ id: "ed", text: "Completed a compilers course." })],
      },
    ],
    skills: [
      { category: "Languages", names: ["Python", "SQL"] },
      { category: null, names: ["IBM Cognos"] },
      { category: "   ", names: ["  "] },
    ],
  });
}

/** The dev seed library, all included. Fake person only. */
function typicalResume() {
  const entries = SEED_LIBRARY.entries.map((entry, index) => ({
    ref: `E${index + 1}`,
    id: `e${index + 1}`,
    kind: entry.kind,
    title: entry.title,
    organization: entry.organization,
    location: entry.location,
    startDate: entry.startDate,
    endDate: entry.endDate,
    isCurrent: entry.isCurrent,
    url: entry.url,
    bullets: entry.bullets.map((bullet, bulletIndex) => ({
      ref: `E${index + 1}.B${bulletIndex + 1}`,
      id: `b-${index}-${bulletIndex}`,
      text: bullet.text,
    })),
  }));

  const snapshot: LibrarySnapshot = {
    takenAt: "2026-10-21T00:00:00.000Z",
    profile: {
      fullName: SEED_LIBRARY.profile.fullName,
      headline: SEED_LIBRARY.profile.headline,
      email: "avery@example.com",
      phone: SEED_LIBRARY.profile.phone,
      location: SEED_LIBRARY.profile.location,
      links: SEED_LIBRARY.profile.links.map((link) => ({ ...link })),
      summary: SEED_LIBRARY.profile.summary,
    },
    entries,
    skills: SEED_LIBRARY.skills.map((skill, index) => ({
      ref: `S${index + 1}`,
      id: `s${index + 1}`,
      name: skill.name,
      category: skill.category,
    })),
  };

  const groups: { category: string | null; names: string[] }[] = [];
  for (const skill of SEED_LIBRARY.skills) {
    const category = skill.category;
    const existing = groups.find((group) => group.category === category);
    if (existing) existing.names.push(skill.name);
    else groups.push({ category, names: [skill.name] });
  }

  const content: ResumeContent = {
    schemaVersion: 1,
    summary: { text: SEED_LIBRARY.profile.summary, included: true },
    entries: entries.map((entry) => ({
      ref: entry.ref,
      kind: entry.kind,
      included: true,
      bullets: entry.bullets.map((bullet) =>
        contentBullet({
          id: bullet.id,
          text: bullet.text,
          sourceRefs: [bullet.ref],
        }),
      ),
    })),
    skills: groups,
  };

  return resumePdfModel(content, snapshot);
}
