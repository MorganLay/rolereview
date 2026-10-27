import { strings } from "@/copy/strings";

import type { JobStatusValue } from "./schemas";

/** One recommended next step for a job. Pipeline status wins over the resume. */
export type NextActionKind =
  | "tailor"
  | "review"
  | "preview"
  | "followUp"
  | "interview"
  | "decision";

export type NextAction = {
  kind: NextActionKind;
  href: string;
};

/** A READY resume the caller has already chosen as the newest, or a candidate for that choice. */
export type ReadyResumeRef = {
  id: string;
  version: number;
  exported: boolean;
};

export type LatestReadyResume = {
  id: string;
  exported: boolean;
};

export type NextActionInput = {
  jobId: string;
  status: JobStatusValue;
  /** Analysis finished. A stale pending analysis counts as not ready. */
  analysisReady: boolean;
  latestReadyResume: LatestReadyResume | null;
  /** An offer row exists. Used when the status is Accepted. */
  hasOffer: boolean;
};

const labels = strings.jobs.nextAction;

export function nextActionLabel(kind: NextActionKind): string {
  return labels[kind];
}

/** Newest READY resume. A version tie keeps the lower id. */
export function newestReadyResume(
  resumes: readonly ReadyResumeRef[],
): LatestReadyResume | null {
  let best: ReadyResumeRef | null = null;
  for (const resume of resumes) {
    if (resume.id.length === 0) continue;
    const newer = best !== null && resume.version > best.version;
    const sameVersion = best !== null && resume.version === best.version && resume.id < best.id;
    if (!best || newer || sameVersion) best = resume;
  }
  if (!best) return null;
  return { id: best.id, exported: best.exported };
}

/** Ready tailored resumes plus ready cover letters. Other statuses are left out. */
export function readyVersionCount(
  resumes: readonly { status: string }[],
  letters: readonly { status: string }[],
): number {
  return countReady(resumes) + countReady(letters);
}

export function nextAction(input: NextActionInput): NextAction | null {
  switch (input.status) {
    case "OFFER":
      return step(input.jobId, "decision", "?tab=offer");
    case "INTERVIEWING":
      return step(input.jobId, "interview", "?tab=interviews");
    case "APPLIED":
    case "SCREENING":
      return step(input.jobId, "followUp", "?tab=timeline");
    case "ACCEPTED":
      return input.hasOffer ? step(input.jobId, "decision", "?tab=offer") : null;
    case "REJECTED":
    case "WITHDRAWN":
    case "NO_RESPONSE":
      return null;
    case "SAVED":
      return savedAction(input);
    default: {
      const unreachable: never = input.status;
      return unreachable;
    }
  }
}

function savedAction(input: NextActionInput): NextAction | null {
  if (!input.analysisReady) return null;
  const resume = input.latestReadyResume;
  if (!resume || resume.id.length === 0) {
    return step(input.jobId, "tailor", "?tab=documents");
  }
  const href = `/resumes/${encodeURIComponent(resume.id)}`;
  return resume.exported
    ? step(input.jobId, "preview", href)
    : step(input.jobId, "review", href);
}

function step(jobId: string, kind: NextActionKind, suffix: string): NextAction {
  return { kind, href: `/jobs/${encodeURIComponent(jobId)}${suffix}` };
}

function countReady(items: readonly { status: string }[]): number {
  let count = 0;
  for (const item of items) {
    if (item.status === "READY") count += 1;
  }
  return count;
}
