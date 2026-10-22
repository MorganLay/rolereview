import type { Metadata } from "next";

import { strings } from "@/copy/strings";
import { marketingPlanInput } from "@/features/billing/catalog";
import { HomePricing } from "@/features/marketing/components/home-pricing";
import { presentMarketingPricing } from "@/features/marketing/present";

export const metadata: Metadata = {
  title: strings.marketing.home.pricingTitle,
  description: strings.marketing.home.metaDescription,
};

export default function PricingPage() {
  const pricing = presentMarketingPricing(marketingPlanInput());
  if (!pricing) {
    throw new Error("Pricing could not be formatted from plans.");
  }

  return <HomePricing pricing={pricing} heading="h1" />;
}
