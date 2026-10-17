import { strings } from "@/copy/strings";
import { requireAdmin } from "@/lib/auth";

/** Stub until Phase 20 admin UI. requireAdmin → 404 for non-admins. */
export default async function AdminPage() {
  await requireAdmin();

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-paper px-6 py-24 text-ink">
      <main className="flex max-w-md flex-col items-center gap-3 text-center">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          {strings.admin.title}
        </h1>
        <p className="text-slate">{strings.admin.body}</p>
      </main>
    </div>
  );
}
