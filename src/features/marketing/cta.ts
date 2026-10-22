import { strings } from "@/copy/strings";

export const SIGN_IN_NEXT = "/library/import";
export const SIGN_IN_HREF = `/sign-in?next=${SIGN_IN_NEXT}`;
export const DASHBOARD_HREF = "/dashboard";

export const CTA_LOCATIONS = [
  "header",
  "hero",
  "how-it-works",
  "pricing",
  "pricing-page",
  "demo",
  "final",
  "keyword-checker",
  "bullet-strength",
] as const;

export type CtaLocation = (typeof CTA_LOCATIONS)[number];

export type PrimaryCta = {
  href: string;
  label: string;
};

/** Signed-out visitors start an import. Signed-in visitors go to the dashboard. */
export function primaryCta(signedIn: boolean, compact = false): PrimaryCta {
  if (signedIn) {
    return { href: DASHBOARD_HREF, label: strings.marketing.cta.dashboard };
  }
  return {
    href: SIGN_IN_HREF,
    label: compact ? strings.marketing.nav.startFree : strings.marketing.cta.primary,
  };
}
