/**
 * Display values for the usage pill, Plan & billing, and the upgrade modal.
 * Allowances are passed in. They are read from `plans.ts` on the server.
 */

import { strings } from "@/copy/strings";

import type { PlanCurrency } from "./currency";

const copy = strings.billing;
const upgrade = strings.upgrade;
const pill = strings.shell;

export const USAGE_METERS = ["TAILOR", "COVER_LETTER", "IMPORT", "ANALYZE"] as const;

export type UsageMeter = (typeof USAGE_METERS)[number];

export type QuotaPeriod = "month" | "day";

export type MeterAllowance = {
  free: number;
  pro: number;
  period: QuotaPeriod;
  dailyCapFree: number | null;
  dailyCapPro: number | null;
};

export type AllowanceCatalog = Record<UsageMeter, MeterAllowance>;

export type UsageSnapshot = {
  meter: UsageMeter;
  used: number;
  allowance: number;
  bonus: number;
  period: QuotaPeriod;
  /** UTC-day abuse ceiling for this plan. Null when the meter has none. */
  dailyCap: number | null;
};

export type UsageRowView = {
  meter: UsageMeter;
  label: string;
  period: string;
  count: string;
  bonus: string | null;
  percent: number;
  aria: string;
};

export type TailorPillView = {
  label: string;
  extra: string | null;
  aria: string;
};

export const SETTINGS_TABS = ["plan", "profile", "preferences", "data"] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number];

export type ProFeatureLock = "templates" | "docx" | "insights:whats-working";

export type UpgradeTarget =
  | { kind: "quota"; meter: UsageMeter }
  | { kind: "feature"; feature: ProFeatureLock }
  | { kind: "plan" };

export type PlanSummaryInput = {
  plan: "FREE" | "PRO";
  billingInterval: "MONTH" | "QUARTER" | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  foundingMember: boolean;
  timeZone: string;
};

export type PlanSummaryView = {
  plan: string;
  interval: string | null;
  renewal: string | null;
  founding: string | null;
};

export function parseSettingsTab(value: string | string[] | undefined): SettingsTab {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "profile" || raw === "preferences" || raw === "data") return raw;
  return "plan";
}

export function settingsHref(tab: SettingsTab): string {
  return `/settings?tab=${tab}`;
}

export function checkoutConfirmed(value: string | string[] | undefined): boolean {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "1";
}

export type CheckoutPrices = {
  currency: PlanCurrency;
  monthly: string;
  quarterly: string;
  /** Monthly equivalent of the 90-day price, for comparison. The 90-day amount is charged up front. */
  quarterlyEquivalent: string;
  foundingMonthly: string;
  foundingQuarterly: string;
  foundingPercent: number;
};

