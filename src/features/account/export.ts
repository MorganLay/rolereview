/**
 * JSON account export. Pure: dates become ISO strings, bigints become decimal strings.
 * The download is every user-owned row. Lead, FreeToolRun, StripeEvent, and EmailLog stay out.
 */

export const EXPORT_FILENAME = "rolerefine-export.json";

export const ACCOUNT_EXPORT_COLLECTIONS = [
  "entries",
  "bullets",
  "skills",
  "targetProfiles",
  "jobs",
  "jobEvents",
  "interviews",
  "contacts",
  "jobContacts",
  "reminders",
  "offers",
  "tailoredResumes",
  "coverLetters",
  "prepKits",
  "aiCalls",
  "bonusCredits",
  "milestones",
  "referralsMade",
  "feedback",
  "testimonials",
] as const;

export type AccountExportCollection = (typeof ACCOUNT_EXPORT_COLLECTIONS)[number];

export type AccountExportCollections = Record<AccountExportCollection, unknown[]> & {
  referredBy: unknown | null;
};

export type AccountExportInput = {
  exportedAt: Date;
  user: unknown;
  collections: AccountExportCollections;
};

function exportReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  return value;
}

/** Stable key order. Nested dates follow JSON's ISO conversion. */
export function buildAccountExport(input: AccountExportInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    exportedAt: input.exportedAt,
    user: input.user,
    referredBy: input.collections.referredBy,
  };
  for (const key of ACCOUNT_EXPORT_COLLECTIONS) {
    body[key] = input.collections[key];
  }
  return JSON.parse(JSON.stringify(body, exportReplacer)) as Record<string, unknown>;
}
