"use client";

import { useState } from "react";

import { strings } from "@/copy/strings";
import { cn } from "@/lib/utils";
import type { FaqItem } from "@/features/marketing/faq";
import type {
  ComparisonRow,
  FoundingOfferView,
  MarketingPricingView,
  PricingInterval,
} from "@/features/marketing/present";

import { CtaLink } from "./cta-link";
import { HomeFaq } from "./home-faq";
import { PricingToggle } from "./pricing-toggle";

const home = strings.marketing.home;
const copy = strings.marketing.pricing;

export function PricingExperience({
  pricing,
  comparison,
  founding,
  faqs,
}: {
  pricing: MarketingPricingView;
  comparison: readonly ComparisonRow[];
  founding: FoundingOfferView;
  faqs: readonly FaqItem[];
}) {
  const [interval, setInterval] = useState<PricingInterval>("MONTH");
  const proPrice = interval === "MONTH" ? pricing.monthly : pricing.quarterly;

  return (
    <div className="flex flex-1 flex-col">
      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="max-w-2xl font-serif text-4xl font-semibold tracking-tight text-ink">
          {copy.title}
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-slate">{copy.body}</p>
        <div className="mt-6">
          <PricingToggle
            interval={interval}
            savePercent={pricing.savePercent}
            label={copy.title}
            onChange={setInterval}
          />
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <PlanCard
            name={home.pricingFree}
            price={pricing.free}
            featured={false}
          />
          <PlanCard name={home.pricingPro} price={proPrice} featured />
        </div>

        <p className="mt-6 text-sm text-slate">{home.pricingGuarantee}</p>
      </section>

      <section className="border-t border-line bg-surface">
        <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
          <h2 className="font-serif text-2xl font-semibold tracking-tight text-ink">
            {copy.foundingTitle}
          </h2>
          <p className="mt-3 max-w-2xl text-base text-slate">
            {copy.foundingBody(founding.percent, founding.monthly, founding.quarterly)}
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <h2 className="font-serif text-2xl font-semibold tracking-tight text-ink">
          {home.pricingCompare}
        </h2>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[20rem] border-collapse text-sm">
            <caption className="sr-only">{copy.tableCaption}</caption>
            <thead>
              <tr className="border-b border-line text-left">
                <th scope="col" className="py-3 pr-4 font-medium text-slate">
                  {copy.featureColumn}
                </th>
                <th scope="col" className="py-3 px-3 font-medium text-slate">
                  {home.pricingFree}
                </th>
                <th
                  scope="col"
                  className="py-3 pl-3 font-medium text-ink"
                >
                  {home.pricingPro}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-line">
                <th
                  scope="row"
                  className="py-3 pr-4 text-left font-medium text-ink"
                >
                  {copy.priceRow}
                </th>
                <td className="py-3 px-3 tabular-nums text-slate">{pricing.free}</td>
                <td className="py-3 pl-3 font-medium tabular-nums text-ink">
                  {proPrice}
                </td>
              </tr>
              {comparison.map((row) => (
                <tr key={row.id} className="border-b border-line last:border-0">
                  <th
                    scope="row"
                    className="py-3 pr-4 text-left font-medium text-ink"
                  >
                    {row.label}
                  </th>
                  <td className="py-3 px-3 text-slate">{row.free}</td>
                  <td className="py-3 pl-3 font-medium text-ink">{row.pro}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-6 text-sm text-slate">{home.pricingGuarantee}</p>
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
          <h2 className="font-serif text-2xl font-semibold tracking-tight text-ink">
            {copy.weeklyTitle}
          </h2>
          <p className="mt-3 text-base leading-relaxed text-slate">{copy.weeklyBody}</p>
        </div>
      </section>

      <HomeFaq items={faqs} title={copy.faqTitle} />

      <section className="border-t border-line bg-pine-50">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-start gap-4 px-4 py-16 sm:px-6">
          <h2 className="font-serif text-3xl font-semibold tracking-tight text-ink">
            {home.finalTitle}
          </h2>
          <p className="text-base text-slate">{home.finalBody}</p>
          <CtaLink location="pricing-page" />
        </div>
      </section>
    </div>
  );
}

function PlanCard({
  name,
  price,
  featured,
}: {
  name: string;
  price: string;
  featured: boolean;
}) {
  return (
    <article
      className={cn(
        "flex flex-col rounded-card border bg-paper p-6",
        featured ? "border-pine" : "border-line",
      )}
    >
      <h2 className="text-sm font-medium text-slate">{name}</h2>
      <p className="mt-1 font-serif text-3xl font-semibold tabular-nums text-ink">
        {price}
      </p>
      <p className="mt-1 text-sm text-slate">{home.pricingUnlimited}</p>
      <div className="mt-6">
        <CtaLink
          location="pricing-page"
          variant={featured ? "default" : "outline"}
        />
      </div>
    </article>
  );
}
