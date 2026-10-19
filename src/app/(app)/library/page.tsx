import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { strings } from "@/copy/strings";
import { ProfileCard } from "@/features/library/components/profile-card";
import { getLibrary } from "@/features/library/queries";
import { requireUser } from "@/lib/auth";

/** Profile comes from the signed-in user row — not an instant static shell. */
export const instant = false;

export default async function LibraryPage() {
  const user = await requireUser();
  const library = await getLibrary(user.id);
  if (!library) notFound();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-ink md:text-3xl">
            {strings.pages.library.title}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-slate">
            {strings.pages.library.body}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/library/import">{strings.library.importResume}</Link>
        </Button>
      </div>
      <ProfileCard profile={library.profile} />
    </div>
  );
}
