"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { openUpgradeModal } from "@/components/shell/upgrade-store";
import { strings } from "@/copy/strings";

import { rateTailoredResume, tailorResume } from "../actions";
import type { JobDocuments, ResumeVersion } from "../status";
import { resumeTemplateLabel } from "../template-label";
import { TailorDialog } from "./tailor-dialog";

const copy = strings.jobs.documents;

export function TailorPoll() {
  const router = useRouter();

  useEffect(() => {
    const id = window.setInterval(() => {
      router.refresh();
    }, 3000);
    return () => window.clearInterval(id);
  }, [router]);

  return null;
}

export function DocumentsTab({
  jobId,
  analysisReady,
  documents,
}: {
  jobId: string;
  analysisReady: boolean;
  documents: JobDocuments;
}) {
  const router = useRouter();
  const inflight = useRef(0);
  const [open, setOpen] = useState(false);
  const [tailoring, setTailoring] = useState(false);
  const [stage, setStage] = useState(0);
  const [ratingId, setRatingId] = useState<string | null>(null);
  const [ratings, setRatings] = useState<Record<string, 1 | -1 | null>>({});
  const showProgress = tailoring || documents.pending;

  useEffect(() => {
    if (!showProgress) return;
    const id = window.setInterval(() => {
      setStage((current) => (current + 1) % copy.stages.length);
    }, 8000);
    return () => window.clearInterval(id);
  }, [showProgress]);

  async function onConfirm(input: { length: 1 | 2; emphasis: string }) {
    if (documents.tailorsLeft <= 0 && inflight.current === 0) {
      setOpen(false);
      openUpgradeModal({ kind: "quota", meter: "TAILOR" });
      return;
    }
    inflight.current += 1;
    setOpen(false);
    setTailoring(true);
    setStage(0);
    try {
      const result = await tailorResume({
        jobId,
        length: input.length,
        emphasis: input.emphasis,
      });
      if (!result.ok) {
        if (result.error.code === "QUOTA_EXCEEDED") {
          openUpgradeModal({ kind: "quota", meter: "TAILOR" });
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
        setTailoring(false);
        router.refresh();
      }
    }
  }

  async function onRate(resumeId: string, rating: 1 | -1) {
    if (ratingId) return;
    setRatingId(resumeId);
    try {
      const result = await rateTailoredResume({ resumeId, rating });
      if (!result.ok) {
        toast.error(copy.ratingFailed);
        return;
      }
      setRatings((current) => ({ ...current, [resumeId]: result.data.rating }));
      router.refresh();
    } catch {
      toast.error(copy.ratingFailed);
    } finally {
      setRatingId(null);
    }
  }

  const reasons: string[] = [];
  if (!analysisReady) reasons.push(copy.disabledAnalysis);
  if (!documents.canTailor) reasons.push(copy.disabledLibrary);
  const cards = documents.versions.filter((version) => version.status !== "PENDING");

  return (
    <section aria-labelledby="job-documents" className="flex flex-col gap-4">
      <h2 id="job-documents" className="text-base font-medium text-ink">
        {copy.title}
      </h2>
      {showProgress ? (
        <div aria-live="polite" className="flex flex-col gap-2">
          <p className="text-sm font-medium text-ink">{copy.tailoring}</p>
          <p className="text-sm text-slate">{copy.tailoringHint}</p>
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
            {strings.actions.tailorResume}
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
              <VersionCard
                jobId={jobId}
                version={version}
                rating={
                  Object.prototype.hasOwnProperty.call(ratings, version.id)
                    ? (ratings[version.id] ?? null)
                    : version.rating
                }
                ratingPending={ratingId === version.id}
                onRate={onRate}
              />
            </li>
          ))}
        </ul>
      ) : null}
      <TailorDialog open={open} onOpenChange={setOpen} onConfirm={onConfirm} />
    </section>
  );
}

function validationMessage(
  fields: { job?: string[]; library?: string[]; emphasis?: string[] } | undefined,
): string {
  return (
    fields?.emphasis?.[0] ??
    fields?.library?.[0] ??
    fields?.job?.[0] ??
    copy.notReady
  );
}

function VersionCard({
  jobId,
  version,
  rating,
  ratingPending,
  onRate,
}: {
  jobId: string;
  version: ResumeVersion;
  rating: 1 | -1 | null;
  ratingPending: boolean;
  onRate: (resumeId: string, rating: 1 | -1) => void;
}) {
  const template = resumeTemplateLabel(version.templateId);

  return (
    <article
      className={
        version.status === "FAILED"
          ? "flex flex-col gap-3 rounded-lg border border-line p-4"
          : "relative flex flex-col gap-3 rounded-lg border border-line p-4 hover:border-pine"
      }
    >
      {version.status === "FAILED" ? null : (
        <Link
          href={`/jobs/${jobId}/resumes/${version.id}`}
          aria-label={copy.openVersion(version.title)}
          className="absolute inset-0 rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        />
      )}
      <div className="pointer-events-none relative flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-ink">{version.title}</h3>
        {version.submitted ? (
          <span className="rounded-full bg-pine-50 px-2 py-0.5 text-xs text-pine">
            {copy.submitted}
          </span>
        ) : null}
      </div>
      <p className="pointer-events-none text-sm text-slate">{version.createdLabel}</p>
      {version.status === "FAILED" ? (
        <p className="text-sm text-ink">{copy.failed}</p>
      ) : (
        <>
          <p className="pointer-events-none text-sm text-ink">
            {version.matchScore === null
              ? copy.matchScoreEmpty
              : copy.matchScore(version.matchScore)}
          </p>
          <p className="pointer-events-none text-sm text-slate">{template}</p>
          <div className="relative z-10 flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/jobs/${jobId}/resumes/${version.id}`}>{copy.open}</Link>
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
        </>
      )}
    </article>
  );
}
