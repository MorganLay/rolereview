import Link from "next/link";

import { strings } from "@/copy/strings";
import { settingsHref } from "@/features/billing/present";
import type { TailorPillView } from "@/features/billing/present";

export function UsagePill({ usage }: { usage: TailorPillView }) {
  return (
    <Link
      href={settingsHref("plan")}
      aria-label={usage.aria}
      className="block rounded-lg border border-line bg-surface px-3 py-2 text-xs text-slate transition-colors hover:border-pine hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine"
    >
      <span className="font-medium text-ink tabular-nums">{usage.label}</span>
      {usage.extra ? (
        <span className="mt-0.5 block tabular-nums text-ink">{usage.extra}</span>
      ) : null}
      <span className="mt-0.5 block">{strings.shell.planAndBilling}</span>
    </Link>
  );
}
