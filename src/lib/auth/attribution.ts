import {
  type FirstTouchAttribution,
  parseAttributionCookie,
} from "@/lib/supabase/attribution";

/** Fields applied only when the User row is first created. */
export type UserCreateAttribution = {
  signupSource: string | null;
  signupReferrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  /** Another user's referralCode from the first-touch cookie, if present. */
  refCode: string | null;
};

export function attributionFromCookie(
  cookieValue: string | undefined,
): UserCreateAttribution {
  const parsed = parseAttributionCookie(cookieValue);
  return attributionFromParsed(parsed);
}

export function attributionFromParsed(
  parsed: FirstTouchAttribution | null,
): UserCreateAttribution {
  if (!parsed) {
    return {
      signupSource: null,
      signupReferrer: null,
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      refCode: null,
    };
  }
  return {
    signupSource: parsed.source ?? null,
    signupReferrer: parsed.referrer ?? null,
    utmSource: parsed.utmSource ?? null,
    utmMedium: parsed.utmMedium ?? null,
    utmCampaign: parsed.utmCampaign ?? null,
    refCode: parsed.ref ?? null,
  };
}
