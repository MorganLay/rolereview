import { strings } from "@/copy/strings";

import type { ProfileFieldId } from "../health";
import type { LibraryProfile } from "../types";
import type { WordingView } from "../wording";
import { ProfileDialog } from "./profile-dialog";
import { ProfileWording } from "./profile-wording";

type ProfileCardProps = {
  profile: LibraryProfile;
  wordings: readonly WordingView[];
  focusField: ProfileFieldId | null;
  openToken: number;
};

const copy = strings.library.profile;

export function ProfileCard({ profile, wordings, focusField, openToken }: ProfileCardProps) {
  const name = profile.fullName?.trim() || null;
  const meta = [profile.headline, profile.location, profile.email].filter(
    (part): part is string => Boolean(part && part.trim().length > 0),
  );

  return (
    <section className="rounded-lg border border-line bg-surface px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className={name ? "text-base font-medium text-ink" : "text-base font-medium text-slate"}>
            {name ?? copy.emptyName}
          </h2>
          {meta.length > 0 ? (
            <p className="mt-0.5 truncate text-sm text-slate">{meta.join(" · ")}</p>
          ) : null}
        </div>
        <ProfileDialog profile={profile} focusField={focusField} openToken={openToken} />
      </div>
      {profile.summary ? (
        <p className="mt-2 line-clamp-2 text-sm whitespace-pre-wrap text-ink">{profile.summary}</p>
      ) : (
        <p className="mt-2 text-sm text-slate">{copy.emptySummary}</p>
      )}
      <div className="mt-3 grid gap-3">
        <ProfileWording kind="HEADLINE" wordings={wordings} />
        <ProfileWording kind="SUMMARY" wordings={wordings} />
      </div>
    </section>
  );
}
