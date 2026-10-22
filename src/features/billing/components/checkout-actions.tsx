"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { strings } from "@/copy/strings";
import type { CheckoutPrices } from "@/features/billing/present";

import { createCheckoutSession, createPortalSession } from "../actions";

const copy = strings.billing;

type Interval = "MONTH" | "QUARTER";
type PricePreview = "account" | "founding" | "full";
type Pending = Interval | "portal" | null;

export function CheckoutActions({
  prices,
  foundingEligible,
  hasCustomer,
  plan,
  showTestPreview = false,
  fill = false,
}: {
  prices: CheckoutPrices;
  foundingEligible: boolean;
  hasCustomer: boolean;
  plan: "FREE" | "PRO";
  showTestPreview?: boolean;
  fill?: boolean;
}) {
  const router = useRouter();
  const [preview, setPreview] = useState<PricePreview>("account");
  const [pending, setPending] = useState<Pending>(null);
  const founding =
    preview === "founding" ? true : preview === "full" ? false : foundingEligible;
  const monthlyPrice = founding ? prices.foundingMonthly : prices.monthly;
  const quarterlyPrice = founding ? prices.foundingQuarterly : prices.quarterly;
  const showCheckout = plan === "FREE" || !hasCustomer || showTestPreview;
  const buttonClass = fill ? "w-full" : undefined;

  async function startCheckout(interval: Interval) {
    setPending(interval);
    const result = await createCheckoutSession({
      interval,
      ...(showTestPreview && preview === "founding" ? { previewFounding: true } : {}),
      ...(showTestPreview && preview === "full" ? { previewFounding: false } : {}),
    });
    if (!result.ok) {
      toast.error(checkoutError(result.error.code));
      if (result.error.code === "CONFLICT") router.refresh();
      setPending(null);
      return;
    }
    window.location.assign(result.data.url);
  }

  async function startPortal() {
    setPending("portal");
    const result = await createPortalSession({});
    if (!result.ok) {
      toast.error(portalError(result.error.code));
      setPending(null);
      return;
    }
    window.location.assign(result.data.url);
  }

  return (
    <div className="flex flex-col gap-3" aria-busy={pending !== null}>
      {plan === "PRO" ? <p className="text-sm text-ink">{copy.onPro}</p> : null}
      {showCheckout ? (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              type="button"
              className={buttonClass}
              disabled={pending !== null}
              onClick={() => startCheckout("MONTH")}
            >
              {pending === "MONTH"
                ? copy.opening
                : `${copy.intervals.MONTH}, ${monthlyPrice}`}
            </Button>
            <Button
              type="button"
              variant="outline"
              className={buttonClass}
              disabled={pending !== null}
              onClick={() => startCheckout("QUARTER")}
            >
              {pending === "QUARTER"
                ? copy.opening
                : `${copy.intervals.QUARTER}, ${quarterlyPrice}`}
            </Button>
          </div>
          <p className="text-sm text-slate">
            {founding ? copy.foundingPrice(prices.foundingPercent) : copy.promo}
          </p>
        </>
      ) : null}
      {hasCustomer ? (
        <div>
          <Button
            type="button"
            variant={plan === "PRO" ? "default" : "outline"}
            className={buttonClass}
            disabled={pending !== null}
            onClick={startPortal}
          >
            {pending === "portal" ? copy.opening : copy.manage}
          </Button>
        </div>
      ) : null}
      {showTestPreview && showCheckout ? (
        <fieldset className="flex flex-col gap-2 rounded-md border border-line bg-surface p-3">
          <legend className="px-1 text-sm font-medium text-ink">{copy.testLegend}</legend>
          <PriceChoice
            name="billing-price-preview"
            value="account"
            current={preview}
            label={copy.testAccount}
            disabled={pending !== null}
            onChange={setPreview}
          />
          <PriceChoice
            name="billing-price-preview"
            value="founding"
            current={preview}
            label={copy.testFounding}
            disabled={pending !== null}
            onChange={setPreview}
          />
          <PriceChoice
            name="billing-price-preview"
            value="full"
            current={preview}
            label={copy.testFull}
            disabled={pending !== null}
            onChange={setPreview}
          />
          <p className="text-sm text-slate">{copy.testHint}</p>
        </fieldset>
      ) : null}
    </div>
  );
}

function PriceChoice({
  name,
  value,
  current,
  label,
  disabled,
  onChange,
}: {
  name: string;
  value: PricePreview;
  current: PricePreview;
  label: string;
  disabled: boolean;
  onChange: (value: PricePreview) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-ink">
      <input
        type="radio"
        name={name}
        value={value}
        checked={current === value}
        disabled={disabled}
        onChange={() => onChange(value)}
      />
      {label}
    </label>
  );
}

function checkoutError(code: string): string {
  if (code === "UNAUTHENTICATED") return copy.signIn;
  if (code === "CONFLICT") return copy.alreadySubscribed;
  if (code === "VALIDATION") return copy.chooseInterval;
  return copy.unavailable;
}

function portalError(code: string): string {
  if (code === "UNAUTHENTICATED") return copy.signIn;
  if (code === "CONFLICT") return copy.portalFirst;
  return copy.unavailable;
}
