import { describe, expect, it } from "vitest";

import type { CoverLetterContent } from "@/features/letters/schemas";
import type { LibrarySnapshot } from "@/features/library/schemas";
import type { ResumeContent } from "@/features/tailor/schemas";
import {
  contentDisposition,
  filenameFromContentDisposition,
  letterDocxFilename,
  letterPdfFilename,
  resumeDocxFilename,
  resumePdfFilename,
} from "@/lib/pdf/filename";
import { letterPdfLines, letterPdfModel } from "@/lib/pdf/letter-model";
import { resumePdfLines, resumePdfModel, type ResumePdfModel } from "@/lib/pdf/model";
import { pdfPageCount } from "@/lib/pdf/pages";
import { renderLetterPdf, renderResumePdf } from "@/lib/pdf/render";
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
    expect(filenameFromContentDisposition(contentDisposition("José.pdf"))).toBe(
      "José.pdf",
    );
    expect(filenameFromContentDisposition(null)).toBeNull();
    expect(filenameFromContentDisposition("attachment")).toBeNull();
  });
});

describe("letterPdfFilename", () => {
  it("joins name, company, and title, then Letter", () => {
    expect(letterPdfFilename("Morgan Example", "Northwind", "Data Analyst")).toBe(
      "Morgan-Example-Northwind-Data-Analyst-Letter.pdf",
    );
    expect(letterPdfFilename(null, "  ", "")).toBe("Letter.pdf");
    expect(letterDocxFilename("Morgan Example", "Northwind", "Data Analyst")).toBe(
      "Morgan-Example-Northwind-Data-Analyst-Letter.docx",
    );
    expect(resumeDocxFilename("Morgan Example", "Northwind", "Data Analyst")).toBe(
      "Morgan-Example-Northwind-Data-Analyst.docx",
    );
    expect(resumeDocxFilename(null, "  ", "")).toBe("Resume.docx");
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

  it("tightens a 1-page tailor that would otherwise spill onto page two", async () => {
    const model = longResume();
    const spilled = await renderResumePdf(model, "classic");
    const fitted = await renderResumePdf(model, "classic", { pages: 1 });

    expect(pdfPageCount(spilled)).toBeGreaterThan(1);
    expect(pdfPageCount(fitted)).toBe(1);
  }, 20000);
});

describe("letterPdfModel", () => {
  it("matches copy-text order and drops excluded paragraphs", () => {
    const model = letterPdfModel(sampleLetter());
    expect(letterPdfLines(model)).toEqual([
      "Dear Hiring Manager,",
      "I maintained 14 reports.",
      "Sincerely,",
      "Morgan Example",
    ]);
  });
});

describe("renderLetterPdf", () => {
  it("renders Classic, Modern, and Compact as a PDF", async () => {
    const model = letterPdfModel(sampleLetter());
    const classic = await renderLetterPdf(model, "classic");
    const modern = await renderLetterPdf(model, "modern");
    const compact = await renderLetterPdf(model, "compact");

    expect(classic.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdfPageCount(classic)).toBe(1);
    expect(pdfPageCount(modern)).toBe(1);
    expect(pdfPageCount(compact)).toBe(1);
  }, 20000);
});

function sampleLetter(): CoverLetterContent {
  return {
    schemaVersion: 1,
    greeting: "Dear Hiring Manager,",
    paragraphs: [
      {
        id: "p1",
        text: "I maintained 14 reports.",
        included: true,
        sourceRefs: ["E1.B1"],
        reverted: false,
        edited: false,
        needsWhy: false,
      },
      {
        id: "p2",
        text: "Left off.",
        included: false,
        sourceRefs: ["POSTING"],
        reverted: false,
        edited: false,
        needsWhy: false,
      },
    ],
    closing: "Sincerely,",
    signature: "Morgan Example",
    requirementIdsAddressed: ["r1"],
  };
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

/** Enough lines to spill a Classic resume, and few enough that tightening fits. */
function longResume(): ResumePdfModel {
  const bullets = Array.from({ length: 36 }, (_, index) =>
    `Maintained ${index + 12} weekly reports for a 20-person team and wrote the handoff notes that cut the review from an hour to twenty minutes.`,
  );
  return {
    name: "Morgan Example",
    headline: "Data & reporting analyst",
    contact: "Ottawa, ON · morgan@example.com · 613-555-0100",
    links: [
      "Portfolio: https://example.com/portfolio",
      "LinkedIn: https://example.com/in/morgan",
      "GitHub: https://example.com/morgan",
    ],
    summary: "Analyst with reporting experience across public-sector teams.",
    sections: [
      {
        heading: "Experience",
        entries: [
          {
            title: "Junior Program Officer",
            meta: "Canada Revenue Agency · Ottawa, ON · Nov 2023 – Present",
            url: "https://example.com/role",
            bullets,
          },
        ],
      },
    ],
    skills: ["Languages: Python, SQL"],
  };
}
