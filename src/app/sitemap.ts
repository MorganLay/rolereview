import type { MetadataRoute } from "next";

import { changelogEntries } from "@/features/marketing/changelog-entries";
import { CHANGELOG_UPDATED, sitemapEntries } from "@/features/marketing/seo";
import { env } from "@/lib/env";

export default function sitemap(): MetadataRoute.Sitemap {
  const latest = changelogEntries()[0]?.date ?? CHANGELOG_UPDATED;
  return sitemapEntries(env.NEXT_PUBLIC_APP_URL, latest);
}
