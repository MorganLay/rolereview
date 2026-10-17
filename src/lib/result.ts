/**
 * Closed set of server-action error codes. See docs/03-ARCHITECTURE.md → Core patterns.
 */
export const ERROR_CODES = [
  "VALIDATION",
  "NOT_FOUND",
  "UNAUTHENTICATED",
  "QUOTA_EXCEEDED",
  "PRO_REQUIRED",
  "AI_FAILED",
  "CONFLICT",
  "RATE_LIMITED",
  "CAPTCHA_FAILED",
  "INTERNAL",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** Zod-style field errors: field name → message list. */
export type FieldErrors = Record<string, string[] | undefined>;

export type ActionSuccess<T> = { ok: true; data: T };
export type ActionFailure = {
  ok: false;
  error: { code: ErrorCode; fields?: FieldErrors };
};
export type ActionResult<T> = ActionSuccess<T> | ActionFailure;

export function ok<T>(data: T): ActionSuccess<T> {
  return { ok: true, data };
}

export function fail(code: ErrorCode, fields?: FieldErrors): ActionFailure {
  if (fields === undefined) {
    return { ok: false, error: { code } };
  }
  return { ok: false, error: { code, fields } };
}
