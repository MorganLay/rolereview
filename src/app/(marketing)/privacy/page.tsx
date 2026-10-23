import type { Metadata } from "next";

import { strings } from "@/copy/strings";
import { PrivacyPage } from "@/features/marketing/components/legal-document";
import { marketingMetadata } from "@/features/marketing/seo";

const copy = strings.marketing.privacy;

export const metadata: Metadata = marketingMetadata({
  title: copy.metaTitle,
  description: copy.metaDescription,
  path: "/privacy",
});

export default function PrivacyRoute() {
  return <PrivacyPage />;
}
