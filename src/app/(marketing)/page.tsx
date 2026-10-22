import type { Metadata } from "next";

import { strings } from "@/copy/strings";
import { marketingPlanInput } from "@/features/billing/catalog";
import { HomePage } from "@/features/marketing/components/home-page";
import { loadDemoCatalog } from "@/features/marketing/demo/load";
import { presentMarketingPricing } from "@/features/marketing/present";

export const metadata: Metadata = {
  title: strings.marketing.home.metaTitle,
  description: strings.marketing.home.metaDescription,
};

export default function Home() {
  const pricing = presentMarketingPricing(marketingPlanInput());
  if (!pricing) {
    throw new Error("Homepage pricing could not be formatted from plans.");
  }

  return <HomePage pricing={pricing} demos={loadDemoCatalog()} />;
}
