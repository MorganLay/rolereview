import type { Metadata } from "next";

/** Published date of the latest changelog note. Sitemap lastmod uses this. */
export const CHANGELOG_UPDATED = "2026-10-22";

/** Public marketing URLs. Private app routes stay out of the sitemap. */
export const PUBLIC_SITEMAP_PATHS = [
  "/",
  "/pricing",
  "/demo",
  "/about",
  "/changelog",
  "/privacy",
  "/terms",
  "/waitlist",
  "/tools/ats-keyword-checker",
  "/tools/bullet-strength",
] as const;

export const ROBOTS_DISALLOW = [
  "/dashboard",
  "/library",
  "/jobs",
  "/contacts",
  "/insights",
  "/milestones",
  "/settings",
  "/admin",
  "/api/",
  "/auth/",
  "/sign-in",
  "/styleguide",
] as const;

export type SitemapChangeFrequency = "weekly" | "monthly";

export type SitemapEntry = {
  url: string;
  lastModified: string;
  changeFrequency: SitemapChangeFrequency;
  priority: number;
};

export function absolutePublicUrl(origin: string, path: string): string {
  const base = origin.replace(/\/$/, "");
  if (path === "/") return base;
  return `${base}${path}`;
}

export function sitemapEntries(
  origin: string,
  lastModified: string,
): SitemapEntry[] {
  return PUBLIC_SITEMAP_PATHS.map((path) => ({
    url: absolutePublicUrl(origin, path),
    lastModified,
    changeFrequency:
      path === "/" || path === "/changelog" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : path === "/changelog" ? 0.8 : 0.6,
  }));
}

export function robotsDocument(origin: string) {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [...ROBOTS_DISALLOW],
    },
    sitemap: `${absolutePublicUrl(origin, "/")}/sitemap.xml`,
  };
}

/** Title, description, canonical, and social tags for one public page. */
export function marketingMetadata(input: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: input.path },
    openGraph: {
      title: input.title,
      description: input.description,
      url: input.path,
    },
    twitter: {
      title: input.title,
      description: input.description,
    },
  };
}
