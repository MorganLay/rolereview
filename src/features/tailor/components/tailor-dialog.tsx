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
import { EMPHASIS_MAX } from "@/features/tailor/schemas";

const copy = strings.jobs.documents;

export function TailorDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (input: { length: 1 | 2; emphasis: string }) => Promise<void>;
}) {
  const formId = useId();
  const [length, setLength] = useState<1 | 2>(1);
  const [emphasis, setEmphasis] = useState("");
  const [wasOpen, setWasOpen] = useState(false);

  if (open && !wasOpen) {
    setWasOpen(true);
    setLength(1);
    setEmphasis("");
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await onConfirm({ length, emphasis });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} className="grid gap-4">
          <DialogHeader className="pr-8">
            <DialogTitle className="font-sans">{copy.dialogTitle}</DialogTitle>
            <DialogDescription>{copy.dialogBody}</DialogDescription>
          </DialogHeader>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium text-ink">{copy.lengthLabel}</legend>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="radio"
                name={`${formId}-length`}
                value="1"
                checked={length === 1}
                onChange={() => setLength(1)}
                className="accent-pine"
              />
              {copy.length1}
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="radio"
                name={`${formId}-length`}
                value="2"
                checked={length === 2}
                onChange={() => setLength(2)}
                className="accent-pine"
              />
              {copy.length2}
            </label>
          </fieldset>
          <div className="grid gap-2">
            <Label htmlFor={`${formId}-emphasis`}>{copy.emphasisLabel}</Label>
            <Textarea
              id={`${formId}-emphasis`}
              value={emphasis}
              maxLength={EMPHASIS_MAX}
              onChange={(event) => setEmphasis(event.target.value)}
              aria-describedby={`${formId}-emphasis-hint`}
            />
            <div className="flex items-start justify-between gap-3">
              <p id={`${formId}-emphasis-hint`} className="text-xs text-slate">
                {copy.emphasisHint}
              </p>
              <p className="shrink-0 text-xs text-slate tabular-nums">
                {copy.emphasisCount(emphasis.length)}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {strings.common.cancel}
            </Button>
            <Button type="submit">{strings.actions.tailorResume}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
