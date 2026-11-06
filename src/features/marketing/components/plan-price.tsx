import { strings } from "@/copy/strings";
import type { PricingInterval } from "@/features/marketing/present";

const copy = strings.marketing.home;

/** Amount, billing period, and what happens when the plan renews or is cancelled. */
export function PlanPrice({
  amount,
  interval,
  equivalent,
}: {
  amount: string;
  interval: PricingInterval;
  equivalent: string;
}) {
  const quarterly = interval === "QUARTER";
  return (
    <>
      <p className="mt-1 font-serif text-3xl font-semibold tabular-nums text-ink">{amount}</p>
      <p className="mt-1 text-sm text-slate">
        {quarterly ? copy.pricingQuarterlyCaption : copy.pricingMonthlyCaption}
      </p>
      {quarterly ? (
        <p className="mt-1 text-sm text-slate">{copy.pricingEquivalent(equivalent)}</p>
      ) : null}
      <p className="mt-2 text-sm leading-relaxed text-slate">
        {quarterly ? copy.pricingQuarterlyRenewal : copy.pricingMonthlyRenewal}
      </p>
    </>
  );
}
