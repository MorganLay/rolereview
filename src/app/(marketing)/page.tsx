import type { Metadata } from "next";
import { connection } from "next/server";

import { strings } from "@/copy/strings";
import { marketingPlanInput } from "@/features/billing/catalog";
import { requestPlanCurrency } from "@/features/billing/currency-request";
import { HomePage } from "@/features/marketing/components/home-page";
import { presentMarketingPricing, softwareApplicationJsonLd } from "@/features/marketing/present";
import { marketingMetadata } from "@/features/marketing/seo";
import { env } from "@/lib/env";

/** Prices follow the visitor's currency, so this route waits for that choice. */
export const instant = false;

export const metadata: Metadata = marketingMetadata({
  title: strings.marketing.home.metaTitle,
  description: strings.marketing.home.metaDescription,
  path: "/",
});

export default async function Home() {
  await connection();
  const currency = await requestPlanCurrency();
  const input = marketingPlanInput(currency);
  const pricing = presentMarketingPricing(input);
  if (!pricing) {
    throw new Error("Homepage pricing could not be formatted from plans.");
  }

  const appJsonLd = softwareApplicationJsonLd({
    name: strings.brand.name,
    description: strings.brand.shortDescriptor,
    url: env.NEXT_PUBLIC_APP_URL.replace(/\/$/, ""),
    usd: marketingPlanInput("USD"),
    cad: marketingPlanInput("CAD"),
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
