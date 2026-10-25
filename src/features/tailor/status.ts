/** A PENDING tailored resume older than this is treated as FAILED. */
export const TAILOR_STALE_MS = 5 * 60 * 1000;

export type ResumeVersionStatus = "PENDING" | "READY" | "FAILED";

export type ResumeVersion = {
  id: string;
  version: number;
  status: ResumeVersionStatus;
  createdLabel: string;
  matchScore: number | null;
  templateId: string;
  rating: 1 | -1 | null;
  /** This version has been marked submitted. */
  submitted: boolean;
  /** label, or "{Company} — {date}". */
  title: string;
};

export type JobDocuments = {
  canTailor: boolean;
  tailorsLeft: number;
  pending: boolean;
  versions: ResumeVersion[];
};

export function displayedTailorStatus(
  status: ResumeVersionStatus,
  updatedAt: Date,
  now: Date,
): ResumeVersionStatus {
  if (status === "PENDING" && now.getTime() - updatedAt.getTime() >= TAILOR_STALE_MS) {
    return "FAILED";
  }
  return status;
}
