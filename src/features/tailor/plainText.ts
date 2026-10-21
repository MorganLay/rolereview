/**
 * Plain-text resume for application forms.
 * docs/05-AI.md → Plain text. Included content only, no RoleRefine branding.
 */

import { ENTRY_KINDS, type LibrarySnapshot } from "@/features/library/schemas";

import type { ContentEntry, ResumeContent } from "./schemas";

const EN_DASH = "\u2013";
const SEPARATOR = " \u00b7 ";

const SECTION_LABEL: Record<
  LibrarySnapshot["entries"][number]["kind"],
  string
> = {
  EXPERIENCE: "Experience",
  PROJECT: "Projects",
  EDUCATION: "Education",
  CERTIFICATION: "Certifications",
  VOLUNTEER: "Volunteer",
  OTHER: "Other",
};

type SnapshotEntry = LibrarySnapshot["entries"][number];

export function resumePlainText(
  content: ResumeContent,
  snapshot: LibrarySnapshot,
): string {
  const blocks: string[] = [];
  const header = headerBlock(snapshot);
  if (header) blocks.push(header);

  const summary = clean(content.summary.included ? content.summary.text : null);
  if (summary) blocks.push(`Summary\n${summary}`);

  const byRef = new Map(snapshot.entries.map((entry) => [entry.ref, entry]));
  for (const kind of ENTRY_KINDS) {
    const entries = content.entries.filter(
      (entry) => entry.kind === kind && entry.included,
    );
    const body = entries
      .map((entry) => entryBlock(entry, byRef.get(entry.ref)))
      .filter((block) => block.length > 0);
    if (body.length === 0) continue;
    blocks.push(`${SECTION_LABEL[kind]}\n${body.join("\n\n")}`);
  }

  const skills = skillsBlock(content);
  if (skills) blocks.push(skills);

  return blocks.join("\n\n");
}

function headerBlock(snapshot: LibrarySnapshot): string | null {
  const { profile } = snapshot;
  const lines: string[] = [];
  const name = clean(profile.fullName);
  const headline = clean(profile.headline);
  if (name) lines.push(name);
  if (headline) lines.push(headline);

  const contact = [clean(profile.location), clean(profile.email), clean(profile.phone)]
    .filter((part) => part !== null)
    .join(SEPARATOR);
  if (contact.length > 0) lines.push(contact);

  for (const link of profile.links) {
    const label = link.label.trim();
    const url = link.url.trim();
    if (label.length > 0 && url.length > 0) lines.push(`${label}: ${url}`);
    else if (url.length > 0) lines.push(url);
  }

  return lines.length > 0 ? lines.join("\n") : null;
}

function entryBlock(
  entry: ContentEntry,
  snapshotEntry: SnapshotEntry | undefined,
): string {
  if (!snapshotEntry) return "";
  const lines: string[] = [];
  const title = clean(snapshotEntry.title);
  if (title) lines.push(title);

  const meta = [
    clean(snapshotEntry.organization),
    clean(snapshotEntry.location),
    dateLabel(snapshotEntry),
  ].filter((part) => part !== null && part.length > 0);
  if (meta.length > 0) lines.push(meta.join(SEPARATOR));

  for (const bullet of entry.bullets) {
    if (!bullet.included) continue;
    const text = bullet.text.replace(/\s+/g, " ").trim();
    if (text.length > 0) lines.push(`- ${text}`);
  }

  return lines.join("\n");
}

function skillsBlock(content: ResumeContent): string | null {
  const lines: string[] = [];
  for (const group of content.skills) {
    const names = group.names.map((name) => name.trim()).filter((name) => name.length > 0);
    if (names.length === 0) continue;
    const category = group.category?.trim() ?? "";
    lines.push(category.length > 0 ? `${category}: ${names.join(", ")}` : names.join(", "));
  }
  return lines.length > 0 ? `Skills\n${lines.join("\n")}` : null;
}

function dateLabel(entry: SnapshotEntry): string | null {
  const start = clean(entry.startDate);
  const end = entry.isCurrent ? "Present" : clean(entry.endDate);
  if (start && end) return `${start} ${EN_DASH} ${end}`;
  if (!start && end && !entry.isCurrent) return `${EN_DASH} ${end}`;
  return start ?? end;
}

function clean(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
