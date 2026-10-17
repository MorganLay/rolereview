"use client";

import Link from "next/link";

import { strings } from "@/copy/strings";

/** Placeholder until T11.1 usage & gating. Free plan default: 3 tailored resumes. */
const PLACEHOLDER_USED = 0;
const PLACEHOLDER_LIMIT = 3;

export function UsagePill() {
  const label = strings.shell.usagePill
    .replace("{used}", String(PLACEHOLDER_USED))
    .replace("{limit}", String(PLACEHOLDER_LIMIT));
  const aria = strings.shell.usagePillAria
    .replace("{used}", String(PLACEHOLDER_USED))
    .replace("{limit}", String(PLACEHOLDER_LIMIT));

  return (
    <Link
      href="/settings"
      aria-label={aria}
      className="block rounded-lg border border-line bg-surface px-3 py-2 text-xs text-slate transition-colors hover:border-pine hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine"
    >
      <span className="font-medium text-ink">{label}</span>
      <span className="mt-0.5 block">{strings.shell.planAndBilling}</span>
    </Link>
  );
}
