/** Public invite ref for thank-you / share links (`?ref=waitlist-…`). */
export function shareRefFromLeadId(id: string): string {
  return `waitlist-${id.replaceAll("-", "").slice(0, 8)}`;
}
