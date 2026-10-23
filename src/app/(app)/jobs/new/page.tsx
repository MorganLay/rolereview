import type { Metadata } from "next";

import { strings } from "@/copy/strings";
import { NewJobForm } from "@/features/jobs/components/new-job-form";
import { analysesRemaining } from "@/features/jobs/queries";
import { requireUser } from "@/lib/auth";

/** Analysis calls the model and can take several seconds. */
export const maxDuration = 120;

export const metadata: Metadata = {
  title: strings.pages.jobsNew.title,
  description: strings.pages.jobsNew.body,
};

/** The analyses-left count comes from the signed-in user. */
export const instant = false;

export default async function NewJobPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string | string[] }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const fresh = Array.isArray(params.new) ? params.new[0] : params.new;
  const analysesLeft = await analysesRemaining(user.id, user.plan);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-ink md:text-3xl">
          {strings.pages.jobsNew.title}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-slate">
          {strings.pages.jobsNew.body}
        </p>
      </div>
      <NewJobForm key={fresh ?? "new"} analysesLeft={analysesLeft} />
    </div>
  );
}
