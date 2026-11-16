/**
 * Import errors against the original resume.
 * A date range copied out of a title is recorded separately and is not an error.
 */
import type { LibrarySnapshot } from "@/features/library/schemas";

import { looksLikeTitle } from "./w3-display";

export type ImportError = {
  kind: "missing-date" | "wrong-date" | "moved-fact" | "dropped-text" | "untitled-role";
  detail: string;
};

const RANGE =
  /(?:\d{1,2}\/)?((?:19|20)\d{2})\s*[–—-]\s*(?:\d{1,2}\/)?((?:19|20)\d{2}|present|current)/gi;

const PREAMBLE =
  /processed public example|careercorpus|dataset publisher|workbook id|contact details from the source|employers were not independently/i;

export function auditImport(resume: string, snapshot: LibrarySnapshot): ImportError[] {
  const errors: ImportError[] = [];
  const library = libraryBlob(snapshot);
  for (const range of sourceRanges(resume)) {
    if (!library.includes(range.start) || !library.includes(range.end.toLowerCase())) {
      errors.push({ kind: "missing-date", detail: `${range.start}–${range.end} is in the resume and not on a library date or title.` });
    }
  }
  for (const entry of snapshot.entries) {
    for (const year of [entry.startDate, entry.endDate].filter((value): value is string => Boolean(value))) {
      const found = year.slice(0, 4);
      if (!resume.includes(found)) {
        errors.push({ kind: "wrong-date", detail: `${entry.ref} ${entry.title}: ${year} is not in the resume.` });
      }
    }
    if ((entry.kind === "EXPERIENCE" || entry.kind === "VOLUNTEER") && !looksLikeTitle(entry.title)) {
      errors.push({ kind: "untitled-role", detail: `${entry.ref}: "${entry.title}"` });
    }
  }
  for (const entry of snapshot.entries) {
    for (const bullet of entry.bullets) {
      for (const token of bullet.text.match(/\d[\d,.%$+]*/g) ?? []) {
        const bare = token.replace(/[^\d]/g, "");
        if (bare.length < 2) continue;
        const at = resume.indexOf(token.replace(/\.+$/, "")) >= 0 ? resume.indexOf(token.replace(/\.+$/, "")) : resume.indexOf(bare);
        if (at < 0) continue;
        const window = resume.slice(Math.max(0, at - 140), at);
        const home = lastRole(window);
        if (!home) continue;
        if (sharesWord(home, `${entry.title} ${entry.organization ?? ""}`)) continue;
        errors.push({
          kind: "moved-fact",
          detail: `"${token}" sits with "${home}" in the resume and under "${entry.title}" in the library.`,
        });
      }
    }
  }
  for (const clause of clauses(resume)) {
    if (covered(clause, library)) continue;
    errors.push({ kind: "dropped-text", detail: clause });
  }
  return dedupe(errors);
}

function sourceRanges(resume: string): { start: string; end: string }[] {
  const found: { start: string; end: string }[] = [];
  for (const match of resume.matchAll(RANGE)) {
    const start = match[1] ?? "";
    const end = (match[2] ?? "").toLowerCase();
    if (start) found.push({ start, end });
  }
  return found;
}

function libraryBlob(snapshot: LibrarySnapshot): string {
  const dates = snapshot.entries.flatMap((entry) => [entry.startDate ?? "", entry.endDate ?? "", entry.isCurrent ? "present" : "", entry.title]);
  const bullets = snapshot.entries.flatMap((entry) => entry.bullets.map((bullet) => bullet.text));
  return [...dates, ...bullets, ...snapshot.skills.map((skill) => skill.name), snapshot.profile.summary ?? ""].join("\n").toLowerCase();
}

function clauses(resume: string): string[] {
  return resume
    .split(/\r?\n|(?<=[.])\s+/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 40 && !PREAMBLE.test(line));
}

function covered(clause: string, library: string): boolean {
  const words = clause.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3);
  if (words.length === 0) return true;
  const hits = words.filter((word) => library.includes(word)).length;
  return hits / words.length >= 0.6;
}

function lastRole(window: string): string | null {
  const matches = [...window.matchAll(/[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,4}/g)];
  const last = matches[matches.length - 1];
  return last ? last[0] : null;
}

function sharesWord(left: string, right: string): boolean {
  const words = new Set(right.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3));
  return left.toLowerCase().split(/[^a-z0-9]+/).some((word) => word.length > 3 && words.has(word));
}

function dedupe(errors: ImportError[]): ImportError[] {
  const seen = new Set<string>();
  return errors.filter((error) => {
    const key = `${error.kind}:${error.detail}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
