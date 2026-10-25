/**
 * Live keyword coverage for the resume workspace.
 * docs/05-AI.md → Keyword coverage.
 * Included summary, titles, organizations, bullets, and skill names only.
 */

import type { LibrarySnapshot } from "@/features/library/schemas";

import type { ResumeContent } from "./schemas";

export type KeywordCoverage = {
  covered: string[];
  missing: string[];
  pct: number;
};

export function keywordCoverage(
  content: ResumeContent,
  snapshot: LibrarySnapshot,
  keywords: readonly string[],
): KeywordCoverage {
  return keywordCoverageFromText(includedResumeText(content, snapshot), keywords);
}

/** Same matching as the workspace, against a pasted resume. */
export function keywordCoverageFromText(
  text: string,
  keywords: readonly string[],
): KeywordCoverage {
  const haystack = normalizeMatchText(text);
  const covered: string[] = [];
  const missing: string[] = [];

  for (const keyword of keywords) {
    const needle = normalizeMatchText(keyword);
    if (needle.length > 0 && termAppears(haystack, needle)) {
      covered.push(keyword);
    } else {
      missing.push(keyword);
    }
  }

  const pct =
    keywords.length === 0
      ? 0
      : Math.round((100 * covered.length) / keywords.length);

  return { covered, missing, pct };
}

export function includedResumeText(
  content: ResumeContent,
  snapshot: LibrarySnapshot,
): string {
  const byRef = new Map(snapshot.entries.map((entry) => [entry.ref, entry]));
  const parts: string[] = [];

  if (content.summary.included) parts.push(content.summary.text);

  for (const entry of content.entries) {
    if (!entry.included) continue;
    const snapshotEntry = byRef.get(entry.ref);
    if (snapshotEntry) {
      parts.push(snapshotEntry.title);
      if (snapshotEntry.organization) parts.push(snapshotEntry.organization);
    }
    for (const bullet of entry.bullets) {
      if (bullet.included) parts.push(bullet.text);
    }
  }

  for (const group of content.skills) parts.push(...group.names);
  return parts.join("\n");
}

export function normalizeMatchText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * `haystack` and `needle` are already normalised.
 * `+`, `#`, and `.` stay part of the word, so Java does not match JavaScript.
 */
export function termAppears(haystack: string, needle: string): boolean {
  if (needle.length === 0) return false;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `(?:^|[^a-z0-9+.#])${escaped}(?:[^a-z0-9+.#]|$)`,
  );
  return pattern.test(haystack);
}
