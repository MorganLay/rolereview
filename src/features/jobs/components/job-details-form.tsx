"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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

import { updateJobDetails } from "../actions";
import {
  EMPLOYMENT_TYPES,
  EMPTY_CHOICE,
  JOB_LIMITS,
  JOB_SOURCES,
  PAY_PERIODS,
  WORK_MODES,
  type UpdateJobDetailsInput,
} from "../schemas";

const copy = strings.jobs.detail;
const jobs = strings.jobs;
const resultCopy = strings.jobs.result;

type JobDetailsFormProps = {
  jobId: string;
  source: (typeof JOB_SOURCES)[number] | null;
  sourceDetail: string | null;
  workMode: (typeof WORK_MODES)[number];
  employmentType: (typeof EMPLOYMENT_TYPES)[number] | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: (typeof PAY_PERIODS)[number] | null;
  referenceNumber: string | null;
  deadline: string | null;
  notes: string | null;
};

type DetailsDraft = {
  source: string;
  sourceDetail: string;
  workMode: (typeof WORK_MODES)[number];
  employmentType: string;
  salaryMin: string;
  salaryMax: string;
  salaryCurrency: string;
  salaryPeriod: string;
  referenceNumber: string;
  deadline: string;
  notes: string;
};

function draftFrom(job: JobDetailsFormProps): DetailsDraft {
  return {
    source: job.source ?? EMPTY_CHOICE,
    sourceDetail: job.sourceDetail ?? "",
    workMode: job.workMode,
    employmentType: job.employmentType ?? EMPTY_CHOICE,
    salaryMin: job.salaryMin === null ? "" : String(job.salaryMin),
    salaryMax: job.salaryMax === null ? "" : String(job.salaryMax),
    salaryCurrency: job.salaryCurrency ?? "",
    salaryPeriod: job.salaryPeriod ?? EMPTY_CHOICE,
    referenceNumber: job.referenceNumber ?? "",
    deadline: job.deadline ?? "",
    notes: job.notes ?? "",
  };
}

function sameDraft(a: DetailsDraft, b: DetailsDraft): boolean {
  return (Object.keys(a) as (keyof DetailsDraft)[]).every((key) => a[key] === b[key]);
}

function isWorkMode(value: string): value is (typeof WORK_MODES)[number] {
  return (WORK_MODES as readonly string[]).includes(value);
}

