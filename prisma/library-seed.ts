/**
 * Dev-only fake library for `prisma/seed.ts`.
 * Jobs and the rest of the seed are added in later tasks.
 * Bullet tiers are checked in tests/unit/library-seed.test.ts.
 */

export const SEED_LIBRARY = {
  profile: {
    fullName: "Avery Lang",
    headline: "Product designer",
    phone: "416-555-0198",
    location: "Toronto, ON",
    summary:
      "Product designer who turns research into shipped interfaces for public services and consumer products. Comfortable pairing with engineers in React and presenting findings to non-design partners.",
    links: [
      { label: "Portfolio", url: "https://averylang.example" },
      { label: "LinkedIn", url: "https://linkedin.example/in/avery-lang" },
    ],
  },
  entries: [
    {
      kind: "EXPERIENCE",
      title: "Product Designer",
      organization: "Northwind Studio",
      location: "Toronto, ON",
      startDate: "2022-03",
      endDate: null,
      isCurrent: true,
      url: null,
      bullets: [
        {
          text: "Shipped a React checkout that cut drop-off by 18% across three product lines.",
        },
        {
          text: "Responsible for various design tasks and stakeholder updates.",
        },
        {
          text: "Helped the team improve onboarding for new hires last year.",
        },
      ],
    },
    {
      kind: "EXPERIENCE",
      title: "UX Researcher",
      organization: "Harbour & Co",
      location: "Vancouver, BC",
      startDate: "2019-06",
      endDate: "2022-02",
      isCurrent: false,
      url: null,
      bullets: [
        {
          text: "Led weekly research sessions with 24 customers and shared findings with the growth team.",
        },
        {
          text: "Built partner reports every quarter for the sales team.",
        },
      ],
    },
    {
      kind: "EXPERIENCE",
      title: "Design Intern",
      organization: "Maple Goods",
      location: "Ottawa, ON",
      startDate: "2018",
      endDate: "2019",
      isCurrent: false,
      url: null,
      bullets: [
        {
          text: "I helped with tasks.",
        },
      ],
    },
    {
      kind: "PROJECT",
      title: "Trailmark",
      organization: null,
      location: null,
      startDate: "2023-01",
      endDate: "2024-08",
      isCurrent: false,
      url: "https://trailmark.example",
      bullets: [
        {
          text: "Published a React component kit used by 6 product squads in Figma and production.",
        },
      ],
    },
    {
      kind: "PROJECT",
      title: "Civic Hours",
      organization: "Example City",
      location: "Toronto, ON",
      startDate: "2021",
      endDate: null,
      isCurrent: false,
      url: null,
      bullets: [
        {
          text: "Documented the scheduling workflow for volunteers in a shared handbook.",
        },
      ],
    },
    {
      kind: "EDUCATION",
      title: "Bachelor of Design",
      organization: "Lakeshore College of Art",
      location: "Toronto, ON",
      startDate: "2014",
      endDate: "2018",
      isCurrent: false,
      url: null,
      bullets: [
        {
          text: "Completed a thesis on public service design for a municipal client.",
        },
      ],
    },
  ],
  skills: [
    { name: "TypeScript", category: "Languages" },
    { name: "Python", category: "Languages" },
    { name: "SQL", category: "Languages" },
    { name: "React", category: "Frameworks" },
    { name: "Next.js", category: "Frameworks" },
    { name: "Figma", category: "Tools" },
    { name: "Git", category: "Tools" },
    { name: "Docker", category: "Tools" },
    { name: "AWS", category: "Cloud" },
    { name: "PostgreSQL", category: "Data" },
    { name: "Tableau", category: "Data" },
    { name: "Excel", category: "Data" },
    { name: "Mentoring", category: "Soft skills" },
    { name: "Stakeholder communication", category: "Soft skills" },
    { name: "Writing", category: null },
  ],
} as const;
