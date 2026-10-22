import Link from "next/link";
import { TriangleAlertIcon } from "lucide-react";

import { strings } from "@/copy/strings";
import { settingsHref } from "@/features/billing/present";

const copy = strings.billing;

/** Shown while Stripe reports the subscription as past due or unpaid. */
export function PaymentFailedBanner() {
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-md border border-line bg-marigold-100 px-3 py-2 text-sm text-ink"
    >
      <TriangleAlertIcon
        className="mt-0.5 size-4 shrink-0 text-marigold-700"
        aria-hidden
      />
      <span>
        {copy.paymentFailed}{" "}
        <Link
          href={settingsHref("plan")}
          className="font-medium text-pine underline-offset-2 hover:underline"
        >
          {copy.paymentFailedAction}
        </Link>
      </span>
    </p>
  );
}
