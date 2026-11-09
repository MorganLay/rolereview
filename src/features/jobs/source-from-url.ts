import type { JobSourceValue } from "./schemas";

/** LinkedIn or Indeed when that name is a host label, including the label after `www.`. */
export function sourceFromPostingUrl(url: string): Extract<JobSourceValue, "LINKEDIN" | "INDEED"> | null {
  const host = hostname(url);
  if (!host) return null;
  const labels = host.split(".");
  if (labels.includes("linkedin")) return "LINKEDIN";
  if (labels.includes("indeed")) return "INDEED";
  return null;
}

function hostname(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  const withProtocol = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withProtocol).hostname.toLowerCase();
  } catch {
    return null;
  }
}
