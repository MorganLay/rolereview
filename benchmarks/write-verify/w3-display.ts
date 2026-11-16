/**
 * W3 print rules. Headings and education lines. Production rendering is unchanged.
 */
import type { LibrarySnapshot } from "@/features/library/schemas";
import type { ResumePdfModel } from "@/lib/pdf/model";
import type { ResumeContent } from "@/features/tailor/schemas";

import { presentedModel } from "../lib/present";

const ROLE =
  /\b((?:lead|senior|assistant|office|restaurant|national|account|business|market|plant|graduate|electrical|graphic|front desk|social services|social work|high school|administrative|sales|maintenance)\s+)?(mechanic|manager|engineer|teacher|accountant|designer|assistant|specialist|intern|aide|controller|analyst|executive|producer|receptionist|cook|trainee|supervisor|coordinator|director|officer|clerk|bookkeeper|educator|developer|owner)\b/i;

const ROLE_WORD =
  /\b(mechanic|manager|engineer|teacher|accountant|designer|assistant|specialist|intern|aide|controller|analyst|executive|producer|receptionist|cook|trainee|supervisor|coordinator|director|officer|clerk|bookkeeper|educator|developer|owner)\b/i;

export function looksLikeTitle(title: string): boolean {
  const text = title.trim();
  if (text.length < 3 || /^\d/.test(text)) return false;
  if (/\b(yrs|years)\b/i.test(text) && !ROLE_WORD.test(text)) return false;
  return ROLE_WORD.test(text) || text.split(/\s+/).length <= 6;
}

/** A title stated in this entry, when the stored title is not a job title. */
export function headingFromEntry(entry: LibrarySnapshot["entries"][number]): string | null {
  if (looksLikeTitle(entry.title)) return null;
  const pool = [entry.title, ...entry.bullets.map((bullet) => bullet.text)].join(" ");
  const match = pool.match(ROLE);
  if (!match || match.index === undefined) return null;
  const phrase = pool.slice(match.index, match.index + match[0].length).replace(/\s+/g, " ").trim();
  if (phrase.length < 3) return null;
  return phrase.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

export function withUsableHeadings(snapshot: LibrarySnapshot): LibrarySnapshot {
  return {
    ...snapshot,
    entries: snapshot.entries.map((entry) => {
      if (entry.kind !== "EXPERIENCE" && entry.kind !== "VOLUNTEER") return entry;
      const heading = headingFromEntry(entry);
      return heading ? { ...entry, title: heading } : entry;
    }),
  };
}

export function presentW3(content: ResumeContent, snapshot: LibrarySnapshot): ResumePdfModel {
  const model = presentedModel(content, withUsableHeadings(snapshot));
  for (const section of model.sections) {
    if (section.heading === "Education" || section.heading === "Certifications") flattenCredentials(section);
  }
  return model;
}

/** One line per credential. A year, school, or field stays on its own line. */
export function flattenCredentials(section: ResumePdfModel["sections"][number]): void {
  const lines: ResumePdfModel["sections"][number]["entries"] = [];
  for (const entry of section.entries) {
    const parts = [entry.title ?? "", ...entry.bullets].flatMap(splitCredential);
    for (const part of parts) {
      const text = part.replace(/\s+/g, " ").trim().replace(/[.;]+$/g, "");
      if (text.length === 0) continue;
      if (/^(?:19|20)\d{2}(?:\s*[–—-]\s*(?:(?:19|20)\d{2}|present|current))?$/i.test(text)) {
        const previous = lines[lines.length - 1];
        if (previous?.title && !/(?:19|20)\d{2}/.test(previous.title)) previous.title = `${previous.title} (${text})`;
        continue;
      }
      lines.push({ title: text, meta: null, detail: null, dates: null, url: null, bullets: [] });
    }
  }
  section.entries = lines;
}

function splitCredential(text: string): string[] {
  return text
    .split(/\s*;\s*|\s+\bplus\b\s+|\s+\band\b\s+(?=(?:an?\s+)?(?:ph\.?d|doctor|m\.?s\.?w|m\.?[as]\b|b\.?[as]\b|a\.?a\b|bachelor|master|associate|diploma|certificate))/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}