export function JobDetailsForm(job: JobDetailsFormProps) {
  const router = useRouter();
  const formId = useId();
  const initial = draftFrom(job);
  const [draft, setDraft] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [fields, setFields] = useState<FieldErrors>({});
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const draftRef = useRef(initial);
  const savedRef = useRef(initial);
  const queue = useRef(Promise.resolve());
  const incomingKey = JSON.stringify(draftFrom(job));
  const [seen, setSeen] = useState(incomingKey);

  if (incomingKey !== seen) {
    setSeen(incomingKey);
    if (sameDraft(draft, saved)) {
      const next = draftFrom(job);
      draftRef.current = next;
      savedRef.current = next;
      setDraft(next);
      setSaved(next);
    }
  }

  function update(patch: Partial<DetailsDraft>, save: boolean) {
    const next = { ...draftRef.current, ...patch };
    draftRef.current = next;
    setDraft(next);
    setFields({});
    if (saveState === "saved") setSaveState("idle");
    if (save) enqueue();
  }

  function enqueue() {
    if (sameDraft(draftRef.current, savedRef.current)) return;
    setSaveState("saving");
    queue.current = queue.current
      .then(() => write())
      .catch(() => {
        setSaveState("idle");
        toast.error(jobs.saveFailed);
      });
  }

  async function write() {
    const payload = { ...draftRef.current };
    if (sameDraft(payload, savedRef.current)) {
      setSaveState("saved");
      return;
    }
    const result = await updateJobDetails(toInput(job.jobId, payload));
    if (!result.ok) {
      setSaveState("idle");
      if (result.error.code === "VALIDATION") {
        setFields(result.error.fields ?? {});
        return;
      }
      toast.error(jobs.saveFailed);
      return;
    }
    savedRef.current = payload;
    setSaved(payload);
    setFields({});
    if (sameDraft(draftRef.current, payload)) setSaveState("saved");
    router.refresh();
  }

  const notesOver = draft.notes.length > JOB_LIMITS.notes;

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        enqueue();
      }}
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-medium text-ink">{resultCopy.details}</h2>
        <p className="text-xs text-slate">{copy.formHint}</p>
        <p aria-live="polite" className="min-h-4 text-xs text-slate">
          {saveState === "saving" ? copy.saving : saveState === "saved" ? copy.saved : ""}
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={`${formId}-source`}>{jobs.sourceLabel}</Label>
          <Select
            value={draft.source}
            onValueChange={(value) => update({ source: value }, true)}
          >
            <SelectTrigger
              id={`${formId}-source`}
              className="w-full"
              aria-invalid={Boolean(fields.source?.[0])}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={EMPTY_CHOICE}>{jobs.sourceNone}</SelectItem>
              {JOB_SOURCES.map((value) => (
                <SelectItem key={value} value={value}>
                  {jobs.sources[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fields.source?.[0] ? <FieldAlert message={fields.source[0]} /> : null}
        </div>

        <div className="grid gap-2">
          <Label htmlFor={`${formId}-source-detail`}>{copy.sourceDetailLabel}</Label>
          <Input
            id={`${formId}-source-detail`}
            value={draft.sourceDetail}
            onChange={(event) => update({ sourceDetail: event.target.value }, false)}
            onBlur={() => enqueue()}
            autoComplete="off"
            aria-invalid={Boolean(fields.sourceDetail?.[0])}
            aria-describedby={`${formId}-source-detail-hint`}
          />
          <p id={`${formId}-source-detail-hint`} className="text-xs text-slate">
            {copy.sourceDetailHint}
          </p>
          {fields.sourceDetail?.[0] ? (
            <FieldAlert message={fields.sourceDetail[0]} />
          ) : null}
        </div>

        <div className="grid gap-2">
          <Label htmlFor={`${formId}-work`}>{resultCopy.workMode}</Label>
          <Select
            value={draft.workMode}
            onValueChange={(value) => {
              if (isWorkMode(value)) update({ workMode: value }, true);
            }}
          >
            <SelectTrigger
              id={`${formId}-work`}
              className="w-full"
              aria-invalid={Boolean(fields.workMode?.[0])}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WORK_MODES.map((value) => (
                <SelectItem key={value} value={value}>
                  {resultCopy.workModes[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fields.workMode?.[0] ? <FieldAlert message={fields.workMode[0]} /> : null}
        </div>

        <div className="grid gap-2">
          <Label htmlFor={`${formId}-employment`}>{resultCopy.employment}</Label>
          <Select
            value={draft.employmentType}
            onValueChange={(value) => update({ employmentType: value }, true)}
          >
            <SelectTrigger
              id={`${formId}-employment`}
              className="w-full"
              aria-invalid={Boolean(fields.employmentType?.[0])}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={EMPTY_CHOICE}>{copy.employmentNone}</SelectItem>
              {EMPLOYMENT_TYPES.map((value) => (
                <SelectItem key={value} value={value}>
                  {resultCopy.employmentTypes[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fields.employmentType?.[0] ? (
            <FieldAlert message={fields.employmentType[0]} />
          ) : null}
        </div>
      </div>

      <fieldset className="grid gap-3 border-0 p-0">
        <legend className="text-sm font-medium text-ink">{resultCopy.salary}</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor={`${formId}-min`}>{copy.salaryMin}</Label>
            <Input
              id={`${formId}-min`}
              inputMode="numeric"
              value={draft.salaryMin}
              onChange={(event) => update({ salaryMin: event.target.value }, false)}
              onBlur={() => enqueue()}
              autoComplete="off"
              aria-invalid={Boolean(fields.salaryMin?.[0])}
            />
            {fields.salaryMin?.[0] ? <FieldAlert message={fields.salaryMin[0]} /> : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${formId}-max`}>{copy.salaryMax}</Label>
            <Input
              id={`${formId}-max`}
              inputMode="numeric"
              value={draft.salaryMax}
              onChange={(event) => update({ salaryMax: event.target.value }, false)}
              onBlur={() => enqueue()}
              autoComplete="off"
              aria-invalid={Boolean(fields.salaryMax?.[0])}
            />
            {fields.salaryMax?.[0] ? <FieldAlert message={fields.salaryMax[0]} /> : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${formId}-currency`}>{copy.currencyLabel}</Label>
            <Input
              id={`${formId}-currency`}
              value={draft.salaryCurrency}
              onChange={(event) =>
                update({ salaryCurrency: event.target.value }, false)
              }
              onBlur={() =>
                update(
                  { salaryCurrency: draftRef.current.salaryCurrency.toUpperCase() },
                  true,
                )
              }
              autoComplete="off"
              maxLength={3}
              aria-invalid={Boolean(fields.salaryCurrency?.[0])}
              aria-describedby={`${formId}-currency-hint`}
            />
            <p id={`${formId}-currency-hint`} className="text-xs text-slate">
              {copy.currencyHint}
            </p>
            {fields.salaryCurrency?.[0] ? (
              <FieldAlert message={fields.salaryCurrency[0]} />
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${formId}-period`}>{copy.periodLabel}</Label>
            <Select
              value={draft.salaryPeriod}
              onValueChange={(value) => update({ salaryPeriod: value }, true)}
            >
              <SelectTrigger
                id={`${formId}-period`}
                className="w-full"
                aria-invalid={Boolean(fields.salaryPeriod?.[0])}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EMPTY_CHOICE}>{copy.periodNone}</SelectItem>
                {PAY_PERIODS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {copy.periods[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fields.salaryPeriod?.[0] ? (
              <FieldAlert message={fields.salaryPeriod[0]} />
            ) : null}
          </div>
        </div>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={`${formId}-reference`}>{resultCopy.reference}</Label>
          <Input
            id={`${formId}-reference`}
            value={draft.referenceNumber}
            onChange={(event) =>
              update({ referenceNumber: event.target.value }, false)
            }
            onBlur={() => enqueue()}
            autoComplete="off"
            aria-invalid={Boolean(fields.referenceNumber?.[0])}
          />
          {fields.referenceNumber?.[0] ? (
            <FieldAlert message={fields.referenceNumber[0]} />
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${formId}-deadline`}>{jobs.deadlineLabel}</Label>
          <Input
            id={`${formId}-deadline`}
            type="date"
            value={draft.deadline}
            onChange={(event) => update({ deadline: event.target.value }, true)}
            aria-invalid={Boolean(fields.deadline?.[0])}
            aria-describedby={`${formId}-deadline-hint`}
          />
          <p id={`${formId}-deadline-hint`} className="text-xs text-slate">
            {jobs.deadlineHint}
          </p>
          {fields.deadline?.[0] ? <FieldAlert message={fields.deadline[0]} /> : null}
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${formId}-notes`}>{copy.notesLabel}</Label>
        <Textarea
          id={`${formId}-notes`}
          value={draft.notes}
          onChange={(event) => update({ notes: event.target.value }, false)}
          onBlur={() => enqueue()}
          rows={5}
          aria-invalid={Boolean(fields.notes?.[0]) || notesOver}
          aria-describedby={`${formId}-notes-count`}
        />
        <p
          id={`${formId}-notes-count`}
          className={notesOver ? "text-xs text-destructive" : "text-xs text-slate"}
        >
          {copy.notesCount(draft.notes.length)}
        </p>
        {fields.notes?.[0] ? <FieldAlert message={fields.notes[0]} /> : null}
      </div>
    </form>
  );
}

function toInput(jobId: string, draft: DetailsDraft): UpdateJobDetailsInput {
  return {
    jobId,
    source: draft.source,
    sourceDetail: draft.sourceDetail,
    workMode: draft.workMode,
    employmentType: draft.employmentType,
    salaryMin: draft.salaryMin,
    salaryMax: draft.salaryMax,
    salaryCurrency: draft.salaryCurrency,
    salaryPeriod: draft.salaryPeriod,
    referenceNumber: draft.referenceNumber,
    deadline: draft.deadline,
    notes: draft.notes,
  };
}

function FieldAlert({ message }: { message: string }) {
  return (
    <p className="text-sm text-destructive" role="alert">
      {message}
    </p>
  );
}
