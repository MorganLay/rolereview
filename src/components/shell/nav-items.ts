import { strings } from "@/copy/strings";

export const APP_NAV_ITEMS = [
  { href: "/dashboard", label: strings.nav.dashboard },
  { href: "/library", label: strings.nav.library },
  { href: "/jobs", label: strings.nav.jobs },
  { href: "/contacts", label: strings.nav.contacts },
  { href: "/insights", label: strings.nav.insights },
  { href: "/settings", label: strings.nav.settings },
] as const;

export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}
