/**
 * Scripted measurements for the saved variants. Phrase checks are diagnostics.
 * The line-level support audit is not done here.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { equalEvidenceInput, loadCase } from "../lib/load";
import { phraseMatch } from "../lib/phrases";
import { adaptFixtureResume } from "../lib/snapshot";

export const VARIANTS = ["O-A", "O-B", "O-C", "W-C", "direct"] as const;
export type VariantName = (typeof VARIANTS)[number];

const PREAMBLE = [
  /^Processed public example\b/i,
  /^CareerCorpus category\b/i,
  /^The dataset publisher\b/i,
  /^Contact details from the source\b/i,
];

export type CaseMeasure = {
  caseId: string;
  variant: VariantName;
  skills: boolean;
  education: boolean;
  reverts: number;
  summaryFragment: boolean;
  factTokens: number;
  factsKept: number;
  bullets: number;
  medianWords: number;
  characters: number;
  pages: number | null;
  fitterRemoved: number;
  include: { phrase: string; match: string }[];
  avoid: { phrase: string; match: string }[];
  flagsRemaining: number;
};

export function factTokens(resume: string): string[] {
  const body = resume
    .split(/\r?\n/)
    .filter((line) => !PREAMBLE.some((pattern) => pattern.test(line.trim())))
    .join("\n");
  const found: string[] = [];
  for (const match of body.match(/[A-Za-z0-9][A-Za-z0-9$%./+#]*/g) ?? []) {
    const raw = match.replace(/\.+$/g, "");
    const capitals = raw.replace(/[^A-Z]/g, "").length;
    if (raw.length === 0 || (!/\d/.test(raw) && capitals < 2)) continue;
    found.push(normalizeFact(raw));
  }
  return found;
}

export function factsKeptIn(tokens: readonly string[], text: string): number {
  const hay = normalizeFact(text);
  return tokens.filter((token) => hay.includes(token)).length;
}

function normalizeFact(value: string): string {
  return value.toLowerCase().replace(/,/g, "").replace(/[–—−]/g, "-");
}

export function summaryFragment(summary: string): boolean {
  const text = summary.trim();
  if (text.length === 0) return false;
  if (/^[a-z]/.test(text)) return true;
  return /^(also|and|additionally|but|or)\b/i.test(text);
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? 0;
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

export function bulletLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.replace(/^-+\s*/, ""));
}

export function bulletWordCounts(text: string): number[] {
  return bulletLines(text).map((line) => line.split(/\s+/).filter((word) => word.length > 0).length);
}

export function sectionPresent(text: string, heading: "skills" | "education"): boolean {
  return text.split(/\r?\n/).some((line) => line.trim().toLowerCase() === heading);
}

/** A final bullet that matches a library bullet the draft did not already write. */
export function revertedLines(
  draftBullets: readonly string[],
  finalBullets: readonly string[],
  libraryBullets: readonly string[],
): number {
  const drafted = new Set(draftBullets.map((line) => line.trim().toLowerCase()));
  const library = new Set(libraryBullets.map((line) => line.trim().toLowerCase()));
  let count = 0;
  for (const line of finalBullets) {
    const text = line.trim().toLowerCase();
    if (library.has(text) && !drafted.has(text)) count += 1;
  }
  return count;
}

