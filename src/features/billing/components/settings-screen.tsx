import Link from "next/link";
import { Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { strings } from "@/copy/strings";
import { DataPanel } from "@/features/account/components/data-panel";
import { PreferencesForm } from "@/features/account/components/preferences-form";
import type { AccountPreferences } from "@/features/account/preferences";

import type { PlanBilling } from "../queries";
import { CheckoutActions } from "./checkout-actions";
import { CurrencySwitch } from "./currency-switch";
import { PlanUpgradeButton } from "./plan-upgrade-button";
import {
  SETTINGS_TABS,
  presentCheckoutNotice,
  presentPlanSummary,
  presentUsageRow,
  settingsHref,
  type CheckoutPrices,
  type SettingsTab,
} from "../present";

const copy = strings.billing;
const page = strings.pages.settings;

export function SettingsScreen({
  tab,
  billing,
  preferences,
  prices,
  upgraded,
  showTestPreview,
  currencyLocked,
}: {
  tab: SettingsTab;
  billing: PlanBilling | null;
  preferences: AccountPreferences | null;
  prices: CheckoutPrices;
  upgraded: boolean;
  showTestPreview: boolean;
  currencyLocked: boolean;
}) {
  return (
    <div className="mx-auto flex w-full min-w-0 max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-ink md:text-3xl">
          {page.title}
        </h1>
        <p className="mt-2 text-sm text-slate">{page.body}</p>
      </div>
      <nav aria-label={copy.tabsLabel} className="flex flex-wrap gap-1">
        {SETTINGS_TABS.map((key) => (
          <Button
            key={key}
            variant={tab === key ? "default" : "ghost"}
            size="sm"
            asChild
          >
            <Link href={settingsHref(key)} aria-current={tab === key ? "page" : undefined}>
              {copy.tabs[key]}
            </Link>
          </Button>
        ))}
      </nav>
      {tab === "plan" && billing ? (
        <PlanPanel
          billing={billing}
          prices={prices}
          upgraded={upgraded}
          showTestPreview={showTestPreview}
          currencyLocked={currencyLocked}
        />
      ) : tab === "preferences" && preferences ? (
        <PreferencesForm preferences={preferences} />
      ) : tab === "data" ? (
        <DataPanel />
      ) : (
        <Later />
      )}
    </div>
  );
}

function PlanPanel({
  billing,
  prices,
  upgraded,
  showTestPreview,
  currencyLocked,
}: {
  billing: PlanBilling;
  prices: CheckoutPrices;
  upgraded: boolean;
  showTestPreview: boolean;
  currencyLocked: boolean;
}) {
  const summary = presentPlanSummary({
    plan: billing.plan,
    billingInterval: billing.billingInterval,
    currentPeriodEnd: billing.currentPeriodEnd,
    cancelAtPeriodEnd: billing.cancelAtPeriodEnd,
    foundingMember: billing.foundingMember,
    timeZone: billing.timeZone,
  });
  const notice = presentCheckoutNotice({ returned: upgraded, plan: billing.plan });
  const rows = billing.usage.map(presentUsageRow);
  const currencyName = copy.currencyNames[prices.currency];

  return (
    <div className="flex flex-col gap-6">
      {notice ? (
        <p
          role="status"
          className={
            notice.tone === "active"
              ? "flex items-start gap-2 rounded-card border border-pine/25 bg-pine-50 px-3 py-2 text-sm text-ink"
              : "rounded-card border border-line bg-surface px-3 py-2 text-sm text-ink"
          }
        >
          {notice.tone === "active" ? (
            <Check className="mt-0.5 size-4 shrink-0 text-pine" aria-hidden />
          ) : null}
          {notice.message}
        </p>
      ) : null}
      <section
        aria-labelledby="plan-heading"
        className="flex flex-col gap-4 rounded-card border border-line bg-surface p-4 sm:p-5"
      >
        <h2 id="plan-heading" className="text-base font-medium text-ink">
          {copy.planHeading}
        </h2>
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-medium text-ink">{summary.plan}</p>
            {summary.founding ? <Badge variant="outline">{summary.founding}</Badge> : null}
          </div>
          {summary.interval ? <p className="text-sm text-slate">{summary.interval}</p> : null}
          {summary.renewal ? (
            <p className="text-sm text-slate tabular-nums">{summary.renewal}</p>
          ) : null}
          {currencyLocked ? (
            <p className="text-sm text-slate">{copy.billedIn(currencyName)}</p>
          ) : (
            <div className="mt-2 flex flex-col gap-2">
              <CurrencySwitch currency={prices.currency} />
              <p className="text-sm text-slate">{copy.billedIn(currencyName)}</p>
            </div>
          )}
        </div>
        {billing.plan === "FREE" ? (
          <div>
            <PlanUpgradeButton />
          </div>
        ) : null}
        <CheckoutActions
          prices={prices}
          foundingEligible={billing.foundingEligible}
          hasCustomer={billing.hasCustomer}
          plan={billing.plan}
          showTestPreview={showTestPreview}
          showPlanLine={false}
        />
      </section>
      <section
        aria-labelledby="usage-heading"
        className="flex flex-col gap-4 rounded-card border border-line bg-surface p-4 sm:p-5"
      >
        <div className="flex flex-col gap-1">
          <h2 id="usage-heading" className="text-base font-medium text-ink">
            {copy.usage}
          </h2>
          <p className="text-sm text-slate">{copy.periods.month}</p>
        </div>
        <ul className="flex flex-col gap-5">
          {rows.map((row) => (
            <li key={row.meter} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-ink">{row.label}</span>
                <span className="text-sm font-medium text-ink tabular-nums">{row.count}</span>
              </div>
              {row.note ? <p className="text-xs text-slate">{row.note}</p> : null}
              <Progress value={row.percent} aria-label={row.aria} className="h-2 bg-line" />
              {row.bonus ? (
                <p className="text-sm text-slate tabular-nums">{row.bonus}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Later() {
  return <p className="text-sm text-slate">{strings.shell.placeholderBody}</p>;
}
