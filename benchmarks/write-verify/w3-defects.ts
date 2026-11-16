/**
 * Defects counted for the W3 gate.
 * A raw library line, a fragment, a duplicate, a bullet that repeats its heading,
 * an education line that is only a year, or a heading that is not a title.
 */
import { defectCounts } from "./must-keep";
import { looksLikeTitle } from "./w3-display";

const SECTION = /^(summary|experience|education|skills|recognition|certifications|projects|volunteer|other)$/i;
const YEAR_LINE = /^(?:19|20)\d{2}(?:\s*[–—-]\s*(?:(?:19|20)\d{2}|present|current))?$/i;

export type W3Defects = {
  libraryLines: number;
  fragments: number;
  duplicates: number;
  titleRestatements: number;
  orphanEducation: number;
  badHeadings: number;
  total: number;
  titleLines: string[];
  orphanLines: string[];
  headingLines: string[];
};

export function w3Defects(page: string, libraryBullets: readonly string[]): W3Defects {
  const base = defectCounts(page, libraryBullets);
  const titleLines = titleRestatements(page);
  const orphanLines = orphanEducation(page);
  const headingLines = badHeadings(page);
  return {
    libraryLines: base.libraryLines,
    fragments: base.fragments,
    duplicates: base.duplicates,
    titleRestatements: titleLines.length,
    orphanEducation: orphanLines.length,
    badHeadings: headingLines.length,
    total: base.libraryLines + base.fragments + base.duplicates + titleLines.length + orphanLines.length + headingLines.length,
    titleLines,
    orphanLines,
    headingLines,
  };
}

const PLACEHOLDER =
  /^(?:candidate name|candidate name and contact details:.*|\[contact details withheld\]|\[name and contact details withheld\]|contact:\s*\[redacted by dataset publisher\])$/i;

export function stripPlaceholders(text: string): { text: string; removed: string[] } {
  const removed: string[] = [];
  const kept = text.split(/\r?\n/).filter((line) => {
    if (!PLACEHOLDER.test(line.trim())) return true;
    removed.push(line.trim());
    return false;
  });
  return { text: kept.join("\n"), removed };
}

function titleRestatements(page: string): string[] {
  const hits: string[] = [];
  let section = "";
  let title = "";
  let employer = "";
  let seenBullet = false;
  for (const line of lines(page)) {
    if (SECTION.test(line)) {
      section = line.toLowerCase();
      title = "";
      employer = "";
      seenBullet = false;
      continue;
    }
    if (section !== "experience") continue;
    if (line.startsWith("- ")) {
      const bullet = line.replace(/^-+\s*/, "");
      if (containsPhrase(bullet, title) || containsPhrase(bullet, employer)) hits.push(bullet);
      seenBullet = true;
      continue;
    }
    if (YEAR_LINE.test(line)) continue;
    if (seenBullet || title.length === 0) {
      title = line;
      employer = "";
      seenBullet = false;
      continue;
    }
    employer = line.split("·")[0]?.trim() ?? line;
  }
  return hits;
}

/** A full title or employer phrase. One shared word is not a restatement. */
function containsPhrase(bullet: string, phrase: string): boolean {
  const name = phrase.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const words = name.split(" ").filter((word) => word.length > 0);
  if (words.length < 2) return false;
  const body = bullet.toLowerCase().replace(/[^a-z0-9]+/g, " ");
  return body.includes(name);
}

function orphanEducation(page: string): string[] {
  const hits: string[] = [];
  let section = "";
  for (const line of lines(page)) {
    if (SECTION.test(line)) {
      section = line.toLowerCase();
      continue;
    }
    if (section !== "education" && section !== "certifications") continue;
    if (line.startsWith("- ")) continue;
    if (YEAR_LINE.test(line)) hits.push(line);
  }
  return hits;
}

function badHeadings(page: string): string[] {
  const hits: string[] = [];
  let section = "";
  for (const line of lines(page)) {
    if (SECTION.test(line)) {
      section = line.toLowerCase();
      continue;
    }
    if (section !== "experience" || line.startsWith("- ") || YEAR_LINE.test(line)) continue;
    const heading = line.split("|")[0]?.trim() ?? line;
    if (!looksLikeTitle(heading)) hits.push(line);
  }
  return hits;
}

