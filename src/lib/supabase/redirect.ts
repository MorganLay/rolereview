/**
 * Only allow same-origin relative paths for post-auth redirects (`?next=`).
 * Rejects protocol-relative and absolute URLs.
 */
export function safeRedirectPath(
  next: string | null | undefined,
  fallback = "/dashboard",
): string {
  if (!next) return fallback;
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//") || next.includes("://") || next.includes("\\")) {
    return fallback;
  }
  return next;
}
