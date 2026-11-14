/**
 * Turns a plain resume into the same content shape the page fitter measures.
 * Headings are the direct output's own section names: ALL-CAPS or Title Case.
 * A "Title | dates" line, or a title with a year range, starts a role.
 * No PDF import, so the paid runner can save it before the renderer loads.
 */
import type { LibrarySnapshot } from "@/features/library/schemas";
import type { ContentBullet, ContentEntry, ResumeContent } from "@/features/tailor/schemas";

const SECTION =
  /^(?:[a-z]+\s+){0,3}(summary|profile|objective|experience|employment|work history|education|academic background|skills|certifications?|certificates?|licenses?|licences?|projects?|volunteer(?:ing)?|training|qualifications|competencies|activities|affiliations|awards|publications|committee(?:\s+service)?|references)(?:\s+(?:and|&)\s+[a-z][a-z ]*)?$/i;

type Kind = ContentEntry["kind"];

type Section = {
  heading: string;
  kind: Kind;
  summary: boolean;
  lines: string[];
};

export function baselineDocument(text: string): { content: ResumeContent; snapshot: LibrarySnapshot } {
  const sections = parseSections(text);
  const entries: LibrarySnapshot["entries"] = [];
  const summary: string[] = [];
  const preamble = sections.preamble;

  for (const section of sections.sections) {
    if (section.summary) {
      summary.push(...section.lines);
      continue;
    }
    let current: LibrarySnapshot["entries"][number] | null = null;
    if (renderedLabel(section.kind).toLowerCase() !== section.heading.toLowerCase()) {
      current = startEntry(entries, section.kind, section.heading);
    }
    for (const line of section.lines) {
      if (isBullet(line)) {
        if (!current) current = startEntry(entries, section.kind, section.heading);
        pushBullet(current, line.replace(/^[-•*]\s*/, ""));
        continue;
      }
      if (isRoleLine(line, section.kind)) {
        current = startEntry(entries, section.kind, line);
        continue;
      }
      current = startEntry(entries, section.kind, line);
    }
  }

  if (entries.length === 0 && summary.length === 0) {
    const created = startEntry(entries, "EXPERIENCE", preamble[0] ?? "Experience");
    pushBullet(created, text.trim().slice(0, 4000));
  }

  const snapshot: LibrarySnapshot = {
    takenAt: "2026-01-01T00:00:00.000Z",
    profile: {
      fullName: preamble[0] ?? null,
      headline: preamble[1] ?? null,
      email: "",
      phone: null,
      location: preamble.length > 2 ? preamble.slice(2).join(" ") : null,
      links: [],
      summary: null,
    },
    entries,
    skills: [],
  };
  const content: ResumeContent = {
    schemaVersion: 1,
    summary: { text: summary.join(" ").slice(0, 2000), included: summary.length > 0 },
    skills: [],
    entries: entries.map((item) => ({
      ref: item.ref,
      kind: item.kind,
      included: true,
      bullets: item.bullets.map((bullet) => contentBullet(bullet.ref, bullet.text)),
    })),
  };
  return { content, snapshot };
}

/** A section heading the direct baseline is allowed to use. */
export function isDirectHeading(line: string): boolean {
  const bare = line.replace(/:$/, "").replace(/\s+/g, " ").trim();
  if (bare.length === 0 || bare.length > 60 || /\d/.test(bare)) return false;
  if (!headingCase(bare)) return false;
  return SECTION.test(bare);
}

export function canonicalHeading(line: string): string | null {
  const bare = line.replace(/:$/, "").trim().toLowerCase();
  if (/\b(summary|profile|objective)\b/.test(bare) && !/\bexperience\b/.test(bare)) return "Summary";
  if (/\b(experience|employment|history)\b/.test(bare)) return "Experience";
  if (/\b(education|academic)\b/.test(bare)) return "Education";
  if (/\b(certification|certificate|license|licence)\b/.test(bare)) return "Certifications";
  if (/\bprojects?\b/.test(bare)) return "Projects";
  if (/\bvolunteer/.test(bare)) return "Volunteer";
  if (/\bskills?\b/.test(bare)) return "Skills";
  return null;
}

function parseSections(text: string): { preamble: string[]; sections: Section[] } {
  const preamble: string[] = [];
  const sections: Section[] = [];
  let current: Section | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^#{1,3}\s*/, "").trim();
    if (line.length === 0) continue;
    if (isDirectHeading(line)) {
      const summary = /\b(summary|profile|objective)\b/i.test(line) && !/\bexperience\b/i.test(line);
      current = { heading: line.replace(/:$/, "").trim(), kind: kindFor(line), summary, lines: [] };
      sections.push(current);
      continue;
    }
    if (!current) {
      preamble.push(line);
      continue;
    }
    current.lines.push(line);
  }
  return { preamble, sections };
}

function renderedLabel(kind: Kind): string {
  if (kind === "EXPERIENCE") return "Experience";
  if (kind === "EDUCATION") return "Education";
  if (kind === "CERTIFICATION") return "Certifications";
  if (kind === "PROJECT") return "Projects";
  if (kind === "VOLUNTEER") return "Volunteer";
  return "Other";
}

function kindFor(heading: string): Kind {
  const canonical = canonicalHeading(heading);
  if (canonical === "Experience") return "EXPERIENCE";
  if (canonical === "Education") return "EDUCATION";
  if (canonical === "Certifications") return "CERTIFICATION";
  if (canonical === "Projects") return "PROJECT";
  if (canonical === "Volunteer") return "VOLUNTEER";
  return "OTHER";
}

function headingCase(line: string): boolean {
  const letters = line.replace(/[^A-Za-z]/g, "");
  if (letters.length < 3) return false;
  if (letters === letters.toUpperCase()) return true;
  return line.split(/\s+/).every((word) => /^[A-Z0-9]/.test(word) || /^(and|of|the|for|to)$/i.test(word));
}

function isBullet(line: string): boolean {
  return /^[-•*]\s+/.test(line);
}

function isRoleLine(line: string, kind: Kind): boolean {
  if (kind !== "EXPERIENCE" && kind !== "VOLUNTEER" && kind !== "PROJECT") return false;
  if (isBullet(line) || line.length > 140 || /[.!?]$/.test(line)) return false;
  if (line.split(/\s+\|\s+/).length === 2) return true;
  return /\b(?:19|20)\d{2}\b/.test(line);
}

function startEntry(
  entries: LibrarySnapshot["entries"],
  kind: Kind,
  title: string,
): LibrarySnapshot["entries"][number] {
  const ref = `B${entries.length + 1}`;
  const created: LibrarySnapshot["entries"][number] = {
    ref,
    id: ref,
    kind,
    title,
    organization: null,
    location: null,
    startDate: null,
    endDate: null,
    isCurrent: false,
    url: null,
    bullets: [],
  };
  entries.push(created);
  return created;
}

function pushBullet(entry: LibrarySnapshot["entries"][number], text: string): void {
  const bullet = text.trim();
  if (bullet.length === 0) return;
  const ref = `${entry.ref}.B${entry.bullets.length + 1}`;
  entry.bullets.push({ ref, id: ref, text: bullet });
}

function contentBullet(id: string, text: string): ContentBullet {
  return {
    id,
    text,
    included: true,
    sourceRefs: [id],
    reverted: false,
    edited: false,
    originalText: null,
    suggestion: null,
    suggestionNote: null,
    changeWhat: null,
    requirementIds: [],
  };
}
