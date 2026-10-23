import { strings } from "@/copy/strings";
import {
  formatChangelogDate,
  parseChangelogDate,
} from "@/features/marketing/changelog";
import type { ChangelogEntry } from "@/features/marketing/changelog-entries";

const copy = strings.marketing.changelog;

export function ChangelogPage({
  entries,
}: {
  entries: readonly ChangelogEntry[];
}) {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="font-serif text-4xl font-semibold tracking-tight text-ink">
        {copy.title}
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-slate">{copy.intro}</p>

      {entries.length === 0 ? (
        <p className="mt-10 text-base text-slate">{copy.empty}</p>
      ) : (
        <div className="mt-12 space-y-12">
          {entries.map((entry) => {
            const dateTime = parseChangelogDate(entry.date) ? entry.date : undefined;
            const Content = entry.Content;
            return (
              <article
                key={`${entry.date}-${entry.title}`}
                className="border-t border-line pt-8"
              >
                <time dateTime={dateTime} className="text-sm text-slate">
                  {formatChangelogDate(entry.date)}
                </time>
                <h2 className="mt-2 font-serif text-2xl font-semibold tracking-tight text-ink">
                  {entry.title}
                </h2>
                <div className="mt-4">
                  <Content />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
