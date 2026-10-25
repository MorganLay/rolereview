import { randomUUID } from "node:crypto";

import { Client } from "pg";

import { envValue } from "./env";

export type OverflowFixtures = {
  jobId: string;
  resumeId: string;
  letterId: string;
};

const snapshot = {
  takenAt: "2026-10-25T12:00:00.000Z",
  profile: {
    fullName: "Ada Example",
    headline: "Product designer",
    email: "ada@example.com",
    phone: null,
    location: "Ottawa",
    links: [],
    summary: "Designs product flows.",
  },
  entries: [
    {
      ref: "E1",
      id: "00000000-0000-4000-8000-000000000001",
      kind: "EXPERIENCE",
      title: "Product designer",
      organization: "Northwind",
      location: "Ottawa",
      startDate: "2020",
      endDate: null,
      isCurrent: true,
      url: null,
      bullets: [
        {
          ref: "E1.B1",
          id: "00000000-0000-4000-8000-000000000002",
          text: "Shipped a checkout flow used by 12 teams.",
        },
      ],
    },
  ],
  skills: [
    {
      ref: "S1",
      id: "00000000-0000-4000-8000-000000000003",
      name: "Figma",
      category: "Tools",
    },
  ],
};

const resumeContent = {
  schemaVersion: 1,
  summary: { text: "Designs product flows.", included: true },
  entries: [
    {
      ref: "E1",
      kind: "EXPERIENCE",
      included: true,
      bullets: [
        {
          id: "b1",
          text: "Shipped a checkout flow used by 12 teams.",
          included: true,
          sourceRefs: ["E1.B1"],
          reverted: false,
          edited: false,
        },
      ],
    },
  ],
  skills: [{ category: "Tools", names: ["Figma"] }],
};

const letterContent = {
  schemaVersion: 1,
  greeting: "Hello,",
  paragraphs: [
    {
      id: "p1",
      text: "I am writing about the product designer role.",
      included: true,
      sourceRefs: ["E1"],
      reverted: false,
      edited: false,
      needsWhy: false,
    },
  ],
  closing: "Thank you,",
  signature: "Ada Example",
  requirementIdsAddressed: [],
};

/** Minimal rows so job, resume, letter, library, and contacts routes render. */
export async function seedOverflowFixtures(userId: string): Promise<OverflowFixtures> {
  const direct = envValue("DIRECT_URL");
  if (!direct) throw new Error("Overflow check needs DIRECT_URL.");

  const jobId = randomUUID();
  const resumeId = randomUUID();
  const letterId = randomUUID();
  const entryId = randomUUID();
  const client = new Client({ connectionString: direct });
  await client.connect();
  try {
    await insertRows(client, { userId, jobId, resumeId, letterId, entryId });
  } finally {
    await client.end();
  }
  return { jobId, resumeId, letterId };
}

async function insertRows(
  client: Client,
  ids: OverflowFixtures & { userId: string; entryId: string },
): Promise<void> {
  const longUrl = `https://jobs.example.com/${"department/".repeat(12)}product-designer`;
  await client.query("BEGIN");
  try {
    await client.query(
      `INSERT INTO "Job"
        (id, "userId", title, company, url, "rawText", "analysisStatus", "workMode", status, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, 'FAILED', 'UNKNOWN', 'SAVED', NOW(), NOW())`,
      [
        ids.jobId,
        ids.userId,
        "Product designer",
        "Northwind Analytics",
        longUrl,
        "We are hiring a product designer in Ottawa.",
      ],
    );
    await client.query(
      `INSERT INTO "TailoredResume"
        (id, "userId", "jobId", version, status, options, "librarySnapshot", content, "templateId", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 1, 'READY', '{}'::jsonb, $4::jsonb, $5::jsonb, 'classic', NOW(), NOW())`,
      [ids.resumeId, ids.userId, ids.jobId, JSON.stringify(snapshot), JSON.stringify(resumeContent)],
    );
    await client.query(
      `INSERT INTO "CoverLetter"
        (id, "userId", "jobId", version, status, options, "librarySnapshot", content, "templateId", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 1, 'READY', '{}'::jsonb, $4::jsonb, $5::jsonb, 'classic', NOW(), NOW())`,
      [ids.letterId, ids.userId, ids.jobId, JSON.stringify(snapshot), JSON.stringify(letterContent)],
    );
    await client.query(
      `INSERT INTO "Contact" (id, "userId", name, title, company, email, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
      [
        randomUUID(),
        ids.userId,
        "Riley Chen",
        "Hiring manager",
        "Northwind Analytics",
        "riley.chen.recruiting.coordinator@northwind-analytics.example.com",
      ],
    );
    await client.query(
      `INSERT INTO "Entry"
        (id, "userId", kind, title, organization, "startDate", "isCurrent", "sortOrder", "createdAt", "updatedAt")
       VALUES ($1, $2, 'EXPERIENCE', $3, $4, '2020', true, 0, NOW(), NOW())`,
      [ids.entryId, ids.userId, "Product designer", "Northwind Analytics"],
    );
    await client.query(
      `INSERT INTO "Bullet" (id, "userId", "entryId", text, "sortOrder", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 0, NOW(), NOW())`,
      [
        randomUUID(),
        ids.userId,
        ids.entryId,
        "Shipped a checkout flow used by 12 teams.",
      ],
    );
    await client.query(
      `INSERT INTO "Skill" (id, "userId", name, "nameKey", category, "sortOrder")
       VALUES ($1, $2, 'Figma', 'figma', 'Tools', 0)`,
      [randomUUID(), ids.userId],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}
