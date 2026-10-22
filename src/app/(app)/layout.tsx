import { Suspense } from "react";
import { connection } from "next/server";

import { AppShell } from "@/components/shell/app-shell";
import { strings } from "@/copy/strings";
import { TimezoneCapture } from "@/features/account/components/timezone-capture";
import { allowanceCatalog } from "@/features/billing/catalog";
import { presentTailorPill } from "@/features/billing/present";
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
  const [due, tailor] = await Promise.all([
    listDueReminders(user.id),
    quotaSnapshot(user, "TAILOR"),
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
