"use client";

import { useState } from "react";

import { strings } from "@/copy/strings";
import { cn } from "@/lib/utils";

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
const SUMMARY_COLLAPSE_AT = 220;

export function ProfileCard({ profile, wordings, focusField, openToken }: ProfileCardProps) {
  const [variantsOpen, setVariantsOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const name = profile.fullName?.trim() || null;
  const headline = profile.headline?.trim() || null;
  const location = profile.location?.trim() || null;
  const phone = profile.phone?.trim() || null;
  const summary = profile.summary?.trim() || null;
  const headlines = wordings.filter((item) => item.kind === "HEADLINE" && item.jobId === null);
  const summaries = wordings.filter((item) => item.kind === "SUMMARY" && item.jobId === null);
  const variantLabel = copy.variantCount(headlines.length, summaries.length);
  const meta = [location, phone].filter((part): part is string => Boolean(part && part.length > 0));
  const summaryLong = Boolean(summary && summary.length > SUMMARY_COLLAPSE_AT);

  return (
    <section className="rounded-[var(--radius-card)] border border-line bg-surface">
      <div className="flex items-start justify-between gap-4 px-4 py-4 sm:px-5">
        <div className="min-w-0 flex-1">
          <h2
            className={cn(
              "font-serif text-xl font-semibold tracking-tight text-balance sm:text-[1.375rem]",
              name ? "text-ink" : "text-slate",
            )}
          >
            {name ?? copy.emptyName}
          </h2>

          {headline ? (
            <p className="mt-1.5 max-w-3xl text-[0.9375rem] leading-snug text-ink/90 text-pretty">
              {headline}
            </p>
          ) : (
            <p className="mt-1.5 text-sm text-slate">{copy.emptyHeadline}</p>
          )}

          {meta.length > 0 ? (
            <p className="mt-2 text-[0.8125rem] leading-normal text-slate">
              {meta.join(" · ")}
            </p>
          ) : (
            <p className="mt-2 text-[0.8125rem] text-slate">{copy.emptyLocation}</p>
          )}

          {profile.links.length > 0 ? (
            <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
              {profile.links.map((link) => (
                <li key={`${link.label}-${link.url}`}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[0.8125rem] text-pine underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}

          {summary ? (
            <div className="mt-3 max-w-prose">
              <p
                className={cn(
                  "text-sm leading-relaxed whitespace-pre-wrap text-ink/90",
                  summaryLong && !summaryOpen && "line-clamp-3",
                )}
              >
                {summary}
              </p>
              {summaryLong ? (
                <button
                  type="button"
                  className="mt-1.5 text-[0.8125rem] text-pine underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  aria-expanded={summaryOpen}
                  onClick={() => setSummaryOpen((value) => !value)}
                >
                  {summaryOpen ? copy.hideSummary : copy.showSummary}
                </button>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate">{copy.emptySummary}</p>
          )}

          <button
            type="button"
            className="mt-3 text-[0.8125rem] text-pine underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            aria-expanded={variantsOpen}
            onClick={() => setVariantsOpen((value) => !value)}
          >
            {variantsOpen ? copy.hideVariants : variantLabel}
          </button>
        </div>

        <div className="shrink-0">
          <ProfileDialog profile={profile} focusField={focusField} openToken={openToken} />
        </div>
      </div>

      {variantsOpen ? (
        <div className="grid gap-4 border-t border-line bg-paper/50 px-4 py-3 sm:px-5">
          <ProfileWording kind="HEADLINE" wordings={wordings} defaultOpen />
          <ProfileWording kind="SUMMARY" wordings={wordings} defaultOpen />
        </div>
      ) : null}
    </section>
  );
}
