import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { strings } from "@/copy/strings";
import { HealthCard } from "@/features/library/components/health-card";
import { LibraryEmpty } from "@/features/library/components/library-empty";
import { LibrarySections } from "@/features/library/components/library-sections";
import { ProfileCard } from "@/features/library/components/profile-card";
import { SkillList } from "@/features/library/components/skill-list";
import { libraryHealth } from "@/features/library/health";
import { getLibrary } from "@/features/library/queries";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: strings.pages.library.title,
  description: strings.pages.library.body,
};

/** Profile comes from the signed-in user row — not an instant static shell. */
export const instant = false;

export default async function LibraryPage() {
  const user = await requireUser();
  const library = await getLibrary(user.id);
  if (!library) notFound();

  const skillNames = library.skills.map((skill) => skill.name);
  const empty = library.entries.length === 0 && library.skills.length === 0;

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
      <HealthCard health={libraryHealth(library)} />
      {empty ? (
        <LibraryEmpty
          entries={library.entries}
          skills={library.skills}
          skillNames={skillNames}
        />
      ) : (
        <>
          <LibrarySections entries={library.entries} skills={skillNames} />
          <SkillList skills={library.skills} />
        </>
      )}
    </div>
  );
}
