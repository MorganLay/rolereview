import type { NextRequest, NextResponse } from "next/server";

/** First-touch attribution cookie (30 days). Read by requireUser in T1.2. */
export const ATTRIBUTION_COOKIE = "rr_ft";

const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type FirstTouchAttribution = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  ref?: string;
  referrer?: string;
};

function pick(value: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 200) : undefined;
}

function referrerHost(request: NextRequest): string | undefined {
  const raw = request.headers.get("referer");
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (url.host === request.nextUrl.host) return undefined;
    return url.host;
  } catch {
    return undefined;
  }
}

/** Capture utm_*, ref, and external referrer host once (first-touch only). */
export function applyFirstTouchCookie(
  request: NextRequest,
  response: NextResponse,
): void {
  if (request.cookies.get(ATTRIBUTION_COOKIE)?.value) return;

  const { searchParams } = request.nextUrl;
  const payload: FirstTouchAttribution = {
    utmSource: pick(searchParams.get("utm_source")),
    utmMedium: pick(searchParams.get("utm_medium")),
    utmCampaign: pick(searchParams.get("utm_campaign")),
    ref: pick(searchParams.get("ref")),
    referrer: referrerHost(request),
  };

  if (
    !payload.utmSource &&
    !payload.utmMedium &&
    !payload.utmCampaign &&
    !payload.ref &&
    !payload.referrer
  ) {
    return;
  }

  response.cookies.set(ATTRIBUTION_COOKIE, JSON.stringify(payload), {
    path: "/",
    maxAge: MAX_AGE_SECONDS,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    httpOnly: true,
  });
}

export function parseAttributionCookie(
  value: string | undefined,
): FirstTouchAttribution | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as FirstTouchAttribution;
  } catch {
    return null;
  }
}