function lines(page: string): string[] {
  return page.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
}

export type ReaderDefects = {
  duplicates: string[];
  fragments: string[];
  packedLines: string[];
  badHeadings: string[];
  titleRestatements: string[];
  total: number;
  notes: { libraryLines: string[]; orphanEducation: string[] };
};

/** Defects a reader would see. Exact library copies and year-only lines stay notes. */
export function readerDefects(page: string, libraryBullets: readonly string[]): ReaderDefects {
  const body = lines(page);
  const duplicates = repeatedLines(body);
  const fragments = body
    .filter((line) => line.startsWith("- "))
    .map((line) => line.replace(/^-+\s*/, ""))
    .filter((line) => /^[a-z]/.test(line) || /^(also|and|additionally)\b/i.test(line));
  const packedLines = body.filter((line) => packed(line));
  const headingLines = readerHeadings(body);
  const titleLines = titleRestatements(page);
  const library = new Set(libraryBullets.map((line) => line.trim().toLowerCase()));
  const libraryLines = body
    .filter((line) => line.startsWith("- "))
    .map((line) => line.replace(/^-+\s*/, ""))
    .filter((line) => library.has(line.toLowerCase()));
  return {
    duplicates,
    fragments,
    packedLines,
    badHeadings: headingLines,
    titleRestatements: titleLines,
    total: duplicates.length + fragments.length + packedLines.length + headingLines.length + titleLines.length,
    notes: { libraryLines, orphanEducation: orphanEducation(page) },
  };
}

function repeatedLines(body: readonly string[]): string[] {
  const hits: string[] = [];
  const seen = new Map<string, string>();
  const titles = roleTitleLines(body);
  for (const line of body) {
    if (titles.has(line)) continue;
    const key = foldLine(line);
    if (key.length < 12) continue;
    if (seen.has(key)) {
      hits.push(line.replace(/^-+\s*/, ""));
      continue;
    }
    for (const fold of seen.keys()) {
      if (fold.length >= 24 && key.includes(fold)) {
        hits.push(line.replace(/^-+\s*/, ""));
        break;
      }
    }
    seen.set(key, line);
  }
  return hits;
}

/** A skill category line is not a raw library dump. A packed token is one slash-joined list of three or more names. */
function packed(line: string): boolean {
  if (line.includes(":")) return false;
  return line.split(/\s+/).some((token) => (token.match(/\//g) ?? []).length >= 2);
}

function roleTitleLines(body: readonly string[]): Set<string> {
  const titles = new Set<string>();
  let section = "";
  let title = "";
  let seenBullet = false;
  for (const line of body) {
    if (SECTION.test(line)) {
      section = line.toLowerCase();
      title = "";
      seenBullet = false;
      continue;
    }
    if (section !== "experience") continue;
    if (line.startsWith("- ")) {
      seenBullet = true;
      continue;
    }
    if (YEAR_LINE.test(line)) continue;
    if (seenBullet || title.length === 0) {
      titles.add(line);
      title = line;
      seenBullet = false;
    }
  }
  return titles;
}

function readerHeadings(body: readonly string[]): string[] {
  const hits: string[] = [];
  let section = "";
  let title = "";
  let seenBullet = false;
  for (const line of body) {
    if (SECTION.test(line)) {
      section = line.toLowerCase();
      title = "";
      seenBullet = false;
      continue;
    }
    if (section !== "experience" || YEAR_LINE.test(line)) continue;
    if (line.startsWith("- ")) {
      seenBullet = true;
      continue;
    }
    if (seenBullet || title.length === 0) {
      title = line;
      seenBullet = false;
      const ranges = line.match(/(?:19|20)\d{2}/g) ?? [];
      if (!looksLikeTitle(line) || ranges.length >= 2) hits.push(line);
      continue;
    }
    seenBullet = false;
  }
  return hits;
}

function foldLine(line: string): string {
  return line.toLowerCase().replace(/^-+\s*/, "").replace(/[^a-z0-9/]+/g, "");
}
