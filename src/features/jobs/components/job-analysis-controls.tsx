"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { openUpgradeModal } from "@/components/shell/upgrade-store";
import { strings } from "@/copy/strings";

import { retryAnalysis } from "../actions";

const copy = strings.jobs;

type JobAnalysisControlsProps = {
  jobId: string;
  analysesLeft: number;
  mode: "pending" | "failed";
};

export function JobAnalysisControls({
  jobId,
  analysesLeft,
  mode,
}: JobAnalysisControlsProps) {
  if (mode === "pending") return <PendingNotice />;
  return <RetryControl jobId={jobId} analysesLeft={analysesLeft} />;
}

function PendingNotice() {
  const router = useRouter();

  useEffect(() => {
    const id = window.setInterval(() => {
      router.refresh();
    }, 3000);
    return () => window.clearInterval(id);
  }, [router]);

  return (
    <section aria-live="polite" className="flex flex-col gap-1">
      <p className="text-sm font-medium text-ink">{copy.result.pending}</p>
      <p className="text-sm text-slate">{copy.result.pendingHint}</p>
    </section>
  );
}

function RetryControl({
  jobId,
  analysesLeft,
}: {
  jobId: string;
  analysesLeft: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (!pending) return;
    const id = window.setInterval(() => {
      setStage((current) => (current + 1) % copy.stages.length);
    }, 2500);
    return () => window.clearInterval(id);
  }, [pending]);

  async function onRetry() {
    if (pending) return;
    if (analysesLeft <= 0) {
      openUpgradeModal({ kind: "quota", meter: "ANALYZE" });
      return;
    }
    setPending(true);
    setStage(0);
    try {
      const result = await retryAnalysis({ jobId });
      if (!result.ok) {
        setPending(false);
        if (result.error.code === "QUOTA_EXCEEDED") {
          openUpgradeModal({ kind: "quota", meter: "ANALYZE" });
          return;
        }
        if (result.error.code === "CONFLICT") {
          toast.error(copy.conflict);
          router.refresh();
          return;
        }
        toast.error(copy.saveFailed);
        return;
      }
      if (result.data.analysisStatus === "FAILED") {
        toast.error(copy.aiFailed);
        setPending(false);
      }
      router.refresh();
    } catch {
      setPending(false);
      toast.error(copy.saveFailed);
    }
  }

  if (pending) {
    return (
      <section aria-live="polite" className="flex flex-col gap-2">
        <p className="text-sm font-medium text-ink">{copy.reading}</p>
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
      </section>
    );
  }

  return (
    <section role="alert" className="flex flex-col items-start gap-3">
      <p className="text-sm text-ink">{copy.result.failed}</p>
      <Button type="button" onClick={() => void onRetry()}>
        {copy.result.retry}
      </Button>
    </section>
  );
}
