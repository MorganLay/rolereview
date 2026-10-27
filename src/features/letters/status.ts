import { CoverLetterOptions, type LetterLength, type LetterTone } from "./schemas";

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
  /** This version has been marked submitted. */
  submitted: boolean;
  /** label, or "{Company} — {date}". */
  title: string;
  /** Stored letter options, so Retry can call the same action. */
  recipientName: string;
  whyCompany: string;
  resumeId: string | null;
};

export function letterRetry(options: unknown): {
  tone: LetterTone;
  length: LetterLength;
  recipientName: string;
  whyCompany: string;
  resumeId: string | null;
} {
  const parsed = CoverLetterOptions.safeParse(options ?? {});
  if (!parsed.success) {
    return {
      tone: "professional",
      length: "standard",
      recipientName: "",
      whyCompany: "",
      resumeId: null,
    };
  }
  return {
    tone: parsed.data.tone,
    length: parsed.data.length,
    recipientName: parsed.data.recipientName ?? "",
    whyCompany: parsed.data.whyCompany ?? "",
    resumeId: parsed.data.resumeId ?? null,
  };
}

export type LetterAlignChoice = {
  id: string;
  version: number;
  title: string;
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
