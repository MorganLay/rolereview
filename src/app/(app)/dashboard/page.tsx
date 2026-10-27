import type { Metadata } from "next";
import { connection } from "next/server";

import { strings } from "@/copy/strings";
import { GettingStarted } from "@/features/dashboard/components/getting-started";
import { HomeSections } from "@/features/dashboard/components/home-sections";
import { onboardingComplete } from "@/features/dashboard/metrics";
import { completeOnboarding } from "@/features/dashboard/onboarding";
import { getDashboard } from "@/features/dashboard/queries";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: strings.pages.dashboard.title,
  description: strings.pages.dashboard.body,
};

/** The dashboard is read for the signed-in user, including "now". */
export const instant = false;

export default async function DashboardPage() {
  await connection();
  const user = await requireUser();
  const home = await getDashboard(user.id);
  const ready = onboardingComplete(home.steps);
  const justCompleted =
    !home.onboardingCompleted && ready ? await completeOnboarding(user.id) : false;
  const completedAt = home.onboardingCompletedAt?.getTime() ?? null;
  const finishedThisVisit =
    justCompleted ||
    (completedAt !== null && home.asOf.getTime() - completedAt < 60_000);
  const returning = home.onboardingCompleted || justCompleted || ready;

  return (
    <div
      className={
        returning
          ? "mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-8"
          : "mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-8"
      }
    >
      <div>
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-ink md:text-3xl">
          {strings.pages.dashboard.title}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-slate">{strings.pages.dashboard.body}</p>
      </div>
      {finishedThisVisit ? (
        <p role="status" className="text-sm text-ink">
          {strings.pages.dashboard.success}
        </p>
      ) : null}
      {returning ? <HomeSections home={home} /> : <GettingStarted steps={home.steps} />}
    </div>
  );
}
