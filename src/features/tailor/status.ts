import { TailorOptions } from "@/features/tailor/schemas";

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
  /** A PDF or DOCX of this version has been downloaded. */
  exported: boolean;
  /** label, or "{Company} — {date}". */
  title: string;
  /** Stored tailor options, so Retry can call the same action. */
  length: 1 | 2;
  emphasis: string;
};

export function tailorRetry(options: unknown): { length: 1 | 2; emphasis: string } {
  const parsed = TailorOptions.safeParse(options ?? {});
  if (!parsed.success) return { length: 1, emphasis: "" };
  return { length: parsed.data.length, emphasis: parsed.data.emphasis ?? "" };
}

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
