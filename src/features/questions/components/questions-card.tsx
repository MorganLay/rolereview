"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { WorkProgress } from "@/components/shell/work-progress";
import { Button } from "@/components/ui/button";
import { strings } from "@/copy/strings";

import { prepareJobQuestions, refreshJobQuestions, retryJobQuestions } from "../actions";
import type { QuestionCardPhase } from "../view";

const copy = strings.jobs.questions;

export function QuestionsCard({
  jobId,
  phase,
}: {
  jobId: string;
  phase: QuestionCardPhase | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (phase?.phase !== "prepare") return;
    let cancelled = false;
    void prepareJobQuestions({ jobId }).then((result) => {
      if (cancelled) return;
      setPending(false);
      if (!result.ok) {
        setError(true);
        router.refresh();
        return;
      }
      if (result.data.status === "generating") {
        window.setTimeout(() => {
          if (!cancelled) router.refresh();
        }, 2000);
        return;
      }
      router.refresh();
    });
    return () => {
      cancelled = true;
    };
  }, [jobId, phase, router]);

  if (!phase && !error) return null;
  if (phase?.phase === "prepare" || pending) {
    return (
      <WorkProgress title={copy.preparing} hint={copy.preparingHint} stages={copy.stages} />
    );
  }
  if (error || phase?.phase === "failed") {
    return (
      <div className="rounded-lg border border-line bg-surface p-4">
        <p className="text-sm text-ink">{copy.failed}</p>
        <Button
          type="button"
          variant="link"
          className="mt-1 h-auto px-0 text-pine"
          onClick={() => {
            setError(false);
            setPending(true);
            void retryJobQuestions({ jobId }).then(() => {
              setPending(false);
              router.refresh();
            });
          }}
        >
          {copy.retry}
        </Button>
      </div>
    );
  }
  if (!phase) return null;
  if (phase.phase === "refresh") {
    return (
      <div className="rounded-lg border border-line bg-surface px-4 py-3">
        <Button type="button" variant="link" className="h-auto px-0 text-pine" onClick={() => runRefresh(jobId, router, setPending)}>
          {copy.refresh}
        </Button>
      </div>
    );
  }
  if (phase.phase === "saved") {
    return (
      <p className="text-sm text-ink">
        {copy.added(phase.count)}{" "}
        <Link href={`/jobs/${jobId}/questions?view=review`} className="text-pine underline-offset-4 hover:underline">
          {copy.review}
        </Link>
      </p>
    );
  }
  if (phase.phase === "review") {
    return (
      <p className="text-sm text-ink">
        <Link href={`/jobs/${jobId}/questions?view=review`} className="text-pine underline-offset-4 hover:underline">
          {copy.reviewReady(phase.count)}
        </Link>
      </p>
    );
  }

  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <h2 className="text-base font-medium text-ink">{copy.title(phase.count)}</h2>
      <p className="mt-1 text-sm text-slate">{copy.body}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button type="button" asChild>
          <Link href={`/jobs/${jobId}/questions`}>{copy.start}</Link>
        </Button>
        <a href="#tailor-resume" className="text-sm text-pine underline-offset-4 hover:underline">
          {copy.skip}
        </a>
        {phase.refresh ? (
          <Button type="button" variant="link" className="h-auto px-0 text-slate" onClick={() => runRefresh(jobId, router, setPending)}>
            {copy.refresh}
          </Button>
        ) : null}
      </div>
    </section>
  );
}

function runRefresh(
  jobId: string,
  router: ReturnType<typeof useRouter>,
  setPending: (value: boolean) => void,
) {
  setPending(true);
  void refreshJobQuestions({ jobId }).then(() => {
    setPending(false);
    router.refresh();
  });
}
