import type { Metadata } from "next";
import { connection } from "next/server";

import { strings } from "@/copy/strings";
import { marketingPlanInput } from "@/features/billing/catalog";
import { requestPlanCurrency } from "@/features/billing/currency-request";
import { PricingExperience } from "@/features/marketing/components/pricing-page";
import { billingFaqItems, faqJsonLd } from "@/features/marketing/faq";
import {
  presentMarketingPricing,
  presentPricingComparison,
  softwareApplicationJsonLd,
} from "@/features/marketing/present";
import { marketingMetadata } from "@/features/marketing/seo";
import { env } from "@/lib/env";

const copy = strings.marketing.pricing;

/** Prices follow the visitor's currency, so this route waits for that choice. */
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const currency = await requestPlanCurrency();
  const pricing = presentMarketingPricing(marketingPlanInput(currency));
  return marketingMetadata({
    title: copy.metaTitle,
    description: pricing
      ? copy.metaDescription(pricing.monthly, pricing.quarterly)
      : strings.brand.shortDescriptor,
    path: "/pricing",
  });
}

export default async function PricingPage() {
  await connection();
  const currency = await requestPlanCurrency();
  const input = marketingPlanInput(currency);
  const pricing = presentMarketingPricing(input);
  if (!pricing) {
    throw new Error("Pricing could not be formatted from plans.");
  }

  const comparison = presentPricingComparison(input);
  const faqs = billingFaqItems({ freeTailor: input.tailor.free });
  const appJsonLd = softwareApplicationJsonLd({
    name: strings.brand.name,
    description: strings.brand.shortDescriptor,
    url: `${env.NEXT_PUBLIC_APP_URL}/pricing`,
    usd: marketingPlanInput("USD"),
    cad: marketingPlanInput("CAD"),
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
      <PricingExperience pricing={pricing} comparison={comparison} faqs={faqs} />
    </>
  );
}
