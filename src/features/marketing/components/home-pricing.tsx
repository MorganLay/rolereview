"use client";

import Link from "next/link";
import { useState } from "react";

import { strings } from "@/copy/strings";
import { cn } from "@/lib/utils";
import type { MarketingPricingView, PricingInterval } from "@/features/marketing/present";

import { CtaLink } from "./cta-link";
import { PricingToggle } from "./pricing-toggle";

const copy = strings.marketing.home;

export function HomePricing({
  pricing,
  heading: Heading = "h2",
  showCompare = true,
}: {
  pricing: MarketingPricingView;
  heading?: "h1" | "h2";
  showCompare?: boolean;
}) {
  const [interval, setInterval] = useState<PricingInterval>("MONTH");
  const proPrice = interval === "MONTH" ? pricing.monthly : pricing.quarterly;

  return (
    <section id="pricing" className="scroll-mt-20 border-t border-line bg-surface">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <Heading className="font-serif text-3xl font-semibold tracking-tight text-ink">
          {copy.pricingTitle}
        </Heading>
        <div className="mt-6">
          <PricingToggle
            interval={interval}
            savePercent={pricing.savePercent}
            label={copy.pricingTitle}
            onChange={setInterval}
          />
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <PlanCard
            name={copy.pricingFree}
            price={pricing.free}
            rows={pricing.rows.map((row) => row.free)}
            labels={pricing.rows.map((row) => row.label)}
          />
          <PlanCard
            name={copy.pricingPro}
            price={proPrice}
            featured
            rows={pricing.rows.map((row) => row.pro)}
            labels={pricing.rows.map((row) => row.label)}
          />
        </div>

        <p className="mt-6 text-sm text-slate">{copy.pricingGuarantee}</p>
        {showCompare ? (
          <p className="mt-2 text-sm">
            <Link href="/pricing" className="font-medium text-pine hover:text-pine-hover">
              {copy.pricingCompare}
            </Link>
          </p>
        ) : null}
      </div>
    </section>
  );
}

function PlanCard({
  name,
  price,
  labels,
  rows,
  featured = false,
}: {
  name: string;
  price: string;
  labels: string[];
  rows: string[];
  featured?: boolean;
}) {
  return (
    <article
      className={cn(
        "flex flex-col rounded-card border bg-paper p-6",
        featured ? "border-pine" : "border-line",
      )}
    >
      <h3 className="text-sm font-medium text-slate">{name}</h3>
      <p className="mt-1 font-serif text-3xl font-semibold tabular-nums text-ink">{price}</p>
      <p className="mt-1 text-sm text-slate">{copy.pricingUnlimited}</p>
      <dl className="mt-5 flex flex-1 flex-col gap-3">
        {labels.map((label, index) => (
          <div key={label} className="flex items-start justify-between gap-3 text-sm">
            <dt className="text-slate">{label}</dt>
            <dd className="text-right font-medium text-ink">{rows[index]}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-6">
        <CtaLink location="pricing" variant={featured ? "default" : "outline"} />
      </div>
    </article>
  );
}
