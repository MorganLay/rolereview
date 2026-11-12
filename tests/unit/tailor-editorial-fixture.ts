/**
 * Regression library for editorial selection. The person and the bullets are fictional.
 * Employer names exercise identity, not a special case in the composer.
 */

import type { JobAnalysis } from "@/features/jobs/schemas";
import type { LibrarySnapshot } from "@/features/library/schemas";
import type { CareerConfirmation } from "@/features/tailor/canonical";
import type { TailorOutput } from "@/features/tailor/schemas";

type Entry = LibrarySnapshot["entries"][number];

const takenAt = "2026-11-12T00:00:00.000Z";

function bullet(ref: string, text: string): Entry["bullets"][number] {
  return { ref, id: ref, text };
}

function row(partial: Pick<Entry, "ref" | "kind" | "title"> & Partial<Entry>): Entry {
  return {
    id: partial.ref,
    organization: null,
    location: null,
    startDate: null,
    endDate: null,
    isCurrent: false,
    url: null,
    bullets: [],
    ...partial,
  };
}

export function editorialSnapshot(): LibrarySnapshot {
  return {
    takenAt,
    profile: {
      fullName: "Morgan Example",
      headline: "Software developer",
      email: "morgan@example.com",
      phone: null,
      location: "Ottawa, ON",
      links: [{ label: "GitHub", url: "https://github.com/morgan-example" }],
      summary: "Software developer who builds small tools.",
    },
    entries: [
      row({
        ref: "E_cra",
        kind: "EXPERIENCE",
        title: "Junior Program Officer",
        organization: "Canada Revenue Agency",
        location: "Ottawa, ON",
        startDate: "2023-11",
        isCurrent: true,
        bullets: [
          bullet(
            "E_cra.B1",
            "Automated the monthly reconciliation and saved 20 hours a week with Excel VBA.",
          ),
          bullet("E_cra.B2", "Wrote SQL extracts for business-returns reports."),
        ],
      }),
      row({
        ref: "E_cra_long",
        kind: "EXPERIENCE",
        title: "Junior Program Officer, Special Business Returns Processing",
        organization: "CRA",
        location: "Ottawa, ON",
        startDate: "2023-11",
        isCurrent: true,
        bullets: [
          bullet(
            "E_cra_long.B1",
            "Saved 20 hours each week by automating reconciliation in a workbook.",
          ),
          bullet(
            "E_cra_long.B2",
            "Reconciled special business returns against the source files.",
          ),
        ],
      }),
      row({
        ref: "E_def",
        kind: "EXPERIENCE",
        title: "Full-Stack Developer Intern",
        organization: "Def Hacks",
        startDate: "2020-03",
        endDate: "2021-03",
        bullets: [bullet("E_def.B1", "Built a React registration form and tested the API.")],
      }),
      row({
        ref: "E_def_copy",
        kind: "EXPERIENCE",
        title: "Full Stack Developer Intern",
        organization: "Defhacks.co",
        startDate: "2020-11",
        endDate: "2021-03",
        bullets: [bullet("E_def_copy.B1", "Tested the registration API with Jest.")],
      }),
      row({
        ref: "E_lcbo",
        kind: "EXPERIENCE",
        title: "Sales Associate",
        organization: "LCBO",
        startDate: "2018-05",
        endDate: "2019-08",
        bullets: [
          bullet("E_lcbo.B1", "Greeted customers and operated the cash register during retail shifts."),
        ],
      }),
      row({
        ref: "E_role",
        kind: "PROJECT",
        title: "Creator, Product Owner, Full-Stack Developer",
        organization: "RoleRefine",
        startDate: "2025-11",
        isCurrent: true,
        bullets: [
          bullet("E_role.B1", "Built the resume editor in TypeScript and React."),
          bullet("E_role.B2", "Stored application records in PostgreSQL and tested the API."),
        ],
      }),
      row({
        ref: "E_forge",
        kind: "PROJECT",
        title: "AI Job Forge",
        startDate: "2024-01",
        endDate: "2024-06",
        bullets: [bullet("E_forge.B1", "Prototyped a parser and later continued it as Jobwise.")],
      }),
      row({
        ref: "E_jobwise",
        kind: "PROJECT",
        title: "Jobwise",
        startDate: "2024-06",
        endDate: "2024-12",
        url: "https://jobwise.example",
        bullets: [bullet("E_jobwise.B1", "Hosted the AI Job Forge parser for sample postings.")],
      }),
      row({
        ref: "E_py",
        kind: "PROJECT",
        title: "Survey cleanup",
        startDate: "2024-02",
        endDate: "2024-04",
        bullets: [
          bullet("E_py.B1", "Cleaned survey files with Python and pandas and loaded them into PostgreSQL."),
        ],
      }),
      row({
        ref: "E_degree",
        kind: "EDUCATION",
        title: "Bachelor of Computer Science",
        organization: "Carleton University",
        startDate: "2019-09",
        endDate: "2024-06",
        bullets: [bullet("E_degree.B1", "Completed a computer science degree.")],
      }),
    ],
    skills: [
      { ref: "S_py", id: "s-py", name: "Python", category: "Languages" },
      { ref: "S_sql", id: "s-sql", name: "SQL", category: "Data" },
      { ref: "S_xl", id: "s-xl", name: "Excel", category: "Data" },
      { ref: "S_ts", id: "s-ts", name: "TypeScript", category: "Languages" },
      { ref: "S_react", id: "s-react", name: "React", category: "Frameworks" },
      { ref: "S_maps", id: "s-maps", name: "Google Maps API", category: "Tools" },
    ],
  };
}

