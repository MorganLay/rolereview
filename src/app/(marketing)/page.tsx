import type { Metadata } from "next";

import { strings } from "@/copy/strings";
import { marketingPlanInput } from "@/features/billing/catalog";
import { HomePage } from "@/features/marketing/components/home-page";
import { presentMarketingPricing, softwareApplicationJsonLd } from "@/features/marketing/present";
import { marketingMetadata } from "@/features/marketing/seo";
import { env } from "@/lib/env";

export const metadata: Metadata = marketingMetadata({
  title: strings.marketing.home.metaTitle,
  description: strings.marketing.home.metaDescription,
  path: "/",
});

export default function Home() {
  const input = marketingPlanInput();
  const pricing = presentMarketingPricing(input);
  if (!pricing) {
    throw new Error("Homepage pricing could not be formatted from plans.");
  }

  const appJsonLd = softwareApplicationJsonLd({
    name: strings.brand.name,
    description: strings.brand.shortDescriptor,
    url: env.NEXT_PUBLIC_APP_URL.replace(/\/$/, ""),
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
      <HomePage pricing={pricing} />
    </>
  );
}