/** Whole dollars stay without cents. USD is prefixed US$, CAD is prefixed CA$. Amounts live in `plans.ts`. */
export function formatPlanPrice(dollars: number, currency: PlanCurrency): string | null {
  if (!Number.isFinite(dollars)) return null;
  const cents = Math.round(dollars * 100);
  const hasCents = cents % 100 !== 0;
  const formatted = new Intl.NumberFormat(currency === "CAD" ? "en-CA" : "en-US", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
  if (currency === "CAD") {
    return formatted.startsWith("CA$") ? formatted : `CA${formatted}`;
  }
  if (formatted.startsWith("US$")) return formatted;
  if (formatted.startsWith("$")) return `US${formatted}`;
  return `US$${formatted}`;
}

/** One third of the 90-day price, rounded to cents. Null when the amount is unusable. */
export function monthlyEquivalent(quarterly: number): number | null {
  if (!Number.isFinite(quarterly) || quarterly < 0) return null;
  return Math.round((quarterly / 3) * 100) / 100;
}

/** Price after a percent-off coupon. Null when the inputs are unusable. */
export function discountedPrice(amount: number, percentOff: number): number | null {
  if (!Number.isFinite(amount) || amount < 0) return null;
  if (!Number.isFinite(percentOff) || percentOff < 0 || percentOff > 100) return null;
  const cents = Math.round(amount * 100);
  const discounted = Math.round((cents * (100 - percentOff)) / 100);
  return discounted / 100;
}

export function presentCheckoutPrices(input: {
  currency: PlanCurrency;
  monthly: number;
  quarterly: number;
  foundingPercent: number;
}): CheckoutPrices | null {
  const foundingMonthly = discountedPrice(input.monthly, input.foundingPercent);
  const foundingQuarterly = discountedPrice(input.quarterly, input.foundingPercent);
  const equivalent = monthlyEquivalent(input.quarterly);
  if (foundingMonthly == null || foundingQuarterly == null || equivalent == null) return null;
  const monthly = formatPlanPrice(input.monthly, input.currency);
  const quarterly = formatPlanPrice(input.quarterly, input.currency);
  const quarterlyEquivalent = formatPlanPrice(equivalent, input.currency);
  const foundingMonthlyLabel = formatPlanPrice(foundingMonthly, input.currency);
  const foundingQuarterlyLabel = formatPlanPrice(foundingQuarterly, input.currency);
  if (
    !monthly ||
    !quarterly ||
    !quarterlyEquivalent ||
    !foundingMonthlyLabel ||
    !foundingQuarterlyLabel
  ) {
    return null;
  }
  return {
    currency: input.currency,
    monthly,
    quarterly,
    quarterlyEquivalent,
    foundingMonthly: foundingMonthlyLabel,
    foundingQuarterly: foundingQuarterlyLabel,
    foundingPercent: input.foundingPercent,
  };
}

/** Whole-number count. Anything unusable is 0. */
function count(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.trunc(value);
}

/** Share of the plan allowance, capped at 100. A non-positive allowance is empty unless something was used. */
export function usagePercent(used: number, allowance: number): number {
  const spent = count(used);
  if (!Number.isFinite(allowance) || allowance <= 0) {
    return spent > 0 ? 100 : 0;
  }
  return Math.min(100, Math.round((spent / allowance) * 100));
}

function extraLabel(bonus: number): string | null {
  const left = count(bonus);
  if (left === 0) return null;
  return copy.extra(left);
}

export function presentUsageRow(row: UsageSnapshot): UsageRowView {
  const used = count(row.used);
  const allowance = count(row.allowance);
  const bonus = extraLabel(row.bonus);
  const label = copy.meters[row.meter];
  const period =
    row.dailyCap != null && row.dailyCap > 0
      ? copy.periods.monthWithDay(row.dailyCap)
      : copy.periods[row.period];
  const countLabel = copy.ofAllowance(used, allowance);
  return {
    meter: row.meter,
    label,
    period,
    count: countLabel,
    bonus,
    percent: usagePercent(used, allowance),
    aria: copy.barAria(label, period, countLabel, bonus),
  };
}

export function presentTailorPill(input: {
  used: number;
  allowance: number;
  bonus: number;
  period: QuotaPeriod;
}): TailorPillView {
  const used = count(input.used);
  const allowance = count(input.allowance);
  const extra = extraLabel(input.bonus);
  const period = copy.periods[input.period].toLowerCase();
  return {
    label: pill.usagePill(used, allowance),
    extra,
    aria: pill.usagePillAria(used, allowance, period, extra),
  };
}

export function presentPlanSummary(input: PlanSummaryInput): PlanSummaryView {
  const interval =
    input.plan === "PRO" && input.billingInterval
      ? copy.intervals[input.billingInterval]
      : null;
  const renewal = input.plan === "PRO" ? renewalLabel(input) : null;
  return {
    plan: copy.plans[input.plan],
    interval,
    renewal,
    founding: input.foundingMember ? copy.founding : null,
  };
}

function renewalLabel(input: PlanSummaryInput): string | null {
  if (!input.currentPeriodEnd || Number.isNaN(input.currentPeriodEnd.getTime())) {
    return null;
  }
  const date =
    formatPlanDate(input.currentPeriodEnd, input.timeZone) ??
    formatPlanDate(input.currentPeriodEnd, "UTC");
  if (!date) return null;
  return input.cancelAtPeriodEnd ? copy.ends(date) : copy.renews(date);
}

function formatPlanDate(date: Date, timeZone: string): string | null {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  } catch {
    return null;
  }
}

export function presentUpgrade(
  target: UpgradeTarget,
  catalog: AllowanceCatalog,
): { title: string; description: string } {
  const detail =
    target.kind === "plan"
      ? upgrade.plan
      : target.kind === "feature"
        ? upgrade.features[target.feature]
        : quotaDetail(target.meter, catalog);
  return {
    title: upgrade.title,
    description: detail,
  };
}

function quotaDetail(meter: UsageMeter, catalog: AllowanceCatalog): string {
  const limits = catalog[meter];
  if (meter === "ANALYZE") {
    return upgrade.quota.ANALYZE(
      count(limits.free),
      count(limits.pro),
      count(limits.dailyCapFree ?? 0),
      count(limits.dailyCapPro ?? 0),
    );
  }
  return upgrade.quota[meter](count(limits.free), count(limits.pro));
}
