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
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, Star } from "lucide-react";
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
import { postingStatus } from "../posting-status";
import { JOB_LIMITS, JOB_SOURCES } from "../schemas";
import { sourceFromPostingUrl } from "../source-from-url";

const copy = strings.jobs;
const NONE = "NONE";

type NewJobFormProps = {
  analysesLeft: number;
};

export function NewJobForm({ analysesLeft: analysesLeftProp }: NewJobFormProps) {
  const router = useRouter();
  const formId = useId();
  const [posting, setPosting] = useState("");
  const [postingTouched, setPostingTouched] = useState(false);
  const [url, setUrl] = useState("");
  const [deadline, setDeadline] = useState("");
  const [source, setSource] = useState<string>(NONE);
  const [priority, setPriority] = useState<number | null>(null);
  const [fields, setFields] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
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
  const readingTitleRef = useRef<HTMLHeadingElement>(null);
  const scrollPosting = useRef(false);
  const draftGeneration = useRef(0);
  const resetDraft = useCallback(() => {
    draftGeneration.current += 1;
    busy.current = false;
    scrollPosting.current = false;
    setPosting("");
    setPostingTouched(false);
    setUrl("");
    setDeadline("");
    setSource(NONE);
    setPriority(null);
    setFields({});
    setSubmitError(null);
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
      setStage((current) => Math.min(current + 1, copy.stages.length - 1));
    }, 2500);
    return () => window.clearInterval(id);
  }, [reading]);

  useEffect(() => {
    if (!reading) return;
    readingTitleRef.current?.focus();
  }, [reading]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy.current) return;
    const count = posting.trim().length;
    const ready = count >= JOB_LIMITS.postingMin && count <= JOB_LIMITS.postingMax;
    if (!ready) {
      setPostingTouched(true);
      return;
    }
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
    setSubmitError(null);
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
        setSubmitError(copy.saveFailed);
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
      setSubmitError(copy.saveFailed);
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
        <div className="flex items-start gap-3">
          <span
            className="relative mt-0.5 flex size-9 shrink-0 items-center justify-center"
            aria-hidden
          >
            <span className="absolute inset-0 rounded-full border-2 border-pine-50 dark:border-pine/30" />
            <span className="import-read-arc absolute inset-0 rounded-full border-2 border-transparent border-t-pine dark:border-t-pine-300" />
          </span>
          <div className="min-w-0">
            <h2
              ref={readingTitleRef}
              id={`${formId}-reading`}
              tabIndex={-1}
              className="text-base font-medium text-ink outline-none"
            >
              {copy.reading}
            </h2>
            <p className="mt-1 text-sm text-slate">{copy.readingHint}</p>
          </div>
        </div>
        <div
          className="mt-4 h-1 overflow-hidden rounded-full bg-pine-50 dark:bg-pine/25"
          role="progressbar"
          aria-label={copy.reading}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext={copy.stages[stage] ?? copy.reading}
        >
          <div className="import-read-bar h-full w-1/3 rounded-full bg-pine dark:bg-pine-300" />
        </div>
        <ol className="mt-4 grid gap-1.5">
          {copy.stages.map((line, index) => {
            const state = index < stage ? "done" : index === stage ? "current" : "upcoming";
            return (
              <li
                key={line}
                aria-current={state === "current" ? "step" : undefined}
                aria-live={state === "current" ? "polite" : undefined}
                className="flex min-h-8 items-center gap-2.5"
              >
                <ReadingMark state={state} />
                <span
                  className={cn(
                    "text-sm",
                    state === "current" ? "font-medium text-ink" : "text-slate",
                  )}
                >
                  {line}
                </span>
              </li>
            );
          })}
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
  const status = postingStatus(
    count,
    postingTouched || Boolean(postingError),
  );
  const postingReady =
    count >= JOB_LIMITS.postingMin && count <= JOB_LIMITS.postingMax;
  const postingAlert =
    postingError && !status.text.includes(postingError) ? postingError : null;
  const postingDescribedBy = [
    `${formId}-posting-status`,
    postingAlert ? `${formId}-posting-error` : null,
  ]
    .filter((id) => id !== null)
    .join(" ");
  const buttonDescribedBy = [
    postingReady ? null : `${formId}-posting-status`,
    submitError ? `${formId}-submit-error` : null,
  ]
    .filter((id) => id !== null)
    .join(" ");

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="rounded-card border border-line bg-surface"
    >
      <div className="flex flex-col gap-2 p-4 sm:p-5">
        <div className="flex items-baseline justify-between gap-3">
          <Label htmlFor={`${formId}-posting`} className="text-base">
            {copy.postingLabel}
          </Label>
          <p className="text-right text-xs text-slate">{copy.analysesLeft(analysesLeft)}</p>
        </div>
        <Textarea
          ref={postingRef}
          id={`${formId}-posting`}
          value={posting}
          onChange={onPostingChange}
          onBlur={() => setPostingTouched(true)}
          placeholder={copy.postingPlaceholder}
          rows={8}
          className="field-sizing-fixed max-h-[min(32rem,70dvh)] min-h-[200px] resize-y overflow-y-auto px-3 py-3 leading-6 md:min-h-[260px]"
          required
          aria-invalid={status.invalid || Boolean(postingAlert)}
          aria-describedby={postingDescribedBy}
        />
        <p
          id={`${formId}-posting-status`}
          className={cn(
            "min-h-5 text-xs leading-5",
            status.invalid ? "text-destructive" : "text-slate",
          )}
        >
          {status.text}
        </p>
        <p className="sr-only" aria-live="polite">
          {status.live}
        </p>
        {postingAlert ? (
          <FieldAlert id={`${formId}-posting-error`} message={postingAlert} />
        ) : null}
      </div>

      <div className="flex flex-col gap-5 border-t border-line p-4 sm:p-5">
        <div>
          <h2 className="text-base font-medium text-ink">{copy.detailsHeading}</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate">{copy.detailsBody}</p>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={`${formId}-url`}>{copy.urlLabel}</Label>
          <Input
            id={`${formId}-url`}
            type="text"
            inputMode="url"
            autoComplete="off"
            value={url}
            onChange={(event) => {
              const next = event.target.value;
              setUrl(next);
              const detected = sourceFromPostingUrl(next);
              if (!detected) return;
              setSource((current) =>
                current === NONE || current === "LINKEDIN" || current === "INDEED"
                  ? detected
                  : current,
              );
            }}
            className="h-11 min-h-11"
            aria-invalid={Boolean(urlError)}
            aria-describedby={
              urlError ? `${formId}-url-hint ${formId}-url-error` : `${formId}-url-hint`
            }
          />
          <p id={`${formId}-url-hint`} className="text-xs leading-5 text-slate">
            {copy.urlSaved}
          </p>
          {urlError ? <FieldAlert id={`${formId}-url-error`} message={urlError} /> : null}
        </div>

        <div className="grid items-start gap-5 md:grid-cols-2">
          <div className="grid min-w-0 gap-1.5">
            <Label htmlFor={`${formId}-deadline`}>{copy.deadlineLabel}</Label>
            <Input
              id={`${formId}-deadline`}
              type="date"
              value={deadline}
              onChange={(event) => setDeadline(event.target.value)}
              className="h-11 min-h-11 w-full min-w-0 max-w-full"
              aria-invalid={Boolean(deadlineError)}
              aria-describedby={
                deadlineError
                  ? `${formId}-deadline-hint ${formId}-deadline-error`
                  : `${formId}-deadline-hint`
              }
            />
            <p id={`${formId}-deadline-hint`} className="text-xs leading-5 text-slate">
              {copy.deadlineHint}
            </p>
            {deadlineError ? (
              <FieldAlert id={`${formId}-deadline-error`} message={deadlineError} />
            ) : null}
          </div>

          <div className="grid min-w-0 gap-1.5">
            <Label htmlFor={`${formId}-source`}>{copy.sourceLabel}</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger
                id={`${formId}-source`}
                className="h-11 min-h-11 w-full text-base md:text-sm"
                aria-invalid={Boolean(sourceError)}
                aria-describedby={sourceError ? `${formId}-source-error` : undefined}
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
            {sourceError ? (
              <FieldAlert id={`${formId}-source-error`} message={sourceError} />
            ) : null}
          </div>
        </div>

        <PriorityField
          formId={formId}
          priority={priority}
          error={priorityError}
          onChange={setPriority}
        />

        <div className="flex flex-col items-stretch gap-3 border-t border-line pt-4 sm:items-start">
          {submitError ? (
            <p id={`${formId}-submit-error`} role="alert" className="text-sm text-destructive">
              {submitError}
            </p>
          ) : null}
          <Button
            type="submit"
            className="h-11 min-h-11 w-full px-6 sm:w-auto disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
            disabled={!postingReady}
            aria-describedby={buttonDescribedBy || undefined}
          >
            {copy.submit}
          </Button>
        </div>
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
  const [tabStop, setTabStop] = useState(1);
  const stars = useRef<Array<HTMLButtonElement | null>>([]);
  const shown = preview ?? priority;
  const tabbable = priority ?? tabStop;
  const describedBy = error
    ? `${formId}-priority-hint ${formId}-priority-error`
    : `${formId}-priority-hint`;

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, n: number) {
    const next = nextStar(n, event.key);
    if (next === null) return;
    event.preventDefault();
    setPreview(null);
    setTabStop(next);
    onChange(next);
    stars.current[next - 1]?.focus();
  }

  return (
    <div className="grid min-w-0 gap-1.5">
      <div id={`${formId}-priority-label`} className="text-sm font-medium text-ink">
        {copy.priorityLabel}
      </div>
      <p id={`${formId}-priority-hint`} className="text-xs leading-5 text-slate">
        {copy.priorityHint}
      </p>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
        <div
          role="radiogroup"
          aria-labelledby={`${formId}-priority-label`}
          aria-describedby={describedBy}
          aria-invalid={Boolean(error) || undefined}
          className="flex gap-1"
          onPointerLeave={(event) => {
            if (event.pointerType !== "mouse") return;
            setPreview(null);
          }}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              ref={(node) => {
                stars.current[n - 1] = node;
              }}
              type="button"
              role="radio"
              aria-checked={priority === n}
              tabIndex={n === tabbable ? 0 : -1}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-ink outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              aria-label={copy.priorityValue(n)}
              onClick={() => {
                setPreview(null);
                setTabStop(n);
                onChange(priority === n ? null : n);
              }}
              onKeyDown={(event) => onKeyDown(event, n)}
              onPointerEnter={(event) => {
                if (event.pointerType !== "mouse") return;
                setPreview(n);
              }}
            >
              <Star aria-hidden className={cn("size-5", starClass(n, shown, priority))} />
            </button>
          ))}
        </div>
        <p
          className={cn(
            "text-sm",
            priority === null ? "text-slate" : "font-medium text-ink",
          )}
          aria-live="polite"
          aria-atomic="true"
        >
          {priority === null ? copy.priorityNone : copy.priorityValue(priority)}
        </p>
      </div>
      {error ? <FieldAlert id={`${formId}-priority-error`} message={error} /> : null}
    </div>
  );
}

function nextStar(n: number, key: string): number | null {
  if (key === "ArrowRight" || key === "ArrowDown") return n === 5 ? 1 : n + 1;
  if (key === "ArrowLeft" || key === "ArrowUp") return n === 1 ? 5 : n - 1;
  if (key === "Home") return 1;
  if (key === "End") return 5;
  return null;
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

function ReadingMark({ state }: { state: "done" | "current" | "upcoming" }) {
  return (
    <span className="inline-flex size-5 shrink-0 items-center justify-center" aria-hidden>
      {state === "done" ? (
        <span className="inline-flex size-5 items-center justify-center rounded-full bg-pine-50 text-pine dark:bg-pine/20 dark:text-pine-300">
          <CheckIcon className="size-3" />
        </span>
      ) : (
        <span
          className={cn(
            "size-2.5 rounded-full",
            state === "current" ? "bg-pine" : "border border-line bg-surface",
          )}
        />
      )}
    </span>
  );
}

function FieldAlert({ id, message }: { id?: string; message: string }) {
  return (
    <p id={id} className="text-sm text-destructive" role="alert">
      {message}
    </p>
  );
}
