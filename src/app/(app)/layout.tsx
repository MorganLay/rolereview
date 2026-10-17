import { Suspense } from "react";
import { connection } from "next/server";

import { AppShell } from "@/components/shell/app-shell";
import { strings } from "@/copy/strings";
import { TimezoneCapture } from "@/features/account/components/timezone-capture";
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

  return (
    <AppShell userEmail={user.email}>
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
