/**
 * W4 print. One credential line, with the school and year the library has.
 * Experience can put the employer and dates on the title line.
 */
import type { LibrarySnapshot } from "@/features/library/schemas";
import { resumePdfLines, type ResumePdfModel } from "@/lib/pdf/model";
import type { ResumeContent } from "@/features/tailor/schemas";

import { presentW3 } from "./w3-display";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function presentW4(
  content: ResumeContent,
  snapshot: LibrarySnapshot,
  options?: { compactExperience?: boolean },
): ResumePdfModel {
  const model = presentW3(content, snapshot);
  const included = new Set(content.entries.filter((entry) => entry.included).map((entry) => entry.ref));
  for (const section of model.sections) {
    if (section.heading === "Education") replaceCredentials(section, snapshot, included, "EDUCATION");
    if (section.heading === "Certifications") replaceCredentials(section, snapshot, included, "CERTIFICATION");
    if (options?.compactExperience && section.heading === "Experience") compactExperience(section);
  }
  return model;
}

export function presentW4Text(
  content: ResumeContent,
  snapshot: LibrarySnapshot,
  options?: { compactExperience?: boolean },
): string {
  return resumePdfLines(presentW4(content, snapshot, options)).join("\n");
}

/** Degree, school, and year from one library entry. A restated title is not a second line. */
export function credentialLine(entry: LibrarySnapshot["entries"][number]): string {
  const title = entry.title.replace(/\s+/g, " ").trim();
  const school = entry.organization?.replace(/\s+/g, " ").trim() ?? "";
  const year = yearLabel(entry.endDate ?? entry.startDate);
  const parts = [title];
  if (school.length > 0 && !title.toLowerCase().includes(school.toLowerCase())) parts.push(school);
  if (year.length > 0 && !title.includes(year)) parts.push(year);
  return parts.filter((part) => part.length > 0).join(", ");
}

function replaceCredentials(
  section: ResumePdfModel["sections"][number],
  snapshot: LibrarySnapshot,
  included: Set<string>,
  kind: "EDUCATION" | "CERTIFICATION",
): void {
  const seen = new Set<string>();
  const entries: ResumePdfModel["sections"][number]["entries"] = [];
  for (const source of snapshot.entries) {
    if (source.kind !== kind || !included.has(source.ref)) continue;
    const title = credentialLine(source);
    const key = title.toLowerCase();
    if (title.length === 0 || seen.has(key)) continue;
    seen.add(key);
    const bullets = source.bullets
      .map((bullet) => bullet.text.replace(/\s+/g, " ").trim())
      .filter((text) => text.length > 0 && !title.toLowerCase().includes(text.toLowerCase()));
    entries.push({ title, meta: null, detail: null, dates: null, url: null, bullets });
  }
  if (entries.length > 0) section.entries = entries;
}

function compactExperience(section: ResumePdfModel["sections"][number]): void {
  for (const entry of section.entries) {
    const bits = [entry.title, entry.detail, entry.dates].filter((bit): bit is string => Boolean(bit && bit.trim().length > 0));
    if (bits.length <= 1) continue;
    entry.title = bits.join(", ");
    entry.detail = null;
    entry.dates = null;
    entry.meta = null;
  }
}

function yearLabel(value: string | null): string {
  if (!value) return "";
  const match = /^((?:19|20)\d{2})(?:-(\d{2}))?/.exec(value);
  if (!match) return "";
  const month = match[2] ? MONTHS[Number(match[2]) - 1] : "";
  return month ? `${month} ${match[1]}` : match[1] ?? "";
}
