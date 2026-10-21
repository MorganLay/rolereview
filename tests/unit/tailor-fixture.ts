import type { LibrarySnapshot } from "@/features/library/schemas";
import type { JobAnalysis, Requirement } from "@/features/jobs/schemas";
import type {
  ContentBullet,
  ResumeContent,
  TailorOutput,
} from "@/features/tailor/schemas";

export const baseRequirements: Requirement[] = [
  { id: "r1", text: "Python", kind: "skill", importance: "must" },
  {
    id: "r2",
    text: "AWS certification",
    kind: "certification",
    importance: "nice",
  },
];

export function librarySnapshot(): LibrarySnapshot {
  return {
    takenAt: "2026-10-20T00:00:00.000Z",
    profile: {
      fullName: "Morgan Example",
      headline: "Data & reporting analyst",
      email: "morgan@example.com",
      phone: "613-555-0100",
      location: "Ottawa, ON",
      links: [{ label: "Portfolio", url: "https://example.com" }],
      summary: "Library summary that should not print on the resume.",
    },
    entries: [
      {
        ref: "E1",
        id: "entry-1",
        kind: "EXPERIENCE",
        title: "Junior Program Officer",
        organization: "Canada Revenue Agency",
        location: "Ottawa, ON",
        startDate: "2023-11",
        endDate: null,
        isCurrent: true,
        url: "https://example.com/role",
        bullets: [
          {
            ref: "E1.B1",
            id: "b1",
            text: "Built and maintained 14 reports for a 20-person team.",
          },
          {
            ref: "E1.B2",
            id: "b2",
            text: "Cut prep time from 2 days to 3 hours.",
          },
        ],
      },
      {
        ref: "E2",
        id: "entry-2",
        kind: "PROJECT",
        title: "Booking bot",
        organization: null,
        location: null,
        startDate: "2025-03",
        endDate: "2025-04",
        isCurrent: false,
        url: null,
        bullets: [
          {
            ref: "E2.B1",
            id: "b3",
            text: "Wrote a Python bot that booked rooms.",
          },
        ],
      },
      {
        ref: "E3",
        id: "entry-3",
        kind: "EDUCATION",
        title: "B.CS. Honours",
        organization: "Carleton University",
        location: "Ottawa, ON",
        startDate: null,
        endDate: "2023",
        isCurrent: false,
        url: null,
        bullets: [
          {
            ref: "E3.B1",
            id: "b4",
            text: "Completed a compilers course.",
          },
        ],
      },
      {
        ref: "E4",
        id: "entry-4",
        kind: "EXPERIENCE",
        title: "Intern",
        organization: "City Library",
        location: null,
        startDate: "2022",
        endDate: "2022-08",
        isCurrent: false,
        url: null,
        bullets: [
          {
            ref: "E4.B1",
            id: "b5",
            text: "Shelved returns each morning.",
          },
        ],
      },
      {
        ref: "E5",
        id: "entry-5",
        kind: "EDUCATION",
        title: "High school diploma",
        organization: "Example School",
        location: null,
        startDate: null,
        endDate: "2019",
        isCurrent: false,
        url: null,
        bullets: [],
      },
    ],
    skills: [
      { ref: "S1", id: "s1", name: "Python", category: "Languages" },
      { ref: "S2", id: "s2", name: "SQL", category: "Languages" },
      { ref: "S3", id: "s3", name: "IBM Cognos", category: null },
    ],
  };
}

export function jobAnalysis(
  requirements: Requirement[] = baseRequirements,
): JobAnalysis {
  return {
    title: "Analyst",
    company: "Northwind",
    location: null,
    seniority: "mid",
    workMode: "UNKNOWN",
    employmentType: null,
    salary: null,
    referenceNumber: null,
    summary: "Posting summary.",
    requirements,
    keywords: ["Python", "SQL"],
  };
}

/** Grounded output, including every education entry, so the guard can accept it. */
export function tailorOutput(): TailorOutput {
  return {
    summary: "Analyst with reporting experience.",
    entries: [
      {
        ref: "E1",
        bullets: [
          {
            sourceRefs: ["E1.B1"],
            text: "Maintained 14 reports for a 20-person team.",
          },
          {
            sourceRefs: ["E1.B2"],
            text: "Cut prep time from 2 days to 3 hours.",
          },
        ],
      },
      {
        ref: "E2",
        bullets: [
          {
            sourceRefs: ["E2.B1"],
            text: "Wrote a Python bot that booked rooms.",
          },
        ],
      },
      {
        ref: "E3",
        bullets: [
          {
            sourceRefs: ["E3.B1"],
            text: "Completed a compilers course.",
          },
        ],
      },
      { ref: "E5", bullets: [] },
    ],
    skills: [
      { category: "Languages", refs: ["S1", "S2"] },
      { category: null, refs: ["S3"] },
    ],
    requirementMatches: [
      {
        requirementId: "r1",
        verdict: "met",
        evidenceRefs: ["E2.B1", "S1"],
        note: "Python is on the bot project.",
      },
      {
        requirementId: "r2",
        verdict: "missing",
        evidenceRefs: [],
        note: "No certification is listed.",
      },
    ],
  };
}

export function contentBullet(
  overrides: Partial<ContentBullet> & Pick<ContentBullet, "id" | "text">,
): ContentBullet {
  return {
    included: true,
    sourceRefs: [],
    reverted: false,
    edited: false,
    ...overrides,
  };
}

export function resumeContent(
  overrides: Partial<ResumeContent> = {},
): ResumeContent {
  return {
    schemaVersion: 1,
    summary: { text: "Analyst with reporting experience.", included: true },
    entries: [],
    skills: [],
    ...overrides,
  };
}
