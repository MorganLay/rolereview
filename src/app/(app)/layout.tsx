import { Suspense } from "react";
import { connection } from "next/server";

import { AppShell } from "@/components/shell/app-shell";
import { strings } from "@/copy/strings";
import { TimezoneCapture } from "@/features/account/components/timezone-capture";
import { allowanceCatalog, checkoutPrices } from "@/features/billing/catalog";
import { presentTailorPill } from "@/features/billing/present";
import { getCheckoutContext } from "@/features/billing/queries";
import { quotaSnapshot } from "@/features/billing/quota";
import { listDueReminders } from "@/features/tracking/queries";
import { requireUser } from "@/lib/auth";

/** Auth shell blocks on session + User upsert — not an instant static shell. */
export const instant = false;

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<AppShellFallback />}>
      <AppShellWithUser>{children}</AppShellWithUser>
    </Suspense>
  );
}

async function AppShellWithUser({ children }: { children: React.ReactNode }) {
  await connection();
  const user = await requireUser();
  const catalog = allowanceCatalog();
  const prices = checkoutPrices();
  const [due, tailor, checkout] = await Promise.all([
    listDueReminders(user.id),
    quotaSnapshot(user, "TAILOR"),
    getCheckoutContext(user.id),
  ]);

  return (
    <AppShell
      userEmail={user.email}
      reminders={due.reminders}
      usage={presentTailorPill({
        used: tailor.used,
        allowance: tailor.allowance,
        bonus: tailor.bonus,
        period: catalog.TAILOR.period,
      })}
      catalog={catalog}
      prices={prices}
      foundingEligible={checkout?.foundingEligible ?? false}
      hasCustomer={checkout?.hasCustomer ?? false}
      paymentFailed={checkout?.paymentFailed ?? false}
      plan={checkout?.plan ?? user.plan}
    >
      <TimezoneCapture />
      {children}
    </AppShell>
  );
}

function AppShellFallback() {
  return (
    <div className="flex min-h-full items-center justify-center bg-paper text-slate">
      {strings.common.loading}
    </div>
  );
}
