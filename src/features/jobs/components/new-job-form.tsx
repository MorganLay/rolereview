"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { openUpgradeModal } from "@/components/shell/upgrade-store";
import { strings } from "@/copy/strings";
import type { FieldErrors } from "@/lib/result";
import { cn } from "@/lib/utils";

import { createJob } from "../actions";
import {
  noteSuccessfulAnalysis,
  pendingAnalysesFor,
  reconcileAnalysesAdjust,
  rememberAnalyses,
} from "../analyses-left";
import { subscribeNewJobVisit } from "./new-job-link";
import { JOB_LIMITS, JOB_SOURCES } from "../schemas";

const copy = strings.jobs;
const NONE = "NONE";

type NewJobFormProps = {
  analysesLeft: number;
};

export function NewJobForm({ analysesLeft: analysesLeftProp }: NewJobFormProps) {
  const router = useRouter();
  const formId = useId();
  const [posting, setPosting] = useState("");
  const [url, setUrl] = useState("");
  const [deadline, setDeadline] = useState("");
  const [source, setSource] = useState<string>(NONE);
  const [priority, setPriority] = useState<number | null>(null);
  const [fields, setFields] = useState<FieldErrors>({});
  const [reading, setReading] = useState(false);
  const [stage, setStage] = useState(0);
  const [analysesAdjust, setAnalysesAdjust] = useState(() =>
    pendingAnalysesFor(analysesLeftProp),
  );
  if (analysesAdjust.base !== analysesLeftProp) {
    setAnalysesAdjust(reconcileAnalysesAdjust(analysesLeftProp, analysesAdjust));
  }
  const analysesLeft = Math.max(0, analysesLeftProp - analysesAdjust.delta);
  const busy = useRef(false);
  const live = useRef(true);
  const postingRef = useRef<HTMLTextAreaElement>(null);
  const scrollPosting = useRef(false);
  const draftGeneration = useRef(0);
  const resetDraft = useCallback(() => {
    draftGeneration.current += 1;
    busy.current = false;
    scrollPosting.current = false;
    setPosting("");
    setUrl("");
    setDeadline("");
    setSource(NONE);
    setPriority(null);
    setFields({});
    setReading(false);
    setStage(0);
  }, []);

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  useLayoutEffect(() => {
    // Cache Components keeps this page mounted. Clear it when the page is
    // hidden so the next visit is a blank form, not "Analyzing the posting".
    return () => {
      resetDraft();
    };
  }, [resetDraft]);

  useEffect(() => {
    function onPageShow(event: PageTransitionEvent) {
      if (!event.persisted) return;
      resetDraft();
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [resetDraft]);

  useEffect(() => subscribeNewJobVisit(resetDraft), [resetDraft]);

  useLayoutEffect(() => {
    if (!scrollPosting.current) return;
    scrollPosting.current = false;
    const node = postingRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [posting]);

  useEffect(() => {
    if (!reading) return;
    const id = window.setInterval(() => {
      setStage((current) => (current + 1) % copy.stages.length);
    }, 2500);
    return () => window.clearInterval(id);
  }, [reading]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy.current) return;
    if (analysesLeft <= 0) {
      openUpgradeModal({ kind: "quota", meter: "ANALYZE" });
      return;
    }

    const parsedSource = JOB_SOURCES.find((value) => value === source) ?? null;
    const generation = draftGeneration.current;
    const baseAtSubmit = analysesAdjust.base;
    const visibleAtSubmit = analysesLeft;
    busy.current = true;
    setFields({});
    setStage(0);
    setReading(true);
    try {
      const result = await createJob({
        rawText: posting,
        url,
        deadline,
        source: parsedSource,
        priority,
      });
      if (!result.ok) {
        if (!live.current) return;
        const sameVisit = draftGeneration.current === generation;
        if (sameVisit) setReading(false);
        if (result.error.code === "QUOTA_EXCEEDED") {
          openUpgradeModal({ kind: "quota", meter: "ANALYZE" });
          const next = { base: analysesLeftProp, delta: analysesLeftProp };
          rememberAnalyses(next);
          setAnalysesAdjust(next);
          return;
        }
        if (!sameVisit) return;
        if (result.error.code === "VALIDATION") {
          setFields(result.error.fields ?? {});
          return;
        }
        toast.error(copy.saveFailed);
        return;
      }
      if (!live.current) return;
      if (result.data.analysisStatus === "READY") {
        const next = noteSuccessfulAnalysis({
          baseAtSubmit,
          visibleAtSubmit,
          baseNow: analysesAdjust.base,
        });
        rememberAnalyses(next);
        setAnalysesAdjust(next);
      } else if (draftGeneration.current === generation) {
        toast.error(copy.aiFailed);
      }
      if (draftGeneration.current !== generation) return;
      router.push(`/jobs/${result.data.jobId}`);
    } catch {
      if (!live.current || draftGeneration.current !== generation) return;
      setReading(false);
      toast.error(copy.saveFailed);
    } finally {
      if (draftGeneration.current === generation) busy.current = false;
    }
  }

  function onPostingChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const next = event.target.value;
    if (next.length > posting.length + 80) scrollPosting.current = true;
    setPosting(next);
  }

  if (reading) {
    return (
      <section
        aria-labelledby={`${formId}-reading`}
        aria-busy="true"
        className="rounded-card border border-line bg-surface p-4 sm:p-5"
      >
        <h2 id={`${formId}-reading`} className="text-base font-medium text-ink">
          {copy.reading}
        </h2>
        <p className="mt-1 text-sm text-slate">{copy.readingHint}</p>
        <ol aria-live="polite" className="mt-4 grid gap-1">
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

  const count = posting.trim().length;
  const postingError = fieldMessage(fields, "rawText");
  const urlError = fieldMessage(fields, "url");
  const deadlineError = fieldMessage(fields, "deadline");
  const sourceError = fieldMessage(fields, "source");
  const priorityError = fieldMessage(fields, "priority");
  const lengthMessage =
    count > JOB_LIMITS.postingMax
      ? copy.errors.postingLong
      : count > 0 && count < JOB_LIMITS.postingMin
        ? copy.errors.postingShort
        : null;
  const postingReady =
    count >= JOB_LIMITS.postingMin && count <= JOB_LIMITS.postingMax;
  const postingDescribedBy = [
    `${formId}-posting-hint`,
    `${formId}-posting-count`,
    lengthMessage ? `${formId}-posting-length` : null,
  ]
    .filter((id) => id !== null)
    .join(" ");

  return (
    <form
      onSubmit={onSubmit}
      className="overflow-hidden rounded-card border border-line bg-surface"
    >
      <div className="flex flex-col gap-2 p-4 sm:p-5">
        <div className="flex items-baseline justify-between gap-3">
          <Label htmlFor={`${formId}-posting`}>{copy.postingLabel}</Label>
          <p className="text-right text-xs text-slate">{copy.analysesLeft(analysesLeft)}</p>
        </div>
        <div className="relative">
          <Textarea
            ref={postingRef}
            id={`${formId}-posting`}
            value={posting}
            onChange={(event) => onPostingChange(event)}
            placeholder={copy.postingPlaceholder}
            rows={8}
            className="field-sizing-fixed max-h-56 min-h-44 resize-none overflow-y-auto pb-8 sm:max-h-72 sm:min-h-52 lg:max-h-80 lg:min-h-64"
            required
            aria-invalid={Boolean(postingError) || count > JOB_LIMITS.postingMax}
            aria-describedby={postingDescribedBy}
          />
          <p
            id={`${formId}-posting-count`}
            className={cn(
              "pointer-events-none absolute right-2.5 bottom-2 bg-surface px-1 text-xs tabular-nums",
              count > JOB_LIMITS.postingMax ? "text-destructive" : "text-slate",
            )}
          >
            {copy.postingCount(count)}
          </p>
        </div>
        <p id={`${formId}-posting-hint`} className="text-xs text-slate">
          {copy.postingHint}
        </p>
        {lengthMessage ? (
          <p
            id={`${formId}-posting-length`}
            className={
              count > JOB_LIMITS.postingMax
                ? "text-sm text-destructive"
                : "text-sm text-slate"
            }
          >
            {lengthMessage}
          </p>
        ) : null}
        {postingError && postingError !== lengthMessage ? (
          <FieldAlert message={postingError} />
        ) : null}
      </div>

      <div className="flex flex-col gap-5 border-t border-line p-4 sm:p-5">
        <div>
          <h2 className="text-base font-medium text-ink">{copy.detailsHeading}</h2>
          <p className="mt-1 text-sm text-slate">{copy.detailsBody}</p>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={`${formId}-url`}>{copy.urlLabel}</Label>
          <Input
            id={`${formId}-url`}
            type="text"
            inputMode="url"
            autoComplete="off"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            className="h-11 min-h-11"
            aria-invalid={Boolean(urlError)}
            aria-describedby={`${formId}-url-hint`}
          />
          <p id={`${formId}-url-hint`} className="text-xs text-slate">
            {copy.urlSaved}
          </p>
          {urlError ? <FieldAlert message={urlError} /> : null}
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor={`${formId}-deadline`}>{copy.deadlineLabel}</Label>
            <Input
              id={`${formId}-deadline`}
              type="date"
              value={deadline}
              onChange={(event) => setDeadline(event.target.value)}
              className="h-11 min-h-11"
              aria-invalid={Boolean(deadlineError)}
              aria-describedby={`${formId}-deadline-hint`}
            />
            <p id={`${formId}-deadline-hint`} className="text-xs text-slate">
              {copy.deadlineHint}
            </p>
            {deadlineError ? <FieldAlert message={deadlineError} /> : null}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={`${formId}-source`}>{copy.sourceLabel}</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger
                id={`${formId}-source`}
                className="h-11 min-h-11 w-full"
                aria-invalid={Boolean(sourceError)}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{copy.sourceNone}</SelectItem>
                {JOB_SOURCES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {copy.sources[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {sourceError ? <FieldAlert message={sourceError} /> : null}
          </div>
        </div>

        <PriorityField
          formId={formId}
          priority={priority}
          error={priorityError}
          onChange={setPriority}
        />
      </div>

      <div className="border-t border-line px-4 py-4 sm:px-5">
        <Button
          type="submit"
          className="min-h-11 w-full px-5 sm:w-auto"
          disabled={!postingReady}
        >
          {strings.actions.addJob}
        </Button>
      </div>
    </form>
  );
}

function PriorityField({
  formId,
  priority,
  error,
  onChange,
}: {
  formId: string;
  priority: number | null;
  error?: string;
  onChange: (next: number | null) => void;
}) {
  const [preview, setPreview] = useState<number | null>(null);
  const shown = preview ?? priority;

  return (
    <fieldset className="grid min-w-0 gap-1.5 border-0 p-0">
      <legend className="text-sm font-medium text-ink">{copy.priorityLabel}</legend>
      <p id={`${formId}-priority-hint`} className="text-xs text-slate">
        {copy.priorityHint}
      </p>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
        <div
          className="flex"
          onPointerLeave={(event) => {
            if (event.pointerType !== "mouse") return;
            setPreview(null);
          }}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-ink outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              aria-pressed={priority === n}
              aria-describedby={`${formId}-priority-hint`}
              aria-label={priority === n ? copy.priorityClear : copy.prioritySet(n)}
              onClick={() => {
                setPreview(null);
                onChange(priority === n ? null : n);
              }}
              onPointerEnter={(event) => {
                if (event.pointerType !== "mouse") return;
                setPreview(n);
              }}
            >
              <Star aria-hidden className={cn("size-5", starClass(n, shown, priority))} />
            </button>
          ))}
        </div>
        <p className="text-sm text-slate">
          {priority === null ? copy.priorityNone : copy.priorityValue(priority)}
        </p>
      </div>
      {error ? <FieldAlert message={error} /> : null}
    </fieldset>
  );
}

/** Saved stars stay filled. A mouse hover previews a different value without changing it. */
function starClass(n: number, shown: number | null, priority: number | null): string {
  const inShown = shown !== null && n <= shown;
  const inSaved = priority !== null && n <= priority;
  if (inShown && inSaved) return "fill-marigold text-ink";
  if (inShown) return "fill-marigold/40 text-ink";
  if (inSaved) return "text-marigold-700";
  return "text-slate";
}

function fieldMessage(fields: FieldErrors, key: string): string | undefined {
  return fields[key]?.[0];
}

function FieldAlert({ message }: { message: string }) {
  return (
    <p className="text-sm text-destructive" role="alert">
      {message}
    </p>
  );
}
