import type { LibrarySnapshot } from "@/features/library/schemas";
import type { JobAnalysis, Requirement } from "@/features/jobs/schemas";
import type { TailorOutput } from "@/features/tailor/schemas";

/**
 * A software application against a library that has a current CRA role,
 * a 2020 internship, recent engineering projects, an academic project,
 * and two records of one Carleton degree.
 * The tailor output repeats the failures this fixture locks down.
 */

const requirements: Requirement[] = [
  { id: "r1", text: "TypeScript", kind: "skill", importance: "must" },
  { id: "r2", text: "React", kind: "skill", importance: "must" },
];

export function scenarioSnapshot(): LibrarySnapshot {
  return {
    takenAt: "2026-11-01T00:00:00.000Z",
    profile: {
      fullName: "Morgan Example",
      headline: "Software developer",
      email: "morgan@example.com",
      phone: "613-555-0100",
      location: "Ottawa, ON",
      links: [
        { label: "GitHub", url: "https://github.com/morgan-example" },
        { label: "GH", url: "https://www.github.com/morgan-example/" },
        { label: "LinkedIn", url: "https://www.linkedin.com/in/morgan-example" },
        { label: "Course", url: "https://www.coursera.org/learn/ml" },
      ],
      summary: "Library summary that should not print unchanged.",
    },
    entries: [
      {
        ref: "E_cra",
        id: "entry-cra",
        kind: "EXPERIENCE",
        title: "Program Officer",
        organization: "Canada Revenue Agency",
        location: "Ottawa, ON",
        startDate: "2021-05",
        endDate: null,
        isCurrent: true,
        url: null,
        bullets: [
          {
            ref: "E_cra.B1",
            id: "b-cra",
            text: "Prepared correspondence and tracked processing files for individual tax returns.",
          },
        ],
      },
      {
        ref: "E_def",
        id: "entry-def",
        kind: "EXPERIENCE",
        title: "Software Intern",
        organization: "Def Hacks",
        location: "Ottawa, ON",
        startDate: "2020-05",
        endDate: "2020-08",
        isCurrent: false,
        url: null,
        bullets: [
          {
            ref: "E_def.B1",
            id: "b-def",
            text: "Assisted with workshop logistics for a student hackathon.",
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
            id: "b-role-generic",
            text: "Responsible for various project tasks.",
          },
          {
            ref: "E_role.B2",
            id: "b-role-strong",
            text: "Implemented resume checks in TypeScript and Next.js, and validated unsupported claims with tests.",
          },
        ],
      },
      {
        ref: "E_gorseline",
        id: "entry-gorseline",
        kind: "PROJECT",
        title: "Gorseline",
        organization: null,
        location: null,
        startDate: "2026-01",
        endDate: "2026-04",
        isCurrent: false,
        url: null,
        bullets: [
          {
            ref: "E_gorseline.B1",
            id: "b-gorseline",
            text: "Built a React scheduling service backed by PostgreSQL and covered the flow with integration tests.",
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
        startDate: "2026-02",
        endDate: "2026-05",
        isCurrent: false,
        url: null,
        bullets: [
          {
            ref: "E_creek.B1",
            id: "b-creek",
            text: "Developed a TypeScript API and validated each request path with unit tests.",
          },
        ],
      },
      {
        ref: "E_cnn",
        id: "entry-cnn",
        kind: "PROJECT",
        title: "COVID CNN",
        organization: null,
        location: null,
        startDate: "2020-09",
        endDate: "2020-12",
        isCurrent: false,
        url: null,
        bullets: [
          {
            ref: "E_cnn.B1",
            id: "b-cnn",
            text: "Trained a machine learning model for a university course.",
          },
        ],
      },
      {
        ref: "E_degree",
        id: "entry-degree",
        kind: "EDUCATION",
        title: "Bachelor of Computer Science",
        organization: "Carleton University",
        location: "Ottawa, ON",
        startDate: "2019-09",
        endDate: "2024",
        isCurrent: false,
        url: null,
        bullets: [
          {
            ref: "E_degree.B1",
            id: "b-degree",
            text: "Completed the honours project in computer science.",
          },
        ],
      },
      {
        ref: "E_degree_dup",
        id: "entry-degree-dup",
        kind: "EDUCATION",
        title: "B.C.S. Honours",
        organization: "Carleton",
        location: "Ottawa, ON",
        startDate: null,
        endDate: "2024-06",
        isCurrent: false,
        url: null,
        bullets: [
          {
            ref: "E_degree_dup.B1",
            id: "b-degree-dup",
            text: "Studied computer science.",
          },
        ],
      },
      {
        ref: "E_empty",
        id: "entry-empty",
        kind: "PROJECT",
        title: "",
        organization: null,
        location: null,
        startDate: null,
        endDate: null,
        isCurrent: false,
        url: null,
        bullets: [],
      },
    ],
    skills: [
      { ref: "S_ts", id: "s-ts", name: "TypeScript", category: "Languages" },
      { ref: "S_react", id: "s-react", name: "React", category: "Frameworks" },
      { ref: "S_pg", id: "s-pg", name: "PostgreSQL", category: "Data" },
      { ref: "S_ml", id: "s-ml", name: "Machine learning", category: "Data" },
    ],
  };
}

export function scenarioAnalysis(): JobAnalysis {
  return {
    title: "Software Developer",
    company: "Northwind",
    location: "Ottawa, ON",
    seniority: "mid",
    workMode: "UNKNOWN",
    employmentType: null,
    salary: null,
    referenceNumber: null,
    summary: "A software role.",
    requirements,
    keywords: ["TypeScript", "Next.js", "PostgreSQL", "React", "Machine learning"],
  };
}

/** Omits the current role, leads with the internship, and repeats the degree. */
export function scenarioOutput(): TailorOutput {
  return {
    summary: "Software developer with project work in TypeScript.",
    entries: [
      {
        ref: "E_def",
        bullets: [
          {
            sourceRefs: ["E_def.B1"],
            text: "Assisted with workshop logistics for a student hackathon.",
          },
        ],
      },
      {
        ref: "E_cnn",
        bullets: [
          {
            sourceRefs: ["E_cnn.B1"],
            text: "Trained a machine learning model for a university course.",
          },
        ],
      },
      {
        ref: "E_role",
        bullets: [
          {
            sourceRefs: ["E_role.B1"],
            text: "Responsible for various project tasks.",
          },
        ],
      },
      {
        ref: "E_degree_dup",
        bullets: [
          {
            sourceRefs: ["E_degree_dup.B1"],
            text: "Studied computer science.",
          },
        ],
      },
      {
        ref: "E_degree",
        bullets: [
          {
            sourceRefs: ["E_degree.B1"],
            text: "Completed the honours project in computer science.",
          },
        ],
      },
    ],
    skills: [],
    requirementMatches: [
      {
        requirementId: "r1",
        verdict: "partial",
        evidenceRefs: ["E_role.B2"],
        note: "TypeScript appears on a project.",
      },
      {
        requirementId: "r2",
        verdict: "partial",
        evidenceRefs: ["S_react"],
        note: "React is in the library.",
      },
    ],
  };
}
