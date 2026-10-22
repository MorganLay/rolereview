import { strings } from "@/copy/strings";
import { TodayPanel } from "@/features/tracking/components/today-panel";
import { listToday } from "@/features/tracking/queries";
import { requireUser } from "@/lib/auth";

/** Today is read for the signed-in user. */
export const instant = false;

export default async function DashboardPage() {
  const user = await requireUser();
  const today = await listToday(user.id);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-ink md:text-3xl">
          {strings.pages.dashboard.title}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-slate">{strings.pages.dashboard.body}</p>
      </div>
      <TodayPanel due={today.reminders} upcoming={today.interviews} />
    </div>
  );
}
