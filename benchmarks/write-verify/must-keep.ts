/**
 * Must-keep scoring. The lists live in benchmarks/fixtures/must-keep.json.
 * An item is kept when every group has one alternative on the page.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

export type MustKeepItem = {
  label: string;
  allOf: string[][];
};

export function loadMustKeep(): Record<string, MustKeepItem[]> {
  const file = path.join(process.cwd(), "benchmarks", "fixtures", "must-keep.json");
  const parsed = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  const lists: Record<string, MustKeepItem[]> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!Array.isArray(value)) continue;
    lists[key] = value as MustKeepItem[];
  }
  return lists;
}

export function mustKeepScore(
  page: string,
  items: readonly MustKeepItem[],
): { kept: number; total: number; missing: string[] } {
  const missing: string[] = [];
  for (const item of items) {
    const kept = item.allOf.every((group) => group.some((alternative) => alternativePresent(page, alternative)));
    if (!kept) missing.push(item.label);
  }
  return { kept: items.length - missing.length, total: items.length, missing };
}

/** Lower case, commas removed, dashes normalised, alternatives on word boundaries. */
export function alternativePresent(page: string, alternative: string): boolean {
  const hay = normalizeKeep(page);
  const needle = normalizeKeep(alternative);
  if (needle.length === 0) return false;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`).test(hay);
}

function normalizeKeep(value: string): string {
  return value.toLowerCase().replace(/,/g, "").replace(/[–—]/g, "-");
}

export type Defects = {
  libraryLines: number;
  fragments: number;
  duplicates: number;
  titleRestatements: number;
  firstPerson: number;
  disclaimers: number;
};

export function defectCounts(page: string, libraryBullets: readonly string[]): Defects {
  const bullets = page
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.replace(/^-+\s*/, ""));
  const library = new Set(libraryBullets.map((line) => line.trim().toLowerCase()));
  const seen = new Set<string>();
  let duplicates = 0;
  let libraryLines = 0;
  let fragments = 0;
  for (const bullet of bullets) {
    const key = bullet.trim().toLowerCase();
    if (seen.has(key)) duplicates += 1;
    seen.add(key);
    if (library.has(key)) libraryLines += 1;
    if (/^[a-z]/.test(bullet) || /^(also|and|additionally)\b/i.test(bullet)) fragments += 1;
  }
  let title = "";
  let titleRestatements = 0;
  for (const line of page.split(/\r?\n/).map((item) => item.trim()).filter((item) => item.length > 0)) {
    if (line.startsWith("- ")) {
      if (restates(line.replace(/^-+\s*/, ""), title)) titleRestatements += 1;
      continue;
    }
    if (!/^(summary|experience|education|skills|recognition|certifications|other)$/i.test(line)) title = line;
  }
  const firstPerson = (page.match(/\b(I|I'm|I've|my|me|we|our)\b/g) ?? []).length;
  const disclaimers = /do not hold|have not completed|not completed an|this resume reflects|i have not/i.test(page) ? 1 : 0;
  return { libraryLines, fragments, duplicates, titleRestatements, firstPerson, disclaimers };
}

function restates(bullet: string, title: string): boolean {
  const bulletTokens = significant(bullet);
  const titleTokens = new Set(significant(title));
  if (bulletTokens.length === 0 || titleTokens.size === 0) return false;
  return bulletTokens.every((token) => titleTokens.has(token));
}

function significant(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9+%]+/)
    .filter((token) => token.length > 2 || /\d/.test(token));
}
