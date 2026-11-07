import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { strings } from "@/copy/strings";
import { devSnapshotsOpen } from "@/features/dev/access";
import { ScenarioList } from "@/features/dev/components/scenario-list";
import { requireUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { SCENARIO_NAMES, parseScenario } from "../../../../prisma/scenarios";

const copy = strings.pages.dev;

export const metadata: Metadata = {
  title: copy.title,
  description: copy.body,
  robots: { index: false, follow: false },
};

/** The seed account is read from the session. Hidden outside local development. */
export const instant = false;

const LINKS = [
  { href: "/dashboard", label: strings.nav.dashboard },
  { href: "/library", label: strings.nav.library },
  { href: "/library/import", label: strings.library.importResume },
  { href: "/jobs", label: strings.nav.jobs },
] as const;

export default async function DevPage({
  searchParams,
}: {
  searchParams: Promise<{ loaded?: string | string[] }>;
}) {
  await connection();
  const user = await requireUser();
  if (
    !devSnapshotsOpen({
      nodeEnv: env.NODE_ENV,
      seedUserId: env.SEED_USER_ID,
      userId: user.id,
    })
  ) {
    notFound();
  }

  const { loaded: loadedParam } = await searchParams;
  const loaded = parseScenario(Array.isArray(loadedParam) ? loadedParam[0] : loadedParam);
  const scenarios = SCENARIO_NAMES.map((name) => ({
    name,
    title: copy.scenarios[name].title,
    body: copy.scenarios[name].body,
  }));

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-8">
      <div>
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-ink md:text-3xl">
          {copy.title}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-slate">{copy.body}</p>
      </div>
      {loaded ? (
        <p role="status" className="text-sm text-ink">
          {copy.loaded(copy.scenarios[loaded].title)}
        </p>
      ) : null}
      <nav aria-label={copy.open} className="flex flex-wrap gap-x-4 gap-y-2">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-sm text-ink underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <ScenarioList scenarios={scenarios} />
    </div>
  );
}
