"use client";

import { useId, useState, type FormEvent, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { strings } from "@/copy/strings";
import type { FieldErrors } from "@/lib/result";

import { createInterview, deleteInterview, updateInterview } from "../actions";
import {
  INTERVIEW_KINDS,
  INTERVIEW_LIMITS,
  INTERVIEW_OUTCOMES,
  isInterviewKind,
  isInterviewOutcome,
  zonedDateTimeInstant,
  type InterviewOutcome,
  type InterviewView,
} from "../interviews";

const copy = strings.jobs.interviews;

type DialogMode = { kind: "add" } | { kind: "edit"; interview: InterviewView };

export function InterviewsTab({
  jobId,
  interviews,
  timeZone,
  now,
  nextRound,
}: {
  jobId: string;
  interviews: InterviewView[];
  timeZone: string;
  now: string;
  nextRound: number;
}) {
  const [mode, setMode] = useState<DialogMode | null>(null);
  const [deleting, setDeleting] = useState<InterviewView | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button type="button" onClick={() => setMode({ kind: "add" })}>
          {copy.add}
        </Button>
      </div>

      {interviews.length === 0 ? (
        <p className="text-sm text-slate">{copy.empty}</p>
      ) : (
        <ol aria-label={copy.listLabel} className="flex flex-col">
          {interviews.map((interview) => (
            <li
              key={interview.id}
              className="flex flex-col gap-2 border-b border-line py-3 last:border-b-0"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium break-words text-ink">
                    {copy.roundTitle(interview.round)}
                    <span className="font-normal text-slate">
                      {" "}
                      · {copy.kinds[interview.kind]}
                    </span>
                  </p>
                  <p className="text-xs text-slate">
                    {interview.whenLabel ? (
                      <time dateTime={interview.scheduledAt ?? undefined}>
                        {interview.whenLabel}
                      </time>
                    ) : (
                      copy.noDate
                    )}
                    {interview.durationMinutes
                      ? ` · ${copy.minutes(interview.durationMinutes)}`
                      : null}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`${strings.common.edit}, ${copy.roundTitle(interview.round)}`}
                    onClick={() => setMode({ kind: "edit", interview })}
                  >
                    {strings.common.edit}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`${strings.common.delete}, ${copy.roundTitle(interview.round)}`}
                    onClick={() => setDeleting(interview)}
                  >
                    {strings.common.delete}
                  </Button>
                </div>
              </div>
              {interview.locationOrLink ? (
                interview.link ? (
                  <a
                    href={interview.locationOrLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-fit max-w-full rounded-md break-all text-sm text-pine underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    {interview.locationOrLink}
                  </a>
                ) : (
                  <p className="text-sm break-words text-ink">{interview.locationOrLink}</p>
                )
              ) : null}
              {interview.interviewers ? (
                <p className="text-sm break-words text-ink">
                  <span className="text-slate">{copy.interviewersLabel}. </span>
                  {interview.interviewers}
                </p>
              ) : null}
              {interview.prepNotes ? (
                <p className="text-sm break-words whitespace-pre-wrap text-ink">
                  {interview.prepNotes}
                </p>
              ) : null}
              {interview.past || interview.outcome !== "PENDING" ? (
                <p className="text-sm text-ink">
                  <span className="text-slate">{copy.outcomeLabel}. </span>
                  {copy.outcomes[interview.outcome]}
                </p>
              ) : null}
              {interview.reflection ? (
                <p className="text-sm break-words whitespace-pre-wrap text-ink">
                  <span className="text-slate">{copy.reflectionLabel}. </span>
                  {interview.reflection}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      )}

      <InterviewDialog
        jobId={jobId}
        mode={mode}
        timeZone={timeZone}
        now={now}
        nextRound={nextRound}
        onOpenChange={(open) => {
          if (!open) setMode(null);
        }}
      />
      <DeleteInterviewDialog
        jobId={jobId}
        interview={deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      />
    </div>
  );
}

function InterviewDialog({
  jobId,
  mode,
  timeZone,
  now,
  nextRound,
  onOpenChange,
}: {
  jobId: string;
  mode: DialogMode | null;
  timeZone: string;
  now: string;
  nextRound: number;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const formId = useId();
  const open = mode !== null;
  const [wasOpen, setWasOpen] = useState(false);
  const [round, setRound] = useState(String(nextRound));
  const [kind, setKind] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [locationOrLink, setLocationOrLink] = useState("");
  const [interviewers, setInterviewers] = useState("");
  const [prepNotes, setPrepNotes] = useState("");
  const [reflection, setReflection] = useState("");
  const [outcome, setOutcome] = useState<InterviewOutcome>("PENDING");
  const [fields, setFields] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);

  if (mode && !wasOpen) {
    setWasOpen(true);
    setFields({});
    setPending(false);
    if (mode.kind === "edit") {
      const interview = mode.interview;
      setRound(String(interview.round));
      setKind(interview.kind);
      setScheduledAt(interview.scheduledLocal);
      setDurationMinutes(
        interview.durationMinutes === null ? "" : String(interview.durationMinutes),
      );
      setLocationOrLink(interview.locationOrLink ?? "");
      setInterviewers(interview.interviewers ?? "");
      setPrepNotes(interview.prepNotes ?? "");
      setReflection(interview.reflection ?? "");
      setOutcome(interview.outcome);
    } else {
      setRound(String(nextRound));
      setKind("");
      setScheduledAt("");
      setDurationMinutes("");
      setLocationOrLink("");
      setInterviewers("");
      setPrepNotes("");
      setReflection("");
      setOutcome("PENDING");
    }
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  function begin(next: boolean) {
    if (pending) return;
    onOpenChange(next);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending || !mode) return;
    setPending(true);
    setFields({});
    const payload = {
      jobId,
      round,
      kind,
      scheduledAt,
      durationMinutes,
      locationOrLink,
      interviewers,
      prepNotes,
      reflection,
      outcome,
    };
    const result =
      mode.kind === "edit"
        ? await updateInterview({ ...payload, interviewId: mode.interview.id })
        : await createInterview(payload);
    setPending(false);
    if (!result.ok) {
      if (result.error.code === "VALIDATION" && result.error.fields) {
        setFields(result.error.fields);
        return;
      }
      if (result.error.code === "NOT_FOUND") {
        toast.error(mode.kind === "edit" ? copy.notFound : copy.jobMissing);
        return;
      }
      toast.error(copy.saveFailed);
      return;
    }
    toast.success(mode.kind === "edit" ? copy.updated : copy.added);
    onOpenChange(false);
    router.refresh();
  }

  const showOutcome = outcomeFieldsVisible(scheduledAt, timeZone, now, outcome, reflection);
  const prepOver = prepNotes.length > INTERVIEW_LIMITS.prepNotes;
  const reflectionOver = reflection.length > INTERVIEW_LIMITS.reflection;
  const roundError = fields.round?.[0];
  const kindError = fields.kind?.[0];
  const dateError = fields.scheduledAt?.[0];
  const durationError = fields.durationMinutes?.[0];
  const locationError = fields.locationOrLink?.[0];
  const interviewersError = fields.interviewers?.[0];
  const prepError = fields.prepNotes?.[0];
  const reflectionError = fields.reflection?.[0];
  const outcomeError = fields.outcome?.[0];

  return (
    <Dialog open={open} onOpenChange={begin}>
      <DialogContent className="max-h-[min(40rem,calc(100dvh-2rem))] overflow-y-auto sm:max-w-md">
        <form onSubmit={onSubmit} className="grid gap-4">
          <DialogHeader className="pr-8">
            <DialogTitle className="font-sans">
              {mode?.kind === "edit" ? copy.dialogEditTitle : copy.dialogAddTitle}
            </DialogTitle>
            <DialogDescription>{copy.dialogBody}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor={`${formId}-round`}>{copy.roundLabel}</Label>
            <Input
              id={`${formId}-round`}
              inputMode="numeric"
              value={round}
              onChange={(event) => setRound(event.target.value)}
              aria-invalid={Boolean(roundError)}
            />
            {roundError ? <FieldAlert message={roundError} /> : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${formId}-kind`}>{copy.kindLabel}</Label>
            <Select
              value={kind || undefined}
              onValueChange={(value) => {
                if (isInterviewKind(value)) setKind(value);
              }}
            >
              <SelectTrigger
                id={`${formId}-kind`}
                className="w-full"
                aria-invalid={Boolean(kindError)}
              >
                <SelectValue placeholder={copy.kindPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {INTERVIEW_KINDS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {copy.kinds[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {kindError ? <FieldAlert message={kindError} /> : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${formId}-when`}>{copy.dateTimeLabel}</Label>
            <Input
              id={`${formId}-when`}
              type="datetime-local"
              min="1900-01-01T00:00"
              max="2099-12-31T23:59"
              value={scheduledAt}
              onChange={(event) => setScheduledAt(event.target.value)}
              aria-invalid={Boolean(dateError)}
              aria-describedby={`${formId}-zone`}
            />
            <p id={`${formId}-zone`} className="text-xs text-slate">
              {copy.timeZoneHint(timeZone)}
            </p>
            {dateError ? <FieldAlert message={dateError} /> : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${formId}-duration`}>{copy.durationLabel}</Label>
            <Input
              id={`${formId}-duration`}
              inputMode="numeric"
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(event.target.value)}
              aria-invalid={Boolean(durationError)}
              aria-describedby={`${formId}-duration-hint`}
            />
            <p id={`${formId}-duration-hint`} className="text-xs text-slate">
              {copy.durationHint}
            </p>
            {durationError ? <FieldAlert message={durationError} /> : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${formId}-location`}>{copy.locationLabel}</Label>
            <Input
              id={`${formId}-location`}
              value={locationOrLink}
              onChange={(event) => setLocationOrLink(event.target.value)}
              aria-invalid={Boolean(locationError)}
            />
            {locationError ? <FieldAlert message={locationError} /> : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${formId}-people`}>{copy.interviewersLabel}</Label>
            <Input
              id={`${formId}-people`}
              value={interviewers}
              onChange={(event) => setInterviewers(event.target.value)}
              aria-invalid={Boolean(interviewersError)}
            />
            {interviewersError ? <FieldAlert message={interviewersError} /> : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${formId}-prep`}>{copy.prepLabel}</Label>
            <Textarea
              id={`${formId}-prep`}
              value={prepNotes}
              onChange={(event) => setPrepNotes(event.target.value)}
              rows={3}
              aria-invalid={Boolean(prepError) || prepOver}
              aria-describedby={`${formId}-prep-count`}
            />
            <p
              id={`${formId}-prep-count`}
              className={prepOver ? "text-xs text-destructive" : "text-xs text-slate"}
            >
              {copy.notesCount(prepNotes.length)}
            </p>
            {prepError ? <FieldAlert message={prepError} /> : null}
          </div>
          {showOutcome ? (
            <>
              <div className="grid gap-2">
                <Label htmlFor={`${formId}-outcome`}>{copy.outcomeLabel}</Label>
                <Select
                  value={outcome}
                  onValueChange={(value) => {
                    if (isInterviewOutcome(value)) setOutcome(value);
                  }}
                >
                  <SelectTrigger
                    id={`${formId}-outcome`}
                    className="w-full"
                    aria-invalid={Boolean(outcomeError)}
                  >
                    <SelectValue placeholder={copy.outcomePlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERVIEW_OUTCOMES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {copy.outcomes[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {outcomeError ? <FieldAlert message={outcomeError} /> : null}
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`${formId}-reflection`}>{copy.reflectionLabel}</Label>
                <Textarea
                  id={`${formId}-reflection`}
                  value={reflection}
                  onChange={(event) => setReflection(event.target.value)}
                  rows={3}
                  aria-invalid={Boolean(reflectionError) || reflectionOver}
                  aria-describedby={`${formId}-reflection-hint ${formId}-reflection-count`}
                />
                <p id={`${formId}-reflection-hint`} className="text-xs text-slate">
                  {copy.reflectionHint}
                </p>
                <p
                  id={`${formId}-reflection-count`}
                  className={
                    reflectionOver ? "text-xs text-destructive" : "text-xs text-slate"
                  }
                >
                  {copy.notesCount(reflection.length)}
                </p>
                {reflectionError ? <FieldAlert message={reflectionError} /> : null}
              </div>
            </>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => begin(false)} disabled={pending}>
              {strings.common.cancel}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? copy.saving : strings.common.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteInterviewDialog({
  jobId,
  interview,
  onOpenChange,
}: {
  jobId: string;
  interview: InterviewView | null;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onConfirm(event: MouseEvent) {
    event.preventDefault();
    if (pending || !interview) return;
    setPending(true);
    try {
      const result = await deleteInterview({ jobId, interviewId: interview.id });
      if (!result.ok) {
        toast.error(result.error.code === "NOT_FOUND" ? copy.notFound : copy.deleteFailed);
        return;
      }
      toast.success(copy.deleted);
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error(copy.deleteFailed);
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog open={interview !== null} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-sans">{copy.deleteTitle}</AlertDialogTitle>
          <AlertDialogDescription>{copy.deleteBody}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{strings.common.cancel}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={pending} onClick={onConfirm}>
            {pending ? copy.deleting : strings.common.delete}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function outcomeFieldsVisible(
  local: string,
  timeZone: string,
  nowIso: string,
  outcome: InterviewOutcome,
  reflection: string,
): boolean {
  if (outcome !== "PENDING" || reflection.trim().length > 0) return true;
  if (!local) return false;
  const instant = zonedDateTimeInstant(local, timeZone);
  if (!instant) return false;
  return instant.getTime() <= new Date(nowIso).getTime();
}

function FieldAlert({ message }: { message: string }) {
  return (
    <p className="text-sm text-destructive" role="alert">
      {message}
    </p>
  );
}
