import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { LibrarySnapshot } from "@/features/library/schemas";

import {
  averageReverts,
  bulletCount,
  droppedBulletCount,
  formatMetricsTable,
  quotaShortfall,
  summaryLines,
  wordCount,
  type PairMetric,
} from "../../evals/metrics";

const fixtures = path.resolve(process.cwd(), "evals/fixtures");

describe("eval fixtures", () => {
  it("parses 4 library snapshots and 6 postings", () => {
    const libraryDir = path.join(fixtures, "libraries");
    const postingDir = path.join(fixtures, "postings");
    const libraryFiles = readdirSync(libraryDir)
      .filter((name) => name.endsWith(".json"))
      .sort();
    const postingFiles = readdirSync(postingDir)
      .filter((name) => name.endsWith(".txt"))
      .sort();

    expect(libraryFiles).toHaveLength(4);
    expect(postingFiles).toHaveLength(6);

    for (const filename of libraryFiles) {
      const parsed = LibrarySnapshot.parse(
        JSON.parse(readFileSync(path.join(libraryDir, filename), "utf8")),
      );
      expect(parsed.entries.some((entry) => entry.kind === "EDUCATION")).toBe(
        true,
      );
      const entryRefs = parsed.entries.map((entry) => entry.ref);
      expect(new Set(entryRefs).size).toBe(entryRefs.length);
      for (const entry of parsed.entries) {
        for (const bullet of entry.bullets) {
          expect(bullet.ref.startsWith(`${entry.ref}.`)).toBe(true);
        }
      }
    }

    for (const filename of postingFiles) {
      const text = readFileSync(path.join(postingDir, filename), "utf8").trim();
      expect(text.length).toBeGreaterThanOrEqual(200);
    }
  });
});

describe("eval metrics", () => {
  it("counts dropped bullets apart from reverts, and words on whitespace", () => {
    expect(bulletCount([{ bullets: [1, 2] }, { bullets: [] }])).toBe(2);
    expect(droppedBulletCount(5, 3)).toBe(2);
    expect(droppedBulletCount(3, 3)).toBe(0);
    expect(droppedBulletCount(1, 4)).toBe(0);
    expect(wordCount("  one   two  ")).toBe(2);
    expect(wordCount("   ")).toBe(0);
  });

  it("flags a shortfall and an average over 0.5", () => {
    expect(
      quotaShortfall({
        needed: 24,
        analyzeRemaining: 9,
        tailorRemaining: 24,
      }),
    ).toEqual([{ kind: "ANALYZE", remaining: 9, needed: 24 }]);
    expect(averageReverts([])).toBeNull();
    expect(averageReverts([0, 1])).toBe(0.5);

    const over: PairMetric = {
      pair: "a__b",
      reverts: 1,
      droppedBullets: 0,
      matchScore: null,
      words: 4,
      seconds: 1.2,
      costMicros: 1_500_000,
    };
    expect(summaryLines([over]).length).toBe(2);
    expect(summaryLines([{ ...over, reverts: 0 }])).toEqual([
      "Average reverts 0.00.",
    ]);
    expect(summaryLines([{ ...over, reverts: null }])).toEqual([
      "No tailored resumes to average.",
    ]);
  });

  it("prints the metrics table without resume text", () => {
    const row: PairMetric = {
      pair: "cs-grad__junior-dev",
      reverts: 1,
      droppedBullets: 2,
      matchScore: null,
      words: 10,
      seconds: 3.2,
      costMicros: 1_500_000,
    };
    expect(formatMetricsTable([row])).toBe(
      [
        "pair | reverts | dropped bullets | match score | words | seconds | $cost",
        "cs-grad__junior-dev | 1 | 2 | — | 10 | 3.2 | $1.5000",
      ].join("\n"),
    );
  });
});
