import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { strings } from "@/copy/strings";

import { ProfileDialog } from "./profile-dialog";
import type { LibraryProfile } from "../types";

type ProfileCardProps = {
  profile: LibraryProfile;
};

const copy = strings.library.profile;

export function ProfileCard({ profile }: ProfileCardProps) {
  const name = profile.fullName?.trim() || null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            className={
              name
                ? "text-lg font-medium text-ink"
                : "text-lg font-medium text-slate"
            }
          >
            {name ?? copy.emptyName}
          </h2>
          {profile.headline ? (
            <p className="mt-1 text-sm text-slate">{profile.headline}</p>
          ) : null}
        </div>
        <ProfileDialog profile={profile} />
      </CardHeader>
      <CardContent className="grid gap-4">
        <dl className="grid gap-2 text-sm">
          <div className="grid gap-0.5 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-3">
            <dt className="text-slate">{copy.email}</dt>
            <dd className="break-all text-ink">{profile.email}</dd>
          </div>
          {profile.phone ? (
            <div className="grid gap-0.5 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-3">
              <dt className="text-slate">{copy.phone}</dt>
              <dd className="text-ink">{profile.phone}</dd>
            </div>
          ) : null}
          {profile.location ? (
            <div className="grid gap-0.5 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-3">
              <dt className="text-slate">{copy.location}</dt>
              <dd className="text-ink">{profile.location}</dd>
            </div>
          ) : null}
        </dl>

        {profile.links.length > 0 ? (
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {profile.links.map((link) => (
              <li key={`${link.label}-${link.url}`}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-pine underline-offset-4 hover:underline"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="grid gap-1">
          <h3 className="text-base font-medium text-ink">{copy.summary}</h3>
          {profile.summary ? (
            <p className="whitespace-pre-wrap text-sm text-ink">{profile.summary}</p>
          ) : (
            <p className="text-sm text-slate">{copy.emptySummary}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
