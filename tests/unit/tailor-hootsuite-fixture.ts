import type { LibrarySnapshot } from "@/features/library/schemas";
import type { JobAnalysis, Requirement } from "@/features/jobs/schemas";
import type { TailorOutput } from "@/features/tailor/schemas";

import { ANALYST_POSTING, HOOTSUITE_POSTING } from "./hootsuite-posting";

export { ANALYST_POSTING, HOOTSUITE_POSTING };

/**
 * The same fictional library against the full Hootsuite junior-developer
 * posting and a reporting posting. Java in the library is familiarity and use.
 */

const profile: LibrarySnapshot["profile"] = {
  fullName: "Morgan Example",
  headline: "Computer science graduate",
  email: "morgan@example.com",
  phone: "613-555-0100",
  location: "Ottawa, ON",
  links: [{ label: "GitHub", url: "https://github.com/morgan-example" }],
  summary: "Library summary that tailoring must not overwrite.",
};

export function hootsuiteSnapshot(): LibrarySnapshot {
  return {
    takenAt: "2026-11-10T00:00:00.000Z",
    profile,
    entries: [
      {
        ref: "E_def",
        id: "entry-def",
        kind: "EXPERIENCE",
        title: "Software engineering intern",
        organization: "Def Hacks",
        location: "Ottawa, ON",
        startDate: "2024-05",
        endDate: "2024-08",
        isCurrent: false,
        url: null,
        bullets: [
          {
            ref: "E_def.B1",
            id: "b-def-1",
            text: "Developed and tested JavaScript and React web features.",
          },
          {
            ref: "E_def.B2",
            id: "b-def-2",
            text: "Worked in an Agile development environment.",
          },
          {
            ref: "E_def.B3",
            id: "b-def-3",
            text: "Used GitHub pull requests and participated in code reviews.",
          },
          {
            ref: "E_def.B4",
            id: "b-def-4",
            text: "Debugged web application functionality.",
          },
          {
            ref: "E_def.B5",
            id: "b-def-5",
            text: "Implemented OAuth 2.0 authentication.",
          },
          {
            ref: "E_def.B6",
            id: "b-def-6",
            text: "Integrated Firebase as a backend.",
          },
        ],
      },
      {
        ref: "E_role",
        id: "entry-role",
        kind: "PROJECT",
        title: "RoleRefine",
        organization: null,
        location: null,
        startDate: "2025-11",
        endDate: null,
        isCurrent: true,
        url: "https://github.com/morgan-example/rolerefine",
        bullets: [
          {
            ref: "E_role.B1",
            id: "b-role-1",
            text: "Built a live full-stack SaaS product.",
          },
          {
            ref: "E_role.B2",
            id: "b-role-2",
            text: "Used Next.js, TypeScript, Prisma, Supabase, and Vercel.",
          },
          {
            ref: "E_role.B3",
            id: "b-role-3",
            text: "Implemented authentication, persisted data, job tracking, resume export, and Stripe billing integration.",
          },
          {
            ref: "E_role.B4",
            id: "b-role-4",
            text: "Designed source-traceable AI resume editing workflows.",
          },
          {
            ref: "E_role.B5",
            id: "b-role-5",
            text: "Inspected, tested, and iteratively refined application behavior.",
          },
        ],
      },
      {
        ref: "E_creek",
        id: "entry-creek",
        kind: "PROJECT",
        title: "Crooked Creek",
        organization: null,
        location: null,
        startDate: "2025-06",
        endDate: "2025-09",
        isCurrent: false,
        url: null,
        bullets: [
          {
            ref: "E_creek.B1",
            id: "b-creek-1",
            text: "Built and deployed a production website using Remix, React, and Tailwind CSS.",
          },
          {
            ref: "E_creek.B2",
            id: "b-creek-2",
            text: "Integrated an external booking system.",
          },
          {
            ref: "E_creek.B3",
            id: "b-creek-3",
            text: "Managed requirements, DNS migration, and ongoing maintenance.",
          },
        ],
      },
      {
        ref: "E_cra",
        id: "entry-cra",
        kind: "EXPERIENCE",
        title: "Program officer",
        organization: "Canada Revenue Agency",
        location: "Ottawa, ON",
        startDate: "2023-11",
        endDate: null,
        isCurrent: true,
        url: null,
        bullets: [
          {
            ref: "E_cra.B1",
            id: "b-cra-1",
            text: "Developed reporting and analysis workflows using SQL, Excel, VBA, and business intelligence tools.",
          },
        ],
      },
      {
        ref: "E_edu",
        id: "entry-edu",
        kind: "EDUCATION",
        title: "Bachelor of Computer Science (Honours)",
        organization: "Carleton University",
        location: "Ottawa, ON",
        startDate: "2019-09",
        endDate: "2024-06",
        isCurrent: false,
        url: null,
        bullets: [
          {
            ref: "E_edu.B1",
            id: "b-edu-1",
            text: "Familiar with Java and has used it.",
          },
        ],
      },
    ],
    skills: [
      { ref: "S_java", id: "s-java", name: "Java", category: "Languages" },
      { ref: "S_ts", id: "s-ts", name: "TypeScript", category: "Languages" },
      { ref: "S_sql", id: "s-sql", name: "SQL", category: "Data" },
    ],
  };
}

