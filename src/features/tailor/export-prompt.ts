/**
 * When a PDF download should offer to mark the resume submitted and move to Applied.
 * docs/02-USER-FLOWS.md → Resume workspace → Export.
 */

/** Response header. "1" when exportedAt was empty before this download. */
export const FIRST_EXPORT_HEADER = "X-First-Export";

export function isFirstExportHeader(value: string | null): boolean {
  return value === "1";
}

/** The prompt is the first export of this resume, and only while the job is Saved. */
export function shouldPromptMoveToApplied(
  jobStatus: string,
  firstExport: boolean,
): boolean {
  return firstExport && jobStatus === "SAVED";
}
