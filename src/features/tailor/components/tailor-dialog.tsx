"use client";

import { useId, useState, type FormEvent } from "react";
import { ShieldCheck } from "lucide-react";

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
import { cn } from "@/lib/utils";

const copy = strings.jobs.documents;

const LENGTHS = [1, 2] as const;

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
      <DialogContent
        className="p-5 sm:max-w-md"
        overlayClassName="bg-ink/25 dark:bg-black/45"
      >
        <form onSubmit={onSubmit} className="grid gap-5">
          <DialogHeader className="gap-1.5 pr-8">
            <DialogTitle className="font-sans text-lg leading-snug">
              {copy.dialogTitle}
            </DialogTitle>
            <DialogDescription className="leading-relaxed">
              {copy.dialogBody}
            </DialogDescription>
          </DialogHeader>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium text-foreground">
              {copy.lengthLabel}
            </legend>
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-line bg-paper p-1 dark:bg-ink-bg">
              {LENGTHS.map((value) => {
                const selected = length === value;
                return (
                  <label
                    key={value}
                    className={cn(
                      "flex h-8 cursor-pointer items-center justify-center rounded-md text-sm font-medium transition-colors",
                      "has-[:focus-visible]:relative has-[:focus-visible]:z-10 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                      selected
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground hover:bg-pine-50 dark:hover:bg-white/5",
                    )}
                  >
                    <input
                      type="radio"
                      name={`${formId}-length`}
                      value={value}
                      checked={selected}
                      onChange={() => setLength(value)}
                      className="sr-only"
                    />
                    {value === 1 ? copy.length1 : copy.length2}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <div className="grid gap-2">
            <Label htmlFor={`${formId}-emphasis`} className="w-full justify-between">
              <span>{copy.emphasisLabel}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {copy.emphasisOptional}
              </span>
            </Label>
            <Textarea
              id={`${formId}-emphasis`}
              value={emphasis}
              maxLength={EMPHASIS_MAX}
              rows={3}
              placeholder={copy.emphasisPlaceholder}
              onChange={(event) => setEmphasis(event.target.value)}
              aria-describedby={`${formId}-emphasis-count`}
              className="min-h-24 resize-y bg-paper px-3 py-2.5 dark:bg-ink-bg"
            />
            <p
              id={`${formId}-emphasis-count`}
              className="text-right text-xs text-muted-foreground tabular-nums"
            >
              {copy.emphasisCount(emphasis.length)}
            </p>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
            {copy.grounded}
          </p>
          <DialogFooter className="-mx-5 -mb-5 flex-row justify-end border-line bg-transparent p-5">
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