export function measureDirectory(directory: string, caseIds: readonly string[]): {
  rows: CaseMeasure[];
  overall: { variant: VariantName; factsKept: number; factTokens: number; rate: number; medianWords: number }[];
} {
  const rows: CaseMeasure[] = [];
  for (const caseId of caseIds) {
    const testCase = loadCase(caseId);
    if (!testCase) continue;
    const evidence = equalEvidenceInput(testCase);
    const tokens = factTokens(evidence.resume);
    const libraryBullets = adaptFixtureResume(evidence.resume).snapshot.entries.flatMap((entry) =>
      entry.bullets.map((bullet) => bullet.text),
    );
    for (const variant of VARIANTS) {
      const fittedPath = path.join(directory, `${caseId}.${variant}.fitted.json`);
      const tracePath = path.join(directory, `${caseId}.${variant}.replay.json`);
      let text = "";
      let pages: number | null = null;
      let removed = 0;
      let flags = 0;
      let draftBullets: string[] = [];
      try {
        const fitted = JSON.parse(readFileSync(fittedPath, "utf8")) as {
          role?: { text?: string; pageLimit?: number | null; dropped?: string[] };
        };
        text = fitted.role?.text ?? "";
        pages = typeof fitted.role?.pageLimit === "number" ? fitted.role.pageLimit : null;
        removed = fitted.role?.dropped?.length ?? 0;
      } catch {
        text = "";
      }
      try {
        const replay = JSON.parse(readFileSync(tracePath, "utf8")) as {
          flags?: { text: string }[];
          draftBullets?: string[];
        };
        draftBullets = replay.draftBullets ?? [];
        flags = (replay.flags ?? []).filter((flag) => text.includes(flag.text)).length;
      } catch {
        flags = 0;
      }
      const words = bulletWordCounts(text);
      const summary = text.split(/\r?\n/).find((line, index, all) => all[index - 1]?.trim().toLowerCase() === "summary") ?? "";
      rows.push({
        caseId,
        variant,
        skills: sectionPresent(text, "skills"),
        education: sectionPresent(text, "education"),
        reverts: revertedLines(draftBullets, bulletLines(text), libraryBullets),
        summaryFragment: summaryFragment(summary),
        factTokens: tokens.length,
        factsKept: factsKeptIn(tokens, text),
        bullets: words.length,
        medianWords: median(words),
        characters: text.length,
        pages,
        fitterRemoved: removed,
        include: testCase.includeEvidence.map((phrase) => ({ phrase, match: phraseMatch(text, phrase) })),
        avoid: testCase.avoidClaims.map((phrase) => ({ phrase, match: phraseMatch(text, phrase) })),
        flagsRemaining: flags,
      });
    }
  }
  const overall = VARIANTS.map((variant) => {
    const subset = rows.filter((row) => row.variant === variant);
    const factTokens = subset.reduce((sum, row) => sum + row.factTokens, 0);
    const factsKept = subset.reduce((sum, row) => sum + row.factsKept, 0);
    const words = subset.flatMap((row) => {
      const file = path.join(directory, `${row.caseId}.${variant}.fitted.json`);
      try {
        const fitted = JSON.parse(readFileSync(file, "utf8")) as { role?: { text?: string } };
        return bulletWordCounts(fitted.role?.text ?? "");
      } catch {
        return [];
      }
    });
    return {
      variant,
      factsKept,
      factTokens,
      rate: factTokens === 0 ? 0 : factsKept / factTokens,
      medianWords: median(words),
    };
  });
  return { rows, overall };
}

export function markdownTable(measured: ReturnType<typeof measureDirectory>): string {
  const header = [
    "Case",
    "Variant",
    "Skills",
    "Education",
    "Reverts",
    "Fragment",
    "Facts",
    "Bullets",
    "Median words",
    "Characters",
    "Pages",
    "Fitter removed",
    "Avoid hits",
    "Flags left",
  ];
  const lines = [`| ${header.join(" | ")} |`, `| ${header.map(() => "---").join(" | ")} |`];
  for (const row of measured.rows) {
    const facts = row.factTokens === 0 ? "0%" : `${Math.round((row.factsKept / row.factTokens) * 100)}%`;
    const avoid = row.avoid.filter((item) => item.match !== "absent").length;
    lines.push(
      `| ${[
        row.caseId,
        row.variant,
        row.skills ? "yes" : "no",
        row.education ? "yes" : "no",
        row.reverts,
        row.summaryFragment ? "yes" : "no",
        `${row.factsKept}/${row.factTokens} (${facts})`,
        row.bullets,
        row.medianWords,
        row.characters,
        row.pages ?? "—",
        row.fitterRemoved,
        avoid,
        row.flagsRemaining,
      ].join(" | ")} |`,
    );
  }
  lines.push("", "## Overall", "");
  for (const row of measured.overall) {
    lines.push(`- ${row.variant}: facts ${row.factsKept}/${row.factTokens} (${(row.rate * 100).toFixed(1)}%), median words ${row.medianWords}`);
  }
  return lines.join("\n");
}

export function listResultFiles(directory: string): string[] {
  return readdirSync(directory);
}
