"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { strings } from "@/copy/strings";

import type { LibraryEntry, LibrarySkill } from "../types";
import { LibrarySections } from "./library-sections";
import { SkillList } from "./skill-list";

type LibraryEmptyProps = {
  entries: LibraryEntry[];
  skills: LibrarySkill[];
  skillNames: readonly string[];
};

const copy = strings.library.empty;

/** Shown when the library has no entries and no skills. Add manually reveals the editors. */
export function LibraryEmpty({
  entries,
  skills,
  skillNames,
}: LibraryEmptyProps) {
  const [manual, setManual] = useState(false);

  if (manual) {
    return (
      <>
        <LibrarySections entries={entries} skills={skillNames} />
        <SkillList skills={skills} />
      </>
    );
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-base font-medium text-ink">{copy.title}</h2>
        <p className="text-sm text-slate">{copy.body}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 sm:flex-row">
        <Button asChild className="w-full sm:w-auto">
          <Link href="/library/import">{strings.library.importResume}</Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          onClick={() => setManual(true)}
        >
          {copy.addManually}
        </Button>
      </CardContent>
    </Card>
  );
}
