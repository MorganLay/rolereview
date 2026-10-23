import type { Metadata } from "next";

import { WaitlistPage } from "@/features/growth/leads/components/waitlist-page";
import { strings } from "@/copy/strings";
import { marketingMetadata } from "@/features/marketing/seo";

export const metadata: Metadata = marketingMetadata({
  title: strings.marketing.waitlist.metaTitle,
  description: strings.marketing.waitlist.metaDescription,
  path: "/waitlist",
});

export default function WaitlistRoute() {
  return <WaitlistPage />;
}
