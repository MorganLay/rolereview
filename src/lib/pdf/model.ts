/**
 * Included resume content in section order, for every PDF template.
 * Titles, employers, and dates come from the library snapshot.
 * docs/04-DATA-MODEL.md → ResumeContent. docs/05-AI.md → Plain text.
 */

import { strings } from "@/copy/strings";
import { formatResumeDateRange } from "@/features/library/dates";
import type { LibrarySnapshot } from "@/features/library/schemas";
import { shownEntry, shownHeadline } from "@/features/tailor/presentation";
import { resumeContactLinks, resumeSectionOrder } from "@/features/tailor/resume-shape";
import { groupedSkillLines } from "@/features/tailor/skill-groups";
import type { ContentEntry, ResumeContent } from "@/features/tailor/schemas";

const SEPARATOR = " \u00b7 ";

const SECTION_LABEL: Record<LibrarySnapshot["entries"][number]["kind"], string> = {
  EXPERIENCE: "Experience",
  PROJECT: "Projects",
  EDUCATION: "Education",
  CERTIFICATION: "Certifications",
  VOLUNTEER: "Volunteer",
  OTHER: "Other",
};

type SnapshotEntry = LibrarySnapshot["entries"][number];

export type ResumePdfEntry = {
  title: string | null;
  /** Organization, location, and dates, for plain text. */
  meta: string | null;
  /** Organization and location, without the date. */
  detail?: string | null;
  dates?: string | null;
  url: string | null;
  bullets: string[];
};

export type ResumePdfSection = {
  heading: string;
  entries: ResumePdfEntry[];
};

export type ResumePdfModel = {
  name: string | null;
  headline: string | null;
  contact: string | null;
  links: string[];
  summary: string | null;
  sections: ResumePdfSection[];
  skills: string[];
};

export function resumePdfModel(
  content: ResumeContent,
  snapshot: LibrarySnapshot,
): ResumePdfModel {
  const { profile } = snapshot;
  const contact = [clean(profile.location), clean(profile.email), clean(profile.phone)]
    .filter((part) => part !== null)
    .join(SEPARATOR);

  const byRef = new Map(snapshot.entries.map((entry) => [entry.ref, entry]));
  const sections: ResumePdfSection[] = [];
  for (const kind of resumeSectionOrder(content.sectionOrder)) {
    const entries = content.entries
      .filter((entry) => entry.kind === kind && entry.included)
      .map((entry) => entryBlock(entry, byRef.get(entry.ref)))
      .filter((entry) => entry !== null);
    if (entries.length === 0) continue;
    sections.push({ heading: SECTION_LABEL[kind], entries });
  }

  return {
    name: clean(profile.fullName),
    headline: shownHeadline(content, profile),
    contact: contact.length > 0 ? contact : null,
    links: resumeContactLinks(content, profile)
      .map(linkLine)
      .filter((line) => line !== null),
    summary: content.summary.included ? clean(content.summary.text) : null,
    sections,
    skills: skillLines(content),
  };
}

/** Reading order. The PDF templates render these strings and nothing else. */
export function resumePdfLines(model: ResumePdfModel): string[] {
  const lines: string[] = [];
  if (model.name) lines.push(model.name);
  if (model.headline) lines.push(model.headline);
  if (model.contact) lines.push(model.contact);
  lines.push(...model.links);
  if (model.summary) lines.push("Summary", model.summary);
  for (const section of model.sections) {
    lines.push(section.heading);
    for (const entry of section.entries) {
      if (entry.title) lines.push(entry.title);
      if (entry.meta) lines.push(entry.meta);
      if (entry.url) lines.push(entry.url);
      for (const bullet of entry.bullets) lines.push(`- ${bullet}`);
    }
  }
  if (model.skills.length > 0) lines.push("Skills", ...model.skills);
  return lines;
}

function entryBlock(
  entry: ContentEntry,
  snapshotEntry: SnapshotEntry | undefined,
): ResumePdfEntry | null {
  if (!snapshotEntry) return null;
  const shown = shownEntry(entry, snapshotEntry);
  const title = clean(shown.title);
  const dates = dateLabel(shown);
  const detailParts = [clean(shown.organization), clean(shown.location)].filter(
    (part) => part !== null,
  );
  const metaParts = [...detailParts, dates].filter((part) => part !== null);
  const bullets = entry.bullets
    .filter((bullet) => bullet.included)
    .map((bullet) => bullet.text.replace(/\s+/g, " ").trim())
    .filter((text) => text.length > 0);
  const url = httpUrl(snapshotEntry.url);
  if (!title && metaParts.length === 0 && !url && bullets.length === 0) return null;
  return {
    title,
    meta: metaParts.length > 0 ? metaParts.join(SEPARATOR) : null,
    detail: detailParts.length > 0 ? detailParts.join(SEPARATOR) : null,
    dates,
    url,
    bullets,
  };
}

function dateLabel(entry: {
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
}): string | null {
  return formatResumeDateRange(
    entry.startDate,
    entry.endDate,
    entry.isCurrent,
    strings.library.entries.present,
  );
}

function skillLines(content: ResumeContent): string[] {
  return groupedSkillLines(content.skills);
}

function linkLine(link: LibrarySnapshot["profile"]["links"][number]): string | null {
  const url = httpUrl(link.url);
  if (!url) return null;
  const label = link.label.trim();
  return label.length > 0 ? `${label}: ${url}` : url;
}

function httpUrl(value: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  if (trimmed.length === 0) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol === "http:" || url.protocol === "https:") return trimmed;
  } catch {
    return null;
  }
  return null;
}

function clean(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length === 0 ? null : trimmed;
}
