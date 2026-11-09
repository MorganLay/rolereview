"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { strings } from "@/copy/strings";
import { ENTRY_KINDS } from "@/features/library/schemas";

import { libraryHealth } from "../health";
import type { ProfileFieldId } from "../health";
import type { Library } from "../types";
import type { WordingView } from "../wording";
import { HealthCard } from "./health-card";
import { LibraryEmpty } from "./library-empty";
import { LibrarySections } from "./library-sections";
import { ProfileCard } from "./profile-card";
import { SkillList } from "./skill-list";

const REST_KINDS = ENTRY_KINDS.filter((kind) => kind !== "EXPERIENCE");

export function LibraryScreen({
  library,
  wordings,
}: {
  library: Library;
  wordings: readonly WordingView[];
}) {
  const [focus, setFocus] = useState<{ field: ProfileFieldId; token: number } | null>(null);
  const skillNames = library.skills.map((skill) => skill.name);
  const empty = library.entries.length === 0 && library.skills.length === 0;
  const health = libraryHealth(library);

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-ink md:text-3xl">
            {strings.pages.library.title}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-slate">{strings.pages.library.body}</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/library/import">{strings.library.importResume}</Link>
        </Button>
      </div>
      {empty ? null : (
        <LibrarySections
          entries={library.entries}
          skills={skillNames}
          wordings={wordings}
          kinds={["EXPERIENCE"]}
        />
      )}
      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(16rem,22rem)]">
        <ProfileCard
          profile={library.profile}
          wordings={wordings}
          focusField={focus?.field ?? null}
          openToken={focus?.token ?? 0}
        />
        <HealthCard
          health={health}
          onOpenField={(field) =>
            setFocus((current) => ({ field, token: (current?.token ?? 0) + 1 }))
          }
        />
      </div>
      {empty ? (
        <LibraryEmpty
          entries={library.entries}
          skills={library.skills}
          skillNames={skillNames}
          wordings={wordings}
        />
      ) : (
        <>
          <LibrarySections
            entries={library.entries}
            skills={skillNames}
            wordings={wordings}
            kinds={REST_KINDS}
          />
          <SkillList skills={library.skills} />
        </>
      )}
    </div>
  );
}
