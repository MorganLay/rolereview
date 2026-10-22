"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
import { strings } from "@/copy/strings";
import type { FieldErrors } from "@/lib/result";

import { createCustomReminder } from "../actions";
import { REMINDER_LIMITS, type ReminderView } from "../reminders";
import { CompletedReminderList, ReminderList } from "./reminder-list";

const copy = strings.jobs.reminders;

export function RemindersTab({
  jobId,
  open,
  completed,
  today,
}: {
  jobId: string;
  open: ReminderView[];
  completed: ReminderView[];
  today: string;
}) {
  const [adding, setAdding] = useState(false);
  const [session, setSession] = useState(0);
  const none = open.length === 0 && completed.length === 0;

  function openAdd() {
    setSession((value) => value + 1);
    setAdding(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button type="button" onClick={openAdd}>
          {copy.add}
        </Button>
      </div>
      {none ? (
        <p className="text-sm text-slate">{copy.empty}</p>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-ink">{copy.openLabel}</h3>
            <ReminderList
              reminders={open}
              empty={copy.openEmpty}
              showJob={false}
              listLabel={copy.openLabel}
            />
          </div>
          <CompletedReminderList reminders={completed} />
        </div>
      )}
      <AddReminderDialog
        key={session}
        jobId={jobId}
        today={today}
        open={adding}
        onOpenChange={setAdding}
      />
    </div>
  );
}

function AddReminderDialog({
  jobId,
  today,
  open,
  onOpenChange,
}: {
  jobId: string;
  today: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const formId = useId();
  const [pending, setPending] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(today);
  const [fields, setFields] = useState<FieldErrors>({});

  function begin(next: boolean) {
    if (pending) return;
    onOpenChange(next);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setFields({});
    const result = await createCustomReminder({ jobId, title, date });
    setPending(false);
    if (!result.ok) {
      if (result.error.code === "VALIDATION" && result.error.fields) {
        setFields(result.error.fields);
        return;
      }
      toast.error(result.error.code === "NOT_FOUND" ? copy.jobMissing : copy.saveFailed);
      return;
    }
    toast.success(copy.added);
    onOpenChange(false);
    router.refresh();
  }

  const titleOver = title.length > REMINDER_LIMITS.title;
  const titleError = fields.title?.[0];
  const dateError = fields.date?.[0];

  return (
    <Dialog open={open} onOpenChange={begin}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} className="grid gap-4">
          <DialogHeader className="pr-8">
            <DialogTitle className="font-sans">{copy.dialogTitle}</DialogTitle>
            <DialogDescription>{copy.dialogBody}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor={`${formId}-title`}>{copy.titleLabel}</Label>
            <Input
              id={`${formId}-title`}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              aria-invalid={Boolean(titleError) || titleOver}
              aria-describedby={`${formId}-title-count`}
            />
            <p
              id={`${formId}-title-count`}
              className={titleOver ? "text-xs text-destructive" : "text-xs text-slate"}
            >
              {copy.titleCount(title.length)}
            </p>
            {titleError ? <FieldAlert message={titleError} /> : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${formId}-date`}>{copy.dateLabel}</Label>
            <Input
              id={`${formId}-date`}
              type="date"
              min="1900-01-01"
              max="2099-12-31"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              aria-invalid={Boolean(dateError)}
              aria-describedby={`${formId}-date-hint`}
            />
            <p id={`${formId}-date-hint`} className="text-xs text-slate">
              {copy.dateHint}
            </p>
            {dateError ? <FieldAlert message={dateError} /> : null}
          </div>
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

function FieldAlert({ message }: { message: string }) {
  return (
    <p className="text-sm text-destructive" role="alert">
      {message}
    </p>
  );
}
