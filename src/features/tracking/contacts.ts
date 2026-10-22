/**
 * Contacts and outreach. docs/04-DATA-MODEL.md → Contact fields.
 * `lastContactedAt` is the latest follow-up instant for that person, or null.
 */

export const CONTACT_ROLES = [
  "RECRUITER",
  "HIRING_MANAGER",
  "REFERRER",
  "INTERVIEWER",
  "PEER",
  "OTHER",
] as const;

export type ContactRoleName = (typeof CONTACT_ROLES)[number];

/** Caps: docs/04-DATA-MODEL.md → Contact fields. */
export const CONTACT_LIMITS = {
  name: 120,
  title: 120,
  company: 120,
  email: 200,
  phone: 40,
  linkedinUrl: 300,
  notes: 5_000,
  search: 120,
} as const;

export function isContactRole(value: string): value is ContactRoleName {
  return (CONTACT_ROLES as readonly string[]).includes(value);
}

export function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/** Latest follow-up instant. An empty list means the person has not been contacted. */
export function latestContactedAt(occurredAts: readonly Date[]): Date | null {
  let latest: Date | null = null;
  for (const at of occurredAts) {
    if (latest === null || at.getTime() > latest.getTime()) latest = at;
  }
  return latest;
}

export type ContactSearchFields = {
  name: string;
  title: string | null;
  company: string | null;
  email: string | null;
};

/** Case-insensitive match on name, title, company, or email. A blank query matches everyone. */
export function matchesContactSearch(contact: ContactSearchFields, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return true;
  const haystack = [contact.name, contact.title, contact.company, contact.email]
    .filter((part): part is string => part !== null && part.length > 0)
    .join("\n")
    .toLocaleLowerCase();
  return haystack.includes(needle);
}

export type JobContactView = {
  id: string;
  name: string;
  title: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  notes: string | null;
  role: ContactRoleName;
  lastContactedLabel: string | null;
};

export type ContactPick = {
  id: string;
  name: string;
  title: string | null;
  company: string | null;
};

export type ContactJobChip = {
  id: string;
  title: string;
  company: string;
  role: ContactRoleName;
};

export type OutreachView = {
  id: string;
  jobId: string;
  jobLabel: string;
  details: string | null;
  whenLabel: string;
  occurredAt: string;
};

export type ContactListItem = {
  id: string;
  name: string;
  title: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  notes: string | null;
  lastContactedLabel: string | null;
  jobs: ContactJobChip[];
  outreach: OutreachView[];
};

export function compareContactNames(
  a: { name: string; id: string },
  b: { name: string; id: string },
): number {
  const byName = a.name.localeCompare(b.name, "en-CA", { sensitivity: "base" });
  if (byName !== 0) return byName;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}
