"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { openUpgradeModal } from "@/components/shell/upgrade-store";
import { strings } from "@/copy/strings";
import { resumeTemplateLabel } from "@/features/tailor/template-label";
import type { FieldErrors } from "@/lib/result";

import { rateCoverLetter, writeCoverLetter } from "../actions";
import type { JobLetters, LetterVersion } from "../status";
import { LetterDialog, type LetterDraft } from "./letter-dialog";

const copy = strings.jobs.letters;

export function LettersSection({
  jobId,
  analysisReady,
  libraryReady,
  letters,
}: {
  jobId: string;
  analysisReady: boolean;
  libraryReady: boolean;
  letters: JobLetters;
}) {
  const router = useRouter();
  const inflight = useRef(0);
  const [open, setOpen] = useState(false);
  const [writing, setWriting] = useState(false);
  const [stage, setStage] = useState(0);
  const [ratingId, setRatingId] = useState<string | null>(null);
  const [ratings, setRatings] = useState<Record<string, 1 | -1 | null>>({});
  const showProgress = writing || letters.pending;

  useEffect(() => {
    if (!showProgress) return;
    const id = window.setInterval(() => {
      setStage((current) => (current + 1) % copy.stages.length);
    }, 8000);
    return () => window.clearInterval(id);
  }, [showProgress]);

  async function onConfirm(input: LetterDraft) {
    if (letters.lettersLeft <= 0 && inflight.current === 0) {
      setOpen(false);
      openUpgradeModal({ kind: "quota", meter: "COVER_LETTER" });
      return;
    }
    inflight.current += 1;
    setOpen(false);
    setWriting(true);
    setStage(0);
    try {
      const result = await writeCoverLetter({
        jobId,
        tone: input.tone,
        length: input.length,
        recipientName: input.recipientName,
        whyCompany: input.whyCompany,
        ...(input.resumeId ? { resumeId: input.resumeId } : {}),
      });
      if (!result.ok) {
        if (result.error.code === "QUOTA_EXCEEDED") {
          openUpgradeModal({ kind: "quota", meter: "COVER_LETTER" });
          return;
        }
        if (result.error.code === "CONFLICT") {
          toast.error(copy.conflict);
          return;
        }
        if (result.error.code === "AI_FAILED") {
          toast.error(copy.aiFailed);
          return;
        }
        if (result.error.code === "VALIDATION") {
          toast.error(validationMessage(result.error.fields));
          return;
        }
        toast.error(copy.saveFailed);
      }
    } catch {
      toast.error(copy.saveFailed);
    } finally {
      inflight.current -= 1;
      if (inflight.current === 0) {
        setWriting(false);
        router.refresh();
      }
    }
  }

  async function onRate(letterId: string, rating: 1 | -1) {
    if (ratingId) return;
    setRatingId(letterId);
    try {
      const result = await rateCoverLetter({ letterId, rating });
      if (!result.ok) {
        toast.error(copy.ratingFailed);
        return;
      }
      setRatings((current) => ({ ...current, [letterId]: result.data.rating }));
      router.refresh();
    } catch {
      toast.error(copy.ratingFailed);
    } finally {
      setRatingId(null);
    }
  }

  const reasons: string[] = [];
  if (!analysisReady) reasons.push(copy.disabledAnalysis);
  if (!libraryReady) reasons.push(copy.disabledLibrary);
  const cards = letters.versions.filter((version) => version.status !== "PENDING");

  return (
    <section aria-labelledby="job-letters" className="flex flex-col gap-4">
      <h2 id="job-letters" className="text-base font-medium text-ink">
        {copy.title}
      </h2>
      {showProgress ? (
        <div aria-live="polite" aria-busy="true" role="status" className="flex flex-col gap-2">
          <p className="text-sm font-medium text-ink">{copy.writing}</p>
          <p className="text-sm text-slate">{copy.writingHint}</p>
          <ol className="grid gap-1">
            {copy.stages.map((line, index) => (
              <li
                key={line}
                className={index === stage ? "text-sm text-ink" : "text-sm text-slate"}
                aria-current={index === stage ? "step" : undefined}
              >
                {line}
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-2">
          {reasons.map((reason) => (
            <p key={reason} className="text-sm text-slate">
              {reason}
            </p>
          ))}
          <Button
            type="button"
            disabled={reasons.length > 0}
            onClick={() => setOpen(true)}
          >
            {strings.actions.writeCoverLetter}
          </Button>
        </div>
      )}
      {cards.length === 0 && !showProgress ? (
        <p className="text-sm text-slate">{copy.empty}</p>
      ) : null}
      {cards.length > 0 ? (
        <ul className="grid gap-3">
          {cards.map((version) => (
            <li key={version.id}>
              <LetterCard
                jobId={jobId}
                version={version}
                rating={
                  Object.prototype.hasOwnProperty.call(ratings, version.id)
                    ? (ratings[version.id] ?? null)
                    : version.rating
                }
                ratingPending={ratingId === version.id}
                retryDisabled={showProgress}
                onRate={onRate}
                onRetry={() =>
                  void onConfirm({
                    tone: version.tone,
                    length: version.length,
                    recipientName: version.recipientName,
                    whyCompany: version.whyCompany,
                    resumeId: version.resumeId ?? "",
                  })
                }
              />
            </li>
          ))}
        </ul>
      ) : null}
      <LetterDialog
        jobId={jobId}
        open={open}
        resumes={letters.resumes}
        onOpenChange={setOpen}
        onConfirm={onConfirm}
      />
    </section>
  );
}

function validationMessage(fields: FieldErrors | undefined): string {
  return (
    fields?.resumeId?.[0] ??
    fields?.whyCompany?.[0] ??
    fields?.recipientName?.[0] ??
    fields?.library?.[0] ??
    fields?.job?.[0] ??
    copy.notReady
  );
}

function LetterCard({
  jobId,
  version,
  rating,
  ratingPending,
  retryDisabled,
  onRate,
  onRetry,
}: {
  jobId: string;
  version: LetterVersion;
  rating: 1 | -1 | null;
  ratingPending: boolean;
  retryDisabled: boolean;
  onRate: (letterId: string, rating: 1 | -1) => void;
  onRetry: () => void;
}) {
  if (version.status === "PENDING") {
    return (
      <p className="text-sm font-medium text-ink" role="status" aria-busy="true">
        {copy.writing}
      </p>
    );
  }

  if (version.status === "FAILED") {
    return (
      <article
        className="flex flex-col items-start gap-3 rounded-lg border border-line p-4"
        role="status"
      >
        <h3 className="text-sm font-medium text-ink">{copy.failed}</h3>
        <p className="text-sm text-slate">{version.title}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={retryDisabled}
          onClick={onRetry}
        >
          {copy.retry}
        </Button>
      </article>
    );
  }

  const template = resumeTemplateLabel(version.templateId);
  const href = `/jobs/${jobId}/letters/${version.id}`;

  return (
    <article className="relative flex flex-col gap-3 rounded-lg border border-line p-4 hover:border-pine">
      <Link
        href={href}
        aria-label={copy.openVersion(version.title)}
        className="absolute inset-0 rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      />
      <div className="pointer-events-none relative flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-ink">{version.title}</h3>
        {version.submitted ? (
          <span className="rounded-full bg-pine-50 px-2 py-0.5 text-xs text-pine">
            {copy.submitted}
          </span>
        ) : null}
      </div>
      <p className="pointer-events-none text-sm text-slate">{version.createdLabel}</p>
      <p className="pointer-events-none text-sm text-ink">
            {copy.toneLength(copy.tones[version.tone], copy.lengthShort[version.length])}
          </p>
          <p className="pointer-events-none text-sm text-slate">{template}</p>
          <div className="relative z-10 flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={href}>{copy.open}</Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-pressed={rating === 1}
              aria-label={copy.helpful}
              disabled={ratingPending}
              className={rating === 1 ? "border-pine bg-pine-50 text-pine" : undefined}
              onClick={() => onRate(version.id, 1)}
            >
              <ThumbsUp aria-hidden />
              {copy.helpful}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-pressed={rating === -1}
              aria-label={copy.notHelpful}
              disabled={ratingPending}
              className={rating === -1 ? "border-pine bg-pine-50 text-pine" : undefined}
              onClick={() => onRate(version.id, -1)}
            >
              <ThumbsDown aria-hidden />
              {copy.notHelpful}
            </Button>
          </div>
    </article>
  );
}
