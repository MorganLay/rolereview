/**
 * Visible “analyses left” while the new-job page is still showing the count
 * from before this visit’s saves. `delta` is successes the server number has
 * not absorbed yet.
 */

export type AnalysesAdjust = {
  base: number;
  delta: number;
};

export function reconcileAnalysesAdjust(
  serverRemaining: number,
  adjust: AnalysesAdjust,
): AnalysesAdjust {
  if (serverRemaining > adjust.base) return { base: serverRemaining, delta: 0 };
  if (serverRemaining === adjust.base) return adjust;
  const absorbed = adjust.base - serverRemaining;
  return {
    base: serverRemaining,
    delta: Math.max(0, adjust.delta - absorbed),
  };
}

/** One saved analysis. A drop already present in `baseNow` is not counted again. */
export function noteSuccessfulAnalysis(input: {
  baseAtSubmit: number;
  visibleAtSubmit: number;
  baseNow: number;
}): AnalysesAdjust {
  const pendingAtSubmit = Math.max(0, input.baseAtSubmit - input.visibleAtSubmit);
  const serverDrop = Math.max(0, input.baseAtSubmit - input.baseNow);
  const stillPending = Math.max(0, pendingAtSubmit - serverDrop);
  const countedThis = serverDrop > pendingAtSubmit ? 0 : 1;
  return { base: input.baseNow, delta: stillPending + countedThis };
}

type PendingAnalyses = AnalysesAdjust & { day: string };

let pending: PendingAnalyses | null = null;

function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function rememberAnalyses(adjust: AnalysesAdjust, now: Date = new Date()): void {
  if (adjust.delta <= 0) {
    pending = null;
    return;
  }
  pending = { day: utcDay(now), base: adjust.base, delta: adjust.delta };
}

/** Pending successes for this UTC day, after the latest server remaining. */
export function pendingAnalysesFor(
  serverRemaining: number,
  now: Date = new Date(),
): AnalysesAdjust {
  if (!pending || pending.day !== utcDay(now)) {
    pending = null;
    return { base: serverRemaining, delta: 0 };
  }
  const next = reconcileAnalysesAdjust(serverRemaining, pending);
  if (next.delta <= 0) pending = null;
  else pending = { day: pending.day, base: next.base, delta: next.delta };
  return next;
}

/** Test hook. The new-job form keeps this for the life of the tab. */
export function resetPendingAnalyses(): void {
  pending = null;
}
