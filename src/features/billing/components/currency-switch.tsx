"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { strings } from "@/copy/strings";
import type { PlanCurrency } from "@/features/billing/currency";

import { setPlanCurrency } from "../actions";

const copy = strings.billing;

export function CurrencySwitch({ currency }: { currency: PlanCurrency }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function choose(next: PlanCurrency) {
    if (next === currency || pending) return;
    setPending(true);
    const result = await setPlanCurrency({ currency: next });
    if (!result.ok) {
      toast.error(copy.currencyFailed);
      setPending(false);
      return;
    }
    router.refresh();
    setPending(false);
  }

  return (
    <fieldset className="flex flex-col gap-2" disabled={pending}>
      <legend className="text-sm font-medium text-ink">{copy.currencyLabel}</legend>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <CurrencyChoice
          currency={currency}
          value="USD"
          label={copy.currencyUsd}
          onChoose={choose}
        />
        <CurrencyChoice
          currency={currency}
          value="CAD"
          label={copy.currencyCad}
          onChoose={choose}
        />
      </div>
    </fieldset>
  );
}

function CurrencyChoice({
  currency,
  value,
  label,
  onChoose,
}: {
  currency: PlanCurrency;
  value: PlanCurrency;
  label: string;
  onChoose: (next: PlanCurrency) => void;
}) {
  return (
    <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
      <input
        type="radio"
        name="plan-currency"
        value={value}
        checked={currency === value}
        onChange={() => onChoose(value)}
      />
      {label}
    </label>
  );
}
