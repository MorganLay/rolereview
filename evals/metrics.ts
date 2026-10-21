/**
 * Pure numbers for the eval table. No model calls and no resume text.
 * docs/05-AI.md → Evals.
 */

const DASH = "\u2014";
const REVERT_LIMIT = 0.5;

export type PairMetric = {
  pair: string;
  reverts: number | null;
  droppedBullets: number | null;
  matchScore: number | null;
  words: number | null;
  seconds: number;
  costMicros: number;
};

export type QuotaGap = {
  kind: "ANALYZE" | "TAILOR";
  remaining: number;
  needed: number;
};

export function bulletCount(
  entries: readonly { bullets: readonly unknown[] }[],
): number {
  return entries.reduce((total, entry) => total + entry.bullets.length, 0);
}

/** Model bullets that the guard did not keep. Reverted bullets are kept. */
export function droppedBulletCount(modelBullets: number, keptBullets: number): number {
  return Math.max(0, modelBullets - keptBullets);
}

export function wordCount(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

export function averageReverts(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

export function quotaShortfall(input: {
  needed: number;
  analyzeRemaining: number;
  tailorRemaining: number;
}): QuotaGap[] {
  const gaps: QuotaGap[] = [];
  if (input.analyzeRemaining < input.needed) {
    gaps.push({
      kind: "ANALYZE",
      remaining: input.analyzeRemaining,
      needed: input.needed,
    });
  }
  if (input.tailorRemaining < input.needed) {
    gaps.push({
      kind: "TAILOR",
      remaining: input.tailorRemaining,
      needed: input.needed,
    });
  }
  return gaps;
}

export function formatCost(costMicros: number): string {
  return `$${(costMicros / 1_000_000).toFixed(4)}`;
}

export function formatMetricsTable(rows: readonly PairMetric[]): string {
  const header =
    "pair | reverts | dropped bullets | match score | words | seconds | $cost";
  const lines = rows.map((row) =>
    [
      row.pair,
      cell(row.reverts),
      cell(row.droppedBullets),
      cell(row.matchScore),
      cell(row.words),
      row.seconds.toFixed(1),
      formatCost(row.costMicros),
    ].join(" | "),
  );
  return [header, ...lines].join("\n");
}

/** One line for the mean, plus the fail line when the mean is over 0.5. */
export function summaryLines(rows: readonly PairMetric[]): string[] {
  const values = rows.flatMap((row) => (row.reverts === null ? [] : [row.reverts]));
  const average = averageReverts(values);
  if (average === null) return ["No tailored resumes to average."];
  const shown = average.toFixed(2);
  const lines = [`Average reverts ${shown}.`];
  if (average > REVERT_LIMIT) {
    lines.push(
      "Average reverts per tailored resume is over 0.5. Tighten the prompt before merging.",
    );
  }
  return lines;
}

function cell(value: number | null): string {
  return value === null ? DASH : String(value);
}
