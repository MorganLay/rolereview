import type { LetterLength, LetterTone } from "./schemas";

/** A PENDING cover letter older than this is treated as FAILED. */
export const LETTER_STALE_MS = 5 * 60 * 1000;

export type LetterVersionStatus = "PENDING" | "READY" | "FAILED";

export type LetterVersion = {
  id: string;
  version: number;
  status: LetterVersionStatus;
  createdLabel: string;
  tone: LetterTone;
  length: LetterLength;
  templateId: string;
  rating: 1 | -1 | null;
  submitted: boolean;
};

export type LetterAlignChoice = {
  id: string;
  version: number;
};

export type JobLetters = {
  lettersLeft: number;
  pending: boolean;
  versions: LetterVersion[];
  resumes: LetterAlignChoice[];
};

export function displayedLetterStatus(
  status: LetterVersionStatus,
  updatedAt: Date,
  now: Date,
): LetterVersionStatus {
  if (
    status === "PENDING" &&
    now.getTime() - updatedAt.getTime() >= LETTER_STALE_MS
  ) {
    return "FAILED";
  }
  return status;
}
