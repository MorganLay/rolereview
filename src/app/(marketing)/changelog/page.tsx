import type { Metadata } from "next";

import { strings } from "@/copy/strings";
import { ChangelogPage } from "@/features/marketing/components/changelog-page";
import { changelogEntries } from "@/features/marketing/changelog-entries";
import { marketingMetadata } from "@/features/marketing/seo";

const copy = strings.marketing.changelog;

export const metadata: Metadata = marketingMetadata({
  title: copy.metaTitle,
  description: copy.metaDescription,
  path: "/changelog",
});

export default function ChangelogRoute() {
  return <ChangelogPage entries={changelogEntries()} />;
}