const developerRequirements: Requirement[] = [
  {
    id: "r_degree",
    text: "A degree in Computer Science or Engineering",
    kind: "education",
    importance: "must",
  },
  {
    id: "r_tests",
    text: "Writing tests",
    kind: "experience",
    importance: "must",
  },
  {
    id: "r_java",
    text: "Experience with Java or a functional programming language",
    kind: "skill",
    importance: "must",
  },
  {
    id: "r_debug",
    text: "Debugged issues and root cause analysis",
    kind: "experience",
    importance: "must",
  },
  {
    id: "r_security",
    text: "Basic security and compliance practices",
    kind: "experience",
    importance: "must",
  },
  {
    id: "r_agile",
    text: "Common agile processes and continuous integration and delivery",
    kind: "experience",
    importance: "must",
  },
  { id: "r_review", text: "Code reviews and pull requests", kind: "experience", importance: "must" },
  {
    id: "r_collab",
    text: "Collaborate and communicate with the team",
    kind: "experience",
    importance: "must",
  },
  {
    id: "r_maintain",
    text: "Maintainability and reliability",
    kind: "experience",
    importance: "must",
  },
];

const analystRequirements: Requirement[] = [
  { id: "r_sql", text: "SQL", kind: "skill", importance: "must" },
  { id: "r_excel", text: "Excel", kind: "skill", importance: "must" },
  { id: "r_vba", text: "VBA", kind: "skill", importance: "nice" },
];

export function developerAnalysis(): JobAnalysis {
  return analysis(
    "Junior software developer",
    "Hootsuite",
    developerRequirements,
    [
      "Agile",
      "React",
      "JavaScript",
      "TypeScript",
      "pull request",
      "code review",
      "Java",
      "testing",
      "debugging",
      "security",
    ],
  );
}

export function analystAnalysis(): JobAnalysis {
  return analysis(
    "Reporting analyst",
    "Northwind",
    analystRequirements,
    ["SQL", "Excel", "VBA", "reporting"],
  );
}

/** A grounded developer draft: RoleRefine is composed, and the internship shows the practices. */
export function developerDraft(): TailorOutput {
  return {
    summary:
      "Computer science graduate who has built and tested web software, including a full-stack SaaS product.",
    entries: [
      {
        ref: "E_role",
        bullets: [
          {
            sourceRefs: ["E_role.B1", "E_role.B2", "E_role.B3"],
            text: "Built a live full-stack SaaS product using Next.js, TypeScript, Prisma, Supabase, and Vercel, with authentication, persisted data, job tracking, resume export, and Stripe billing integration.",
          },
          {
            sourceRefs: ["E_role.B4", "E_role.B5"],
            text: "Designed source-traceable AI resume editing workflows and tested application behavior.",
          },
        ],
      },
      {
        ref: "E_def",
        bullets: [
          {
            sourceRefs: ["E_def.B1", "E_def.B2", "E_def.B3"],
            text: "Developed and tested JavaScript and React features in an Agile environment, using GitHub pull requests and code reviews.",
          },
          {
            sourceRefs: ["E_def.B4", "E_def.B5", "E_def.B6"],
            text: "Debugged web functionality, implemented OAuth 2.0 authentication, and integrated Firebase as a backend.",
          },
        ],
      },
      {
        ref: "E_edu",
        bullets: [
          {
            sourceRefs: ["E_edu.B1"],
            text: "Familiar with Java and has used it.",
          },
        ],
      },
    ],
    skills: [
      { category: "Languages", refs: ["S_ts"] },
    ],
    requirementMatches: [
      {
        requirementId: "r_agile",
        verdict: "met",
        evidenceRefs: ["E_def.B2"],
        note: "The internship names Agile.",
      },
      {
        requirementId: "r_review",
        verdict: "met",
        evidenceRefs: ["E_def.B3"],
        note: "Pull requests and code reviews are named.",
      },
      {
        requirementId: "r_react",
        verdict: "met",
        evidenceRefs: ["E_def.B1"],
        note: "React features are on the internship.",
      },
      {
        requirementId: "r_java",
        verdict: "partial",
        evidenceRefs: ["E_edu.B1"],
        note: "Java is limited familiarity and prior use.",
      },
    ],
  };
}

/** The same library, aimed at reporting. The model mentioned only the product. */
export function analystDraft(): TailorOutput {
  return {
    summary: "Program officer who prepares reports.",
    entries: [
      {
        ref: "E_role",
        bullets: [
          {
            sourceRefs: ["E_role.B1"],
            text: "Built a live full-stack SaaS product.",
          },
        ],
      },
      { ref: "E_edu", bullets: [] },
    ],
    skills: [{ category: "Data", refs: ["S_sql"] }],
    requirementMatches: [
      {
        requirementId: "r_sql",
        verdict: "partial",
        evidenceRefs: ["S_sql"],
        note: "SQL is listed as a skill.",
      },
      {
        requirementId: "r_excel",
        verdict: "missing",
        evidenceRefs: [],
        note: "No Excel bullet was selected.",
      },
      {
        requirementId: "r_vba",
        verdict: "missing",
        evidenceRefs: [],
        note: "No VBA bullet was selected.",
      },
    ],
  };
}

function analysis(
  title: string,
  company: string,
  requirements: Requirement[],
  keywords: string[],
): JobAnalysis {
  return {
    title,
    company,
    location: "Ottawa, ON",
    seniority: "entry",
    workMode: "HYBRID",
    employmentType: "FULL_TIME",
    salary: null,
    referenceNumber: null,
    summary: "A posting used to compare two different applications.",
    requirements,
    keywords,
  };
}
