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
import { Textarea } from "@/components/ui/textarea";
import { strings } from "@/copy/strings";

import type { JobStatusValue } from "../schemas";

const copy = strings.jobs.detail;

export function CloseJobDialog({
  open,
  status,
  pending,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  status: JobStatusValue | null;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => Promise<string | undefined>;
}) {
  const reasonId = useId();
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | undefined>();
  const [wasOpen, setWasOpen] = useState(false);

  if (open && !wasOpen) {
    setWasOpen(true);
    setReason("");
    setReasonError(undefined);
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

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
    if (pending || !status) return;
    setReasonError(undefined);
    const message = await onConfirm(reason);
    if (message) setReasonError(message);
  }

  return (
    <Dialog open={open} onOpenChange={begin}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} className="grid gap-4">
          <DialogHeader className="pr-8">
            <DialogTitle className="font-sans">
              {status ? copy.closeAs(copy.statuses[status]) : copy.closeTitle}
            </DialogTitle>
            <DialogDescription>{copy.closeBody}</DialogDescription>
          </DialogHeader>
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
            <Button type="submit" disabled={pending || !status}>
              {pending ? copy.updating : copy.closeConfirm}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