export const defHacksConfirmation: CareerConfirmation = {
  members: ["E_def", "E_def_copy"],
  title: "Full-Stack Developer Intern",
  organization: "Def Hacks",
  startDate: "2020-03",
  endDate: "2021-03",
  isCurrent: false,
};

function analysis(partial: Pick<JobAnalysis, "title" | "company" | "requirements" | "keywords">): JobAnalysis {
  return {
    title: partial.title,
    company: partial.company,
    location: "Ottawa, ON",
    seniority: "entry",
    workMode: "UNKNOWN",
    employmentType: null,
    salary: null,
    referenceNumber: null,
    summary: partial.title,
    requirements: partial.requirements,
    keywords: partial.keywords,
  };
}

export function dataEngineerAnalysis(): JobAnalysis {
  return analysis({
    title: "Data Engineer",
    company: "MindBridge",
    requirements: [
      { id: "r1", text: "SQL for reporting and extracts", kind: "skill", importance: "must" },
      { id: "r2", text: "Python for data processing", kind: "skill", importance: "must" },
      { id: "r3", text: "Excel reconciliation", kind: "experience", importance: "must" },
      { id: "r4", text: "Enterprise ETL pipelines", kind: "experience", importance: "nice" },
      { id: "r5", text: "ERP implementation", kind: "experience", importance: "nice" },
    ],
    keywords: ["SQL", "Python", "Excel", "VBA", "PostgreSQL", "pandas", "ETL", "ERP", "Google Maps"],
  });
}

export function intuitAnalysis(): JobAnalysis {
  return analysis({
    title: "Software Developer 1",
    company: "Intuit",
    requirements: [
      { id: "r1", text: "TypeScript application development", kind: "skill", importance: "must" },
      { id: "r2", text: "React interfaces", kind: "skill", importance: "must" },
      { id: "r3", text: "API testing and debugging", kind: "experience", importance: "must" },
    ],
    keywords: ["TypeScript", "React", "API", "testing", "PostgreSQL"],
  });
}

export function retailAnalysis(): JobAnalysis {
  return analysis({
    title: "Retail Associate",
    company: "Harbor Market",
    requirements: [
      { id: "r1", text: "Operate a cash register", kind: "experience", importance: "must" },
      { id: "r2", text: "Serve customers on the floor", kind: "experience", importance: "must" },
    ],
    keywords: ["register", "customers", "retail"],
  });
}

function line(ref: string, sourceRefs: string[], text: string): TailorOutput["entries"][number]["bullets"][number] {
  return { sourceRefs, text };
}

