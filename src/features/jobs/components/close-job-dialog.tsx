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

import { CLOSED_JOB_STATUSES, isClosedJobStatus, type JobStatusValue } from "../schemas";

const copy = strings.jobs.detail;
const board = strings.jobs.board;

export function CloseJobDialog({
  open,
  status,
  pending,
  pickStatus = false,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  status: JobStatusValue | null;
  pending: boolean;
  pickStatus?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string, status: JobStatusValue) => Promise<string | undefined>;
}) {
  const reasonId = useId();
  const statusId = useId();
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | undefined>();
  const [chosen, setChosen] = useState<JobStatusValue | null>(status);
  const [wasOpen, setWasOpen] = useState(false);

  if (open && !wasOpen) {
    setWasOpen(true);
    setReason("");
    setReasonError(undefined);
    setChosen(status);
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  const activeStatus = pickStatus ? chosen : status;

  function begin(next: boolean) {
    if (pending) return;
    if (next) {
      setReason("");
      setReasonError(undefined);
    }
    onOpenChange(next);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending || !activeStatus) return;
    setReasonError(undefined);
    const message = await onConfirm(reason, activeStatus);
    if (message) setReasonError(message);
  }

  return (
    <Dialog open={open} onOpenChange={begin}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} className="grid gap-4">
          <DialogHeader className="pr-8">
            <DialogTitle className="font-sans">
              {activeStatus ? copy.closeAs(copy.statuses[activeStatus]) : copy.closeTitle}
            </DialogTitle>
            <DialogDescription>{copy.closeBody}</DialogDescription>
          </DialogHeader>
          {pickStatus ? (
            <div className="grid gap-2">
              <Label htmlFor={statusId}>{board.closedStatusLabel}</Label>
              <Select
                value={chosen ?? undefined}
                onValueChange={(value) => {
                  if (isClosedJobStatus(value)) setChosen(value);
                }}
              >
                <SelectTrigger id={statusId} className="w-full">
                  <SelectValue placeholder={board.closedStatusPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {CLOSED_JOB_STATUSES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {copy.statuses[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor={reasonId}>{copy.closeReasonLabel}</Label>
            <Textarea
              id={reasonId}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              aria-invalid={Boolean(reasonError)}
            />
            {reasonError ? (
              <p className="text-sm text-destructive" role="alert">
                {reasonError}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => begin(false)}
              disabled={pending}
            >
              {strings.common.cancel}
            </Button>
            <Button type="submit" disabled={pending || !activeStatus}>
              {pending ? copy.updating : copy.closeConfirm}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
