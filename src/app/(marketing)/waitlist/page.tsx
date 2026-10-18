import type { Metadata } from "next";

import { WaitlistPage } from "@/features/growth/leads/components/waitlist-page";
import { strings } from "@/copy/strings";

export const metadata: Metadata = {
  title: strings.marketing.waitlist.metaTitle,
  description: strings.marketing.waitlist.metaDescription,
};

export default function WaitlistRoute() {
  return <WaitlistPage />;
}
