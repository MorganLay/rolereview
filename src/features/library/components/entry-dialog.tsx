"use client";

import { useId, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { strings } from "@/copy/strings";
import {
  composeResumeDate,
  formatMonth,
  getResumeYearOptions,
  splitResumeDate,
} from "@/features/library/dates";
import { ENTRY_LIMITS } from "@/features/library/schemas";
import type { FieldErrors } from "@/lib/result";

import { createEntry, updateEntry } from "../actions";
import type { LibraryEntry } from "../types";

export type EntryEditor =
  | { mode: "create"; kind: LibraryEntry["kind"] }
  | { mode: "edit"; entry: LibraryEntry };

type EntryDialogProps = {
  editor: EntryEditor;
  onClose: () => void;
};

const copy = strings.library.entries;

const dateSelectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:border-destructive/50";

function fieldMessage(fields: FieldErrors, key: string): string | undefined {
  return fields[key]?.[0];
}

export function EntryDialog({ editor, onClose }: EntryDialogProps) {
  const entry = editor.mode === "edit" ? editor.entry : null;
  const kind = editor.mode === "edit" ? editor.entry.kind : editor.kind;
  const kindCopy = copy.kinds[kind];
  const formId = useId();
  const start = splitResumeDate(entry?.startDate ?? null);
  const end = splitResumeDate(entry?.endDate ?? null);

  const [title, setTitle] = useState(entry?.title ?? "");
  const [organization, setOrganization] = useState(entry?.organization ?? "");
  const [location, setLocation] = useState(entry?.location ?? "");
  const [url, setUrl] = useState(entry?.url ?? "");
  const [startYear, setStartYear] = useState(start.year);
  const [startMonth, setStartMonth] = useState(start.month);
  const [endYear, setEndYear] = useState(end.year);
  const [endMonth, setEndMonth] = useState(end.month);
  const [isCurrent, setIsCurrent] = useState(entry?.isCurrent ?? false);
  const [fields, setFields] = useState<FieldErrors>({});
  const [pending, startTransition] = useTransition();

  function onOpenChange(next: boolean) {
    if (pending) return;
    if (!next) onClose();
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFields({});

    const payload = {
      title,
      organization,
      location,
      url,
      startDate: composeResumeDate(startYear, startMonth),
      endDate: isCurrent ? "" : composeResumeDate(endYear, endMonth),
      isCurrent,
    };

    startTransition(async () => {
      const result =
        editor.mode === "edit"
          ? await updateEntry({ id: editor.entry.id, ...payload })
          : await createEntry({ kind: editor.kind, ...payload });

      if (!result.ok) {
        if (result.error.code === "VALIDATION" && result.error.fields) {
          setFields(result.error.fields);
          return;
        }
        toast.error(copy.saveFailed);
        return;
      }

      toast.success(copy.saved);
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(40rem,calc(100%-2rem))] overflow-y-auto sm:max-w-lg">
        <form onSubmit={onSubmit} className="grid gap-4">
          <DialogHeader className="pr-8">
            <DialogTitle className="font-sans">
              {editor.mode === "edit" ? kindCopy.edit : kindCopy.add}
            </DialogTitle>
            <DialogDescription>{copy.description}</DialogDescription>
          </DialogHeader>

          <Field
            id={`${formId}-title`}
            label={kindCopy.titleLabel}
            error={fieldMessage(fields, "title")}
          >
            <Input
              id={`${formId}-title`}
              name="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={ENTRY_LIMITS.title}
              required
              aria-invalid={Boolean(fieldMessage(fields, "title"))}
              aria-describedby={
                fieldMessage(fields, "title")
                  ? `${formId}-title-error`
                  : undefined
              }
            />
          </Field>

          <Field
            id={`${formId}-organization`}
            label={kindCopy.organizationLabel}
            error={fieldMessage(fields, "organization")}
          >
            <Input
              id={`${formId}-organization`}
              name="organization"
              value={organization}
              onChange={(event) => setOrganization(event.target.value)}
              maxLength={ENTRY_LIMITS.organization}
              aria-invalid={Boolean(fieldMessage(fields, "organization"))}
              aria-describedby={
                fieldMessage(fields, "organization")
                  ? `${formId}-organization-error`
                  : undefined
              }
            />
          </Field>

          <Field
            id={`${formId}-location`}
            label={copy.location}
            error={fieldMessage(fields, "location")}
          >
            <Input
              id={`${formId}-location`}
              name="location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              maxLength={ENTRY_LIMITS.location}
              aria-invalid={Boolean(fieldMessage(fields, "location"))}
              aria-describedby={
                fieldMessage(fields, "location")
                  ? `${formId}-location-error`
                  : undefined
              }
            />
          </Field>

          <Field
            id={`${formId}-url`}
            label={copy.url}
            error={fieldMessage(fields, "url")}
          >
            <Input
              id={`${formId}-url`}
              name="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              inputMode="url"
              placeholder={copy.urlPlaceholder}
              maxLength={ENTRY_LIMITS.url}
              aria-invalid={Boolean(fieldMessage(fields, "url"))}
              aria-describedby={
                fieldMessage(fields, "url") ? `${formId}-url-error` : undefined
              }
            />
          </Field>

          <DateFields
            id={`${formId}-start`}
            legend={copy.start}
            year={startYear}
            month={startMonth}
            error={fieldMessage(fields, "startDate")}
            onYear={setStartYear}
            onMonth={setStartMonth}
          />

          <div className="flex items-center gap-2">
            <Checkbox
              id={`${formId}-current`}
              checked={isCurrent}
              onCheckedChange={(checked) => setIsCurrent(checked === true)}
            />
            <Label htmlFor={`${formId}-current`}>{kindCopy.current}</Label>
          </div>

          {isCurrent ? null : (
            <DateFields
              id={`${formId}-end`}
              legend={copy.end}
              year={endYear}
              month={endMonth}
              error={fieldMessage(fields, "endDate")}
              onYear={setEndYear}
              onMonth={setEndMonth}
            />
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
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

function DateFields({
  id,
  legend,
  year,
  month,
  error,
  onYear,
  onMonth,
}: {
  id: string;
  legend: string;
  year: string;
  month: string;
  error?: string;
  onYear: (value: string) => void;
  onMonth: (value: string) => void;
}) {
  const options = getResumeYearOptions();
  const years =
    year.length > 0 && !options.includes(year) ? [year, ...options] : options;

  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor={`${id}-month`}>{copy.month}</Label>
          <select
            id={`${id}-month`}
            value={month}
            onChange={(event) => onMonth(event.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-error` : undefined}
            className={dateSelectClass}
          >
            <option value="">{copy.yearOnly}</option>
            {Array.from({ length: 12 }, (_, index) => {
              const value = String(index + 1).padStart(2, "0");
              return (
                <option key={value} value={value}>
                  {formatMonth(index + 1)}
                </option>
              );
            })}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-year`}>{copy.year}</Label>
          <select
            id={`${id}-year`}
            value={year}
            onChange={(event) => onYear(event.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-error` : undefined}
            className={dateSelectClass}
          >
            <option value="">{copy.noDate}</option>
            {years.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
