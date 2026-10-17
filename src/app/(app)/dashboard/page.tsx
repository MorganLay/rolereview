import { SignOutButton } from "@/features/account/components/sign-out-button";
import { strings } from "@/copy/strings";
import { requireUser } from "@/lib/auth";

/** Placeholder until T1.3 app shell. Protected by proxy + requireUser. */
export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-paper px-6 py-24 text-ink">
      <main className="flex max-w-md flex-col items-center gap-4 text-center">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          {strings.dashboard.title}
        </h1>
        <p className="text-slate">{strings.dashboard.signedInBody}</p>
        <p className="text-sm text-slate">{user.email}</p>
        <SignOutButton />
      </main>
    </div>
  );
}
