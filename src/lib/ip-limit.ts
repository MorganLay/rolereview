/**
 * Daily IP-hash caps. The hash itself is day-scoped (lib/iphash.ts).
 */

export function isDailyIpLimited(runCount: number, limit: number): boolean {
  return runCount >= limit;
}
