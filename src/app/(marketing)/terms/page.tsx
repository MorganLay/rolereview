import type { Metadata } from "next";

import { strings } from "@/copy/strings";
import { TermsPage } from "@/features/marketing/components/legal-document";
import { marketingMetadata } from "@/features/marketing/seo";

const copy = strings.marketing.terms;

export const metadata: Metadata = marketingMetadata({
  title: copy.metaTitle,
  description: copy.metaDescription,
  path: "/terms",
});

export default function TermsRoute() {
  return <TermsPage />;
}
