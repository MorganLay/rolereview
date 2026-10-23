import type { Metadata } from "next";

import { strings } from "@/copy/strings";
import { AboutPage } from "@/features/marketing/components/about-page";
import { marketingMetadata } from "@/features/marketing/seo";

const copy = strings.marketing.about;

export const metadata: Metadata = marketingMetadata({
  title: copy.metaTitle,
  description: copy.metaDescription,
  path: "/about",
});

export default function AboutRoute() {
  return <AboutPage />;
}
