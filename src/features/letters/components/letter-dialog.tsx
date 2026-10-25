"use client";

import { useId, useState, type FormEvent } from "react";

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
import { Textarea } from "@/components/ui/textarea";
import { strings } from "@/copy/strings";
import { zodFieldErrors } from "@/features/library/schemas";
import {
  LETTER_LENGTHS,
  LETTER_LIMITS,
  LETTER_TONES,
  writeLetterSchema,
  type LetterLength,
  type LetterTone,
} from "@/features/letters/schemas";
import type { FieldErrors } from "@/lib/result";

import type { LetterAlignChoice } from "../status";

const copy = strings.jobs.letters;

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:border-destructive/50";

export type LetterDraft = {
  tone: LetterTone;
  length: LetterLength;
  recipientName: string;
  whyCompany: string;
  resumeId: string;
};

export function LetterDialog({
  jobId,
  open,
  resumes,
  onOpenChange,
  onConfirm,
}: {
  jobId: string;
  open: boolean;
  resumes: LetterAlignChoice[];
  onOpenChange: (open: boolean) => void;
  onConfirm: (input: LetterDraft) => Promise<void>;
}) {
  const formId = useId();
  const [tone, setTone] = useState<LetterTone>("professional");
  const [length, setLength] = useState<LetterLength>("standard");
  const [recipientName, setRecipientName] = useState("");
  const [whyCompany, setWhyCompany] = useState("");
  const [resumeId, setResumeId] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);

  if (open && !wasOpen) {
    setWasOpen(true);
    setTone("professional");
    setLength("standard");
    setRecipientName("");
    setWhyCompany("");
    setResumeId("");
    setErrors({});
    setSubmitting(false);
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = writeLetterSchema.safeParse({
      jobId,
      tone,
      length,
      recipientName,
      whyCompany,
      ...(resumeId ? { resumeId } : {}),
    });
    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await onConfirm({
        tone: parsed.data.tone,
        length: parsed.data.length,
        recipientName: parsed.data.recipientName ?? "",
        whyCompany: parsed.data.whyCompany ?? "",
        resumeId: parsed.data.resumeId ?? "",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const recipientError = errors.recipientName?.[0];
  const whyError = errors.whyCompany?.[0];
  const alignError = errors.resumeId?.[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} className="grid max-h-[70vh] gap-4 overflow-y-auto">
          <DialogHeader className="pr-8">
            <DialogTitle className="font-sans">{copy.dialogTitle}</DialogTitle>
            <DialogDescription>{copy.dialogBody}</DialogDescription>
          </DialogHeader>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium text-ink">{copy.toneLabel}</legend>
            {LETTER_TONES.map((option) => (
              <label key={option} className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="radio"
                  name={`${formId}-tone`}
                  value={option}
                  checked={tone === option}
                  onChange={() => setTone(option)}
                  className="accent-pine"
                />
                {copy.tones[option]}
              </label>
            ))}
          </fieldset>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium text-ink">{copy.lengthLabel}</legend>
            {LETTER_LENGTHS.map((option) => (
              <label key={option} className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="radio"
                  name={`${formId}-length`}
                  value={option}
                  checked={length === option}
                  onChange={() => setLength(option)}
                  className="accent-pine"
                />
                {copy.lengths[option]}
              </label>
            ))}
          </fieldset>
          <div className="grid gap-2">
            <Label htmlFor={`${formId}-recipient`}>{copy.recipientLabel}</Label>
            <Input
              id={`${formId}-recipient`}
              value={recipientName}
              maxLength={LETTER_LIMITS.recipientName}
              aria-invalid={Boolean(recipientError)}
              aria-describedby={`${formId}-recipient-hint`}
              onChange={(event) => setRecipientName(event.target.value)}
            />
            <div className="flex items-start justify-between gap-3">
              <p id={`${formId}-recipient-hint`} className="text-xs text-slate">
                {copy.recipientHint}
              </p>
              <p className="shrink-0 text-xs text-slate tabular-nums">
                {copy.recipientCount(recipientName.length)}
              </p>
            </div>
            {recipientError ? (
              <p className="text-sm text-destructive" role="alert">
                {recipientError}
              </p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${formId}-why`}>{copy.whyLabel}</Label>
            <Textarea
              id={`${formId}-why`}
              value={whyCompany}
              maxLength={LETTER_LIMITS.whyCompany}
              aria-invalid={Boolean(whyError)}
              aria-describedby={`${formId}-why-hint`}
              onChange={(event) => setWhyCompany(event.target.value)}
            />
            <div className="flex items-start justify-between gap-3">
              <p id={`${formId}-why-hint`} className="text-xs text-slate">
                {copy.whyHint}
              </p>
              <p className="shrink-0 text-xs text-slate tabular-nums">
                {copy.whyCount(whyCompany.length)}
              </p>
            </div>
            {whyError ? (
              <p className="text-sm text-destructive" role="alert">
                {whyError}
              </p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${formId}-align`}>{copy.alignLabel}</Label>
            <select
              id={`${formId}-align`}
              value={resumeId}
              aria-invalid={Boolean(alignError)}
              aria-describedby={`${formId}-align-hint`}
              className={selectClass}
              onChange={(event) => setResumeId(event.target.value)}
            >
              <option value="">{copy.alignNone}</option>
              {resumes.map((resume) => (
                <option key={resume.id} value={resume.id}>
                  {resume.title}
                </option>
              ))}
            </select>
            <p id={`${formId}-align-hint`} className="text-xs text-slate">
              {copy.alignHint}
            </p>
            {alignError ? (
              <p className="text-sm text-destructive" role="alert">
                {alignError}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {strings.common.cancel}
            </Button>
            <Button type="submit" disabled={submitting}>
              {strings.actions.writeCoverLetter}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