export function stuffedDataOutput(): TailorOutput {
  return {
    summary: "Data engineer with enterprise ETL experience.",
    plan: {
      narrative: "Reporting work and a Python cleanup project support this role.",
      priorities: ["SQL", "Python", "Excel reconciliation"],
      gaps: ["Enterprise ETL pipelines", "ERP implementation"],
      hiringFor: "Build and reconcile data used by the team.",
      positioning: "Reporting officer with hands-on data cleanup.",
      headline: "Reporting and reconciliation",
      qualifications: [
        { requirementId: "r1", weight: "mandatory" },
        { requirementId: "r2", weight: "mandatory" },
        { requirementId: "r3", weight: "mandatory" },
      ],
      evidence: [
        { ref: "E_cra", use: "lead", bullets: 3, because: "It is the only professional evidence for SQL, Excel, and reconciliation." },
        { ref: "E_py", use: "support", bullets: 1, because: "It is the direct Python data work and Survey cleanup is stronger for this job than the SaaS projects." },
        { ref: "E_role", use: "support", bullets: 1, because: "PostgreSQL is relevant, and RoleRefine adds less than the Python cleanup." },
        { ref: "E_def", use: "support", bullets: 1, because: "The internship shows testing, which the data work does not." },
        { ref: "E_lcbo", use: "omit", bullets: 0, because: "Retail cash work does not strengthen a data engineering application." },
        { ref: "E_forge", use: "omit", bullets: 0, because: "Jobwise is the later iteration, and neither parser shows data processing." },
        { ref: "E_jobwise", use: "omit", bullets: 0, because: "The parser repeats AI Job Forge and does not show SQL or Python processing." },
      ],
      closeCall: false,
    },
    entries: [
      {
        ref: "E_cra",
        bullets: [
          line("b", ["E_cra.B1"], "Delivered enterprise ETL pipelines and ERP implementations that saved 20 hours."),
          line("b2", ["E_cra.B2"], "Wrote SQL extracts for business-returns reports."),
        ],
      },
      {
        ref: "E_cra_long",
        bullets: [
          line("b3", ["E_cra_long.B1"], "Saved 20 hours each week by automating reconciliation in a workbook."),
          line("b4", ["E_cra_long.B2"], "Reconciled special business returns against the source files."),
        ],
      },
      {
        ref: "E_def",
        bullets: [line("b5", ["E_def.B1"], "Built a React registration form and tested the API.")],
      },
      {
        ref: "E_def_copy",
        bullets: [line("b6", ["E_def_copy.B1"], "Tested the registration API with Jest.")],
      },
      {
        ref: "E_lcbo",
        bullets: [line("b7", ["E_lcbo.B1"], "Greeted customers and operated the cash register during retail shifts.")],
      },
      {
        ref: "E_role",
        bullets: [line("b8", ["E_role.B2"], "Stored application records in PostgreSQL and tested the API.")],
      },
      {
        ref: "E_forge",
        bullets: [line("b9", ["E_forge.B1"], "Prototyped a parser and later continued it as Jobwise.")],
      },
      {
        ref: "E_jobwise",
        bullets: [line("b10", ["E_jobwise.B1"], "Hosted the AI Job Forge parser for sample postings.")],
      },
      {
        ref: "E_py",
        bullets: [
          line(
            "b11",
            ["E_py.B1"],
            "Cleaned survey files with Python and pandas and loaded them into PostgreSQL.",
          ),
        ],
      },
      { ref: "E_degree", bullets: [] },
    ],
    skills: [
      { category: "Tools", refs: ["S_maps"] },
      { category: "Data", refs: ["S_sql", "S_py"] },
    ],
    requirementMatches: ["r1", "r2", "r3", "r4", "r5"].map((id) => ({
      requirementId: id,
      verdict: "partial" as const,
      evidenceRefs: ["E_cra.B2"],
      note: "Checked against the library.",
    })),
  };
}

export function intuitOutput(): TailorOutput {
  const stuffed = stuffedDataOutput();
  return {
    ...stuffed,
    summary: "Developer who builds TypeScript and React applications.",
    plan: {
      narrative: "RoleRefine is the strongest application evidence for this posting.",
      priorities: ["TypeScript", "React", "API testing"],
      gaps: [],
      hiringFor: "Build and test application features.",
      positioning: "Project developer with tested web applications.",
      headline: "Application developer",
      qualifications: [
        { requirementId: "r1", weight: "mandatory" },
        { requirementId: "r2", weight: "mandatory" },
      ],
      evidence: [
        { ref: "E_role", use: "lead", bullets: 2, because: "RoleRefine is the deepest TypeScript and React evidence." },
        { ref: "E_def", use: "support", bullets: 2, because: "The internship adds API testing the tax role does not." },
        { ref: "E_cra", use: "support", bullets: 1, because: "The officer role shows careful data work, not application tenure." },
        { ref: "E_jobwise", use: "support", bullets: 1, because: "Jobwise is the later product. AI Job Forge is the same line of work." },
        { ref: "E_forge", use: "omit", bullets: 0, because: "AI Job Forge is the earlier iteration of Jobwise." },
        { ref: "E_lcbo", use: "omit", bullets: 0, because: "Retail shifts do not show application development." },
        { ref: "E_py", use: "omit", bullets: 0, because: "The survey script does not show the application work RoleRefine already covers." },
      ],
      closeCall: false,
    },
  };
}

export function retailOutput(): TailorOutput {
  return {
    summary: "Retail associate who has run a cash register.",
    plan: {
      narrative: "The LCBO role is the direct evidence for this posting.",
      priorities: ["cash register", "customers"],
      gaps: [],
      hiringFor: "Serve customers and run the register.",
      positioning: "Retail associate.",
      headline: "Store operations",
      qualifications: [{ requirementId: "r1", weight: "mandatory" }],
      evidence: [
        { ref: "E_lcbo", use: "lead", bullets: 1, because: "It is the only evidence of register work and customer-facing retail shifts." },
        { ref: "E_cra", use: "omit", bullets: 0, because: "Tax processing does not show the retail floor." },
        { ref: "E_role", use: "omit", bullets: 0, because: "The software project does not show register work." },
      ],
      closeCall: false,
    },
    entries: [
      {
        ref: "E_lcbo",
        bullets: [line("b", ["E_lcbo.B1"], "Greeted customers and operated the cash register during retail shifts.")],
      },
    ],
    skills: [],
    requirementMatches: [
      {
        requirementId: "r1",
        verdict: "met",
        evidenceRefs: ["E_lcbo.B1"],
        note: "The retail role ran a register.",
      },
      {
        requirementId: "r2",
        verdict: "partial",
        evidenceRefs: ["E_lcbo.B1"],
        note: "The same role served customers.",
      },
    ],
  };
}
