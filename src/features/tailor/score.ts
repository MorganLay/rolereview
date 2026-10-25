/**
 * Match score from requirement verdicts.
 * docs/05-AI.md → Scoring.
 * The score reflects the library evidence, not the resume's wording.
 */

import type { JobAnalysis } from "@/features/jobs/schemas";

import { NOT_ASSESSED_NOTE, RESUME_LIMITS, MatchReport } from "./schemas";
import type {
  MatchReport as MatchReportData,
  StoredVerdict,
} from "./schemas";

const WEIGHT = { must: 2, nice: 1 } as const;
const VALUE = { met: 1, partial: 0.5, missing: 0 } as const;

type ScoreMatch = {
  requirementId: string;
  verdict: StoredVerdict;
  evidenceRefs: readonly string[];
  note: string;
};

export function scoreMatch(
  analysis: JobAnalysis,
  matches: readonly ScoreMatch[],
): MatchReportData {
  const first = new Map<string, ScoreMatch>();
  for (const match of matches) {
    if (!first.has(match.requirementId)) first.set(match.requirementId, match);
  }

  if (analysis.requirements.length === 0) {
    return MatchReport.parse({ verdicts: [], score: null });
  }

  let weighted = 0;
  let weightSum = 0;
  const verdicts = analysis.requirements.map((requirement) => {
    const match = first.get(requirement.id);
    const verdict = assessedVerdict(match);
    if (verdict !== "unassessed") {
      const weight = WEIGHT[requirement.importance];
      weighted += weight * VALUE[verdict];
      weightSum += weight;
    }
    const note = match?.note ?? NOT_ASSESSED_NOTE;
    return {
      requirementId: requirement.id,
      verdict,
      evidenceRefs: match?.evidenceRefs ?? [],
      note: note.length > RESUME_LIMITS.note ? note.slice(0, RESUME_LIMITS.note) : note,
    };
  });

  return MatchReport.parse({
    verdicts,
    score: weightSum === 0 ? null : Math.round((100 * weighted) / weightSum),
  });
}

/** A skipped requirement, including an older "Not assessed." row, is unassessed. */
function assessedVerdict(match: ScoreMatch | undefined): StoredVerdict {
  if (!match) return "unassessed";
  if (match.verdict === "missing" && match.note === NOT_ASSESSED_NOTE) {
    return "unassessed";
  }
  return match.verdict;
}
