"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from "react";
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
  const [analysesAdjust, setAnalysesAdjust] = useState({
    base: analysesLeftProp,
    delta: 0,
  });
  if (analysesAdjust.base !== analysesLeftProp) {
    setAnalysesAdjust({ base: analysesLeftProp, delta: 0 });
  }
  const analysesLeft = Math.max(0, analysesLeftProp - analysesAdjust.delta);
  const busy = useRef(false);
  const live = useRef(true);
  const postingRef = useRef<HTMLTextAreaElement>(null);
  const scrollPosting = useRef(false);

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  useEffect(() => {
    function onPageShow(event: PageTransitionEvent) {
      if (!event.persisted) return;
      busy.current = false;
      setReading(false);
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  useEffect(() => {
    if (!scrollPosting.current) return;
    scrollPosting.current = false;
    const node = postingRef.current;
    if (!node) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({ block: "end", behavior: reduce ? "auto" : "smooth" });
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
        setReading(false);
        if (result.error.code === "QUOTA_EXCEEDED") {
          openUpgradeModal({ kind: "quota", meter: "ANALYZE" });
          setAnalysesAdjust({ base: analysesLeftProp, delta: analysesLeftProp });
          return;
        }
        if (result.error.code === "VALIDATION") {
          setFields(result.error.fields ?? {});
          return;
        }
        toast.error(copy.saveFailed);
        return;
      }
      if (!live.current) return;
      if (result.data.analysisStatus === "READY") {
        setAnalysesAdjust((current) => ({ ...current, delta: current.delta + 1 }));
      } else {
        toast.error(copy.aiFailed);
      }
      router.push(`/jobs/${result.data.jobId}`);
    } catch {
      if (!live.current) return;
      setReading(false);
      toast.error(copy.saveFailed);
    } finally {
      busy.current = false;
    }
  }

  function onPostingChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const next = event.target.value;
    if (next.length > posting.length + 80) scrollPosting.current = true;
    setPosting(next);
  }

  if (reading) {
    return (
      <section aria-labelledby={`${formId}-reading`} className="flex flex-col gap-3">
        <h2 id={`${formId}-reading`} className="text-base font-medium text-ink">
          {copy.reading}
        </h2>
        <p className="text-sm text-slate">{copy.readingHint}</p>
        <ol aria-live="polite" className="grid gap-1">
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

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <p className="text-sm text-slate">{copy.analysesLeft(analysesLeft)}</p>

      <div className="grid gap-2">
        <Label htmlFor={`${formId}-posting`}>{copy.postingLabel}</Label>
        <Textarea
          ref={postingRef}
          id={`${formId}-posting`}
          value={posting}
          onChange={(event) => onPostingChange(event)}
          placeholder={copy.postingPlaceholder}
          rows={12}
          required
          aria-invalid={Boolean(postingError)}
          aria-describedby={`${formId}-posting-hint`}
        />
        <p
          id={`${formId}-posting-hint`}
          className={
            count > JOB_LIMITS.postingMax
              ? "text-xs text-destructive"
              : "text-xs text-slate"
          }
        >
          {copy.postingHint} {copy.postingCount(count)}
        </p>
        {postingError ? <FieldAlert message={postingError} /> : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${formId}-url`}>{copy.urlLabel}</Label>
        <Input
          id={`${formId}-url`}
          type="text"
          inputMode="url"
          autoComplete="off"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          aria-invalid={Boolean(urlError)}
          aria-describedby={`${formId}-url-hint`}
        />
        <p id={`${formId}-url-hint`} className="text-xs text-slate">
          {copy.urlHint}
        </p>
        {urlError ? <FieldAlert message={urlError} /> : null}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={`${formId}-deadline`}>{copy.deadlineLabel}</Label>
          <Input
            id={`${formId}-deadline`}
            type="date"
            value={deadline}
            onChange={(event) => setDeadline(event.target.value)}
            aria-invalid={Boolean(deadlineError)}
            aria-describedby={`${formId}-deadline-hint`}
          />
          <p id={`${formId}-deadline-hint`} className="text-xs text-slate">
            {copy.deadlineHint}
          </p>
          {deadlineError ? <FieldAlert message={deadlineError} /> : null}
        </div>

        <div className="grid gap-2">
          <Label htmlFor={`${formId}-source`}>{copy.sourceLabel}</Label>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger
              id={`${formId}-source`}
              className="w-full"
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

      <fieldset className="grid min-w-0 gap-2 border-0 p-0">
        <legend className="text-sm font-medium text-ink">{copy.priorityLabel}</legend>
        <p className="text-xs text-slate">{copy.priorityHint}</p>
        <div className="flex flex-wrap items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => {
            const selected = priority !== null && n <= priority;
            return (
              <button
                key={n}
                type="button"
                className="rounded-md p-1 text-ink outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                aria-pressed={priority === n}
                aria-label={
                  priority === n ? copy.priorityClear : copy.prioritySet(n)
                }
                onClick={() => setPriority((current) => (current === n ? null : n))}
              >
                <Star
                  aria-hidden
                  className={cn(
                    "size-5",
                    selected ? "fill-marigold text-ink" : "text-slate",
                  )}
                />
              </button>
            );
          })}
          <span className="ml-2 text-sm text-slate">
            {priority === null ? copy.priorityNone : copy.priorityValue(priority)}
          </span>
        </div>
        {priorityError ? <FieldAlert message={priorityError} /> : null}
      </fieldset>

      <div>
        <Button type="submit">{strings.actions.addJob}</Button>
      </div>
    </form>
  );
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
