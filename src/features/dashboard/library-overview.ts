/**
 * One library sentence for the dashboard. Completeness, wording, and evidence
 * stay separate, matching the library page. Wording uses the same capped list
 * the library shows (at most five lines). No model call.
 */

export type LibraryFocus = "empty" | "wording" | "evidence" | "completeness" | "ready";

export type LibraryOverview = {
  populated: boolean;
  percent: number;
  strongOrBetter: number;
  bulletCount: number;
  /** Lines the library page would list under wording. */
  wording: number;
  evidence: number;
  focus: LibraryFocus;
};

export function libraryOverview(input: {
  populated: boolean;
  percent: number;
  strongOrBetter: number;
  bulletCount: number;
  wording: number;
  evidence: number;
}): LibraryOverview {
  return {
    populated: input.populated,
    percent: input.percent,
    strongOrBetter: input.strongOrBetter,
    bulletCount: input.bulletCount,
    wording: input.wording,
    evidence: input.evidence,
    focus: libraryFocus(input),
  };
}

function libraryFocus(input: {
  populated: boolean;
  percent: number;
  wording: number;
  evidence: number;
}): LibraryFocus {
  if (!input.populated) return "empty";
  if (input.wording > 0) return "wording";
  if (input.evidence > 0) return "evidence";
  if (input.percent < 100) return "completeness";
  return "ready";
}
