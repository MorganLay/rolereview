/**
 * Printed form of a benchmark resume.
 * Dates that already have date fields leave the title.
 * Rankings print under Recognition, as bullets.
 * A credential line that only repeats its heading is dropped.
 */
import type { LibrarySnapshot } from "@/features/library/schemas";
import { resumePdfModel, resumePdfLines, type ResumePdfModel } from "@/lib/pdf/model";
import type { ResumeContent } from "@/features/tailor/schemas";

const YEAR_RANGE =
  /(?:\s*[\u2013\u2014-]\s*|\s)\(?\s*(?:\d{1,2}\/)?(?:19|20)\d{2}\s*[\u2013\u2014-]\s*(?:(?:\d{1,2}\/)?)?(?:(?:19|20)\d{2}|present|current)\s*\)?/gi;
const MONTH = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
const MONTH_RANGE = new RegExp(
  `(?:\\s*[\\u2013\\u2014-]\\s*|\\s)\\(?\\s*(?:${MONTH})\\s*(?:[\\u2013\\u2014-]\\s*(?:${MONTH})\\s*)?(?:19|20)\\d{2}\\s*[\\u2013\\u2014-]\\s*(?:${MONTH})\\s*(?:19|20)\\d{2}\\s*\\)?|(?:\\s*[\\u2013\\u2014-]\\s*|\\s)\\(?\\s*(?:${MONTH})\\s*[\\u2013\\u2014-]\\s*(?:${MONTH})\\s*(?:19|20)\\d{2}\\s*\\)?`,
  "gi",
);

export function printedTitle(entry: LibrarySnapshot["entries"][number]): string {
  if (!entry.startDate) return entry.title.trim();
  return entry.title
    .replace(YEAR_RANGE, " ")
    .replace(MONTH_RANGE, " ")
    .replace(/\(\s*\)/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,;])/g, "$1")
    .trim()
    .replace(/[\s,;\u2013\u2014-]+$/g, "")
    .trim();
}

export function displaySnapshot(snapshot: LibrarySnapshot): LibrarySnapshot {
  return {
    ...snapshot,
    entries: snapshot.entries.map((entry) => ({ ...entry, title: printedTitle(entry) })),
  };
}

/** A headline ends on a word, at 90 characters. */
export function clipHeadline(value: string, max = 90): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const room = text.slice(0, max + 1);
  const space = room.lastIndexOf(" ");
  const cut = space >= 40 ? text.slice(0, space) : text.slice(0, max);
  return cut.replace(/[\s,;:–—-]+$/g, "").trim();
}

export function displayContent(content: ResumeContent, snapshot: LibrarySnapshot): ResumeContent {
  const byRef = new Map(snapshot.entries.map((entry) => [entry.ref, entry]));
  const headline = clipHeadline(fullerHeadline(content));
  return {
    ...content,
    headline,
    entries: content.entries.map((entry) => {
      const source = byRef.get(entry.ref);
      if (!source) return entry;
      if (source.kind !== "EDUCATION" && source.kind !== "CERTIFICATION") return entry;
      const title = printedTitle(source);
      return {
        ...entry,
        bullets: entry.bullets.filter((bullet) => !restatesTitle(bullet.text, title)),
      };
    }),
  };
}

function fullerHeadline(content: ResumeContent): string {
  const shown = content.headline?.trim() ?? "";
  const planned = content.plan?.headline?.trim() ?? "";
  if (planned.startsWith(shown) && planned.length > shown.length) return planned;
  return shown || planned;
}

export function presentedModel(content: ResumeContent, snapshot: LibrarySnapshot): ResumePdfModel {
  const shown = displaySnapshot(snapshot);
  const model = resumePdfModel(displayContent(content, snapshot), shown);
  for (const section of model.sections) {
    if (section.heading === "Education") rewriteEducation(section);
    for (const entry of section.entries) {
      if (entry.bullets.length === 1 && entry.title && restatesTitle(entry.bullets[0] ?? "", entry.title)) {
        entry.bullets = [];
      }
    }
    if (section.heading !== "Other") continue;
    if (!sectionIsRecognition(snapshot)) continue;
    section.heading = "Recognition";
    for (const entry of section.entries) {
      if (entry.title && entry.title.trim().length > 0) {
        entry.bullets.unshift(entry.title.trim());
        entry.title = null;
      }
    }
  }
  return model;
}

export function presentedText(content: ResumeContent, snapshot: LibrarySnapshot): string {
  return resumePdfLines(presentedModel(content, snapshot)).join("\n");
}

function sectionIsRecognition(snapshot: LibrarySnapshot): boolean {
  const others = snapshot.entries.filter((entry) => entry.kind === "OTHER");
  if (others.length === 0) return false;
  return others.every((entry) => entry.title.trim().length === 0 || isRanking(entry.title));
}

