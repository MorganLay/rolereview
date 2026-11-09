"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { strings } from "@/copy/strings";
import { ENTRY_KINDS } from "@/features/library/schemas";

import { libraryHealth } from "../health";
import type { LibraryFocus, ProfileFieldId } from "../health";
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
  const [libraryFocus, setLibraryFocus] = useState<LibraryFocus | null>(null);
  const skillNames = library.skills.map((skill) => skill.name);
  const empty = library.entries.length === 0 && library.skills.length === 0;
  const health = libraryHealth(library);

  useEffect(() => {
    if (!libraryFocus || libraryFocus.bulletIds.length === 0) return;
    const firstId = libraryFocus.bulletIds[0];
    if (!firstId) return;
    const timer = window.setTimeout(() => {
      document.getElementById(`bullet-${firstId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 60);
    return () => window.clearTimeout(timer);
  }, [libraryFocus]);

  return (
    <div className="flex w-full min-w-0 flex-col gap-6 md:gap-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-serif text-[1.75rem] font-semibold tracking-tight text-ink md:text-[2rem]">
            {strings.pages.library.title}
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate">
            {strings.pages.library.body}
          </p>
        </div>
        <Button variant="outline" asChild className="shrink-0">
          <Link href="/library/import">{strings.library.importResume}</Link>
        </Button>
      </div>

      <div className="grid min-w-0 gap-3">
        <ProfileCard
          profile={library.profile}
          wordings={wordings}
          focusField={focus?.field ?? null}
          openToken={focus?.token ?? 0}
        />
        <HealthCard
          health={health}
          focus={libraryFocus}
          onOpenField={(field) =>
            setFocus((current) => ({ field, token: (current?.token ?? 0) + 1 }))
          }
          onFocus={setLibraryFocus}
          onClearFocus={() => setLibraryFocus(null)}
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
            kinds={["EXPERIENCE"]}
            focus={libraryFocus}
          />
          <LibrarySections
            entries={library.entries}
            skills={skillNames}
            wordings={wordings}
            kinds={REST_KINDS}
            focus={libraryFocus}
          />
          <SkillList skills={library.skills} />
        </>
      )}
    </div>
  );
}
