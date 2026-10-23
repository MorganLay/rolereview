import { isDailyIpLimited } from "@/lib/ip-limit";

/** Shared daily cap for waitlist, newsletter, and “email me this report”. */
export const PUBLIC_LEAD_DAILY_LIMIT = 10;

export function isPublicLeadLimited(runCount: number): boolean {
  return isDailyIpLimited(runCount, PUBLIC_LEAD_DAILY_LIMIT);
}
