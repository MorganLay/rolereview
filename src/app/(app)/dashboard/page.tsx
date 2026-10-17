import { strings } from "@/copy/strings";

/** Placeholder until T1.3 app shell. Protected by proxy.ts. */
export default function DashboardPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-paper px-6 py-24 text-ink">
      <main className="flex max-w-md flex-col items-center gap-3 text-center">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          {strings.dashboard.title}
        </h1>
        <p className="text-slate">{strings.dashboard.signedInBody}</p>
      </main>
    </div>
  );
}
