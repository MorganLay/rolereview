import type { Metadata } from "next";

import { strings } from "@/copy/strings";
import { marketingPlanInput } from "@/features/billing/catalog";
import { PricingExperience } from "@/features/marketing/components/pricing-page";
import { billingFaqItems, faqJsonLd } from "@/features/marketing/faq";
import {
  presentFoundingOffer,
  presentMarketingPricing,
  presentPricingComparison,
  softwareApplicationJsonLd,
} from "@/features/marketing/present";
import { marketingMetadata } from "@/features/marketing/seo";
import { env } from "@/lib/env";

const copy = strings.marketing.pricing;

export function generateMetadata(): Metadata {
  const pricing = presentMarketingPricing(marketingPlanInput());
  return marketingMetadata({
    title: copy.metaTitle,
    description: pricing
      ? copy.metaDescription(pricing.monthly, pricing.quarterly)
      : strings.brand.shortDescriptor,
    path: "/pricing",
  });
}

export default function PricingPage() {
  const input = marketingPlanInput();
  const pricing = presentMarketingPricing(input);
  const founding = presentFoundingOffer(input);
  if (!pricing || !founding) {
    throw new Error("Pricing could not be formatted from plans.");
  }

  const comparison = presentPricingComparison(input);
  const faqs = billingFaqItems({
    freeTailor: input.tailor.free,
    foundingPercent: input.foundingPercent,
  });
  const appJsonLd = softwareApplicationJsonLd({
    name: strings.brand.name,
    description: strings.brand.shortDescriptor,
    url: `${env.NEXT_PUBLIC_APP_URL}/pricing`,
    freeUsd: input.freeMonthlyUsd,
    monthlyUsd: input.monthlyUsd,
    quarterlyUsd: input.quarterlyUsd,
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(appJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(faqs)) }}
      />
      <PricingExperience
        pricing={pricing}
        comparison={comparison}
        founding={founding}
        faqs={faqs}
      />
    </>
  );
}