function isRanking(text: string): boolean {
  return /\b(ranked|award|nominee|recognition)\b|#\s*\d|\btop\s+(rep|producer)\b/i.test(text);
}

const DEGREE_LEAD =
  /^(?:earned|completed|received|awarded|holds|holding|pursued|pursuing|certification)\b[:\s]*/i;

function rewriteEducation(section: ResumePdfModel["sections"][number]): void {
  const rebuilt: ResumePdfModel["sections"][number]["entries"] = [];
  for (const entry of section.entries) {
    const title = entry.title ?? "";
    const lifted: string[] = [];
    const kept: string[] = [];
    for (const bullet of entry.bullets) {
      const parts = splitClauses(bullet);
      const degrees = parts.filter((part) => degreeRank(part) !== null);
      const rest = parts.filter((part) => degreeRank(part) === null);
      if (degrees.length === 0) {
        kept.push(bullet);
        continue;
      }
      for (const degree of degrees) {
        if (!sameDegree(degree, title)) lifted.push(cleanDegree(degree));
      }
      if (rest.length > 0) kept.push(rest.join("; "));
    }
    const chosen = chooseDegreeHeading(title, [title, ...lifted]);
    const siblings = [title, ...lifted].filter(
      (phrase, index, all) =>
        degreeRank(phrase) !== null &&
        !sameDegree(phrase, chosen) &&
        all.findIndex((item) => sameDegree(item, phrase)) === index,
    );
    rebuilt.push({
      ...entry,
      title: chosen,
      bullets: kept.filter((bullet) => !restatesTitle(bullet, chosen)),
    });
    for (const sibling of siblings) {
      rebuilt.push({ title: cleanDegree(sibling), meta: null, detail: null, dates: null, url: null, bullets: [] });
    }
  }
  section.entries = rebuilt.filter((entry) => (entry.title?.trim().length ?? 0) > 0 || entry.bullets.length > 0);
}

/** Highest completed degree, otherwise the first degree listed. */
export function chooseDegreeHeading(title: string, phrases: readonly string[]): string {
  const candidates = phrases.map((phrase) => phrase.trim()).filter((phrase) => degreeRank(phrase) !== null);
  if (candidates.length === 0) return title.trim();
  const completed = candidates.filter((phrase) => !/\b(in progress|pursuing|expected)\b/i.test(phrase));
  const pool = completed.length > 0 ? completed : candidates;
  const best = Math.max(...pool.map((phrase) => degreeRank(phrase) ?? 0));
  return cleanDegree(pool.find((phrase) => (degreeRank(phrase) ?? 0) === best) ?? title);
}

function splitClauses(text: string): string[] {
  return text
    .split(/\s*;\s*|\s+\bplus\b\s+|\s+\band\b\s+(?=(?:an?\s+)?(?:ph\.?d|doctor|m\.?s\.?w|m\.?[as]\b|b\.?[as]\b|a\.?a\b|bachelor|master|associate|diploma))/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function degreeRank(text: string): number | null {
  const value = text.toLowerCase();
  if (/\bph\.?d\b|\bdoctor/.test(value)) return 5;
  if (/\bm\.?s\.?w\b|\bm\.?a\b|\bm\.?s\b|\bmaster/.test(value)) return 4;
  if (/\bb\.?a\b|\bb\.?s\b|\bbachelor/.test(value)) return 3;
  if (/\ba\.?a\b|\bassociate/.test(value)) return 2;
  if (/\bdiploma\b/.test(value)) return 1;
  return null;
}

function sameDegree(left: string, right: string): boolean {
  if (degreeRank(left) === null || degreeRank(left) !== degreeRank(right)) return false;
  const leftTokens = degreeTokens(left);
  const rightTokens = degreeTokens(right);
  if (leftTokens.size === 0 || rightTokens.size === 0) return true;
  const subset = (small: Set<string>, large: Set<string>) => [...small].every((token) => large.has(token));
  return subset(leftTokens, rightTokens) || subset(rightTokens, leftTokens);
}

function degreeTokens(text: string): Set<string> {
  return new Set(significant(text).filter((token) => !/^(university|college|school|degree)$/.test(token)));
}

function cleanDegree(text: string): string {
  return text.replace(DEGREE_LEAD, "").replace(/^[,\s]+/, "").trim();
}

function restatesTitle(bullet: string, title: string): boolean {
  const bulletTokens = significant(bullet);
  const titleTokens = new Set(significant(title));
  if (bulletTokens.length === 0 || titleTokens.size === 0) return false;
  return bulletTokens.every((token) => titleTokens.has(token));
}

const LEAD_WORDS = new Set([
  "earned",
  "completed",
  "received",
  "awarded",
  "holds",
  "holding",
  "pursued",
  "pursuing",
  "from",
  "with",
  "and",
  "plus",
  "the",
]);

function significant(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9+%]+/)
    .filter((token) => (token.length > 2 || /\d/.test(token)) && !LEAD_WORDS.has(token));
}
