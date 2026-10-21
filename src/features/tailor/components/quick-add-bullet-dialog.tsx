"use client";

import Link from "next/link";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { strings } from "@/copy/strings";
import type { Requirement } from "@/features/jobs/schemas";
import { createBullet } from "@/features/library/actions";
import {
  BULLET_LIMITS,
  bulletTextSchema,
  ENTRY_KINDS,
} from "@/features/library/schemas";
import type { LibraryEntryOption } from "@/features/tailor/content";

const copy = strings.jobs.workspace;
const entryCopy = strings.library.entries;
const bulletCopy = strings.library.bullets;

export function QuickAddBulletDialog({
  requirement,
  entries,
  jobId,
  open,
  onOpenChange,
}: {
  requirement: Requirement | null;
  entries: readonly LibraryEntryOption[];
  jobId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const formId = useId();
  const [entryId, setEntryId] = useState("");
  const [draft, setDraft] = useState("");
  const [entryError, setEntryError] = useState<string | null>(null);
  const [textError, setTextError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const groups = ENTRY_KINDS.map((kind) => ({
    kind,
    label: entryCopy.kinds[kind].title,
    entries: entries.filter((entry) => entry.kind === kind),
  })).filter((group) => group.entries.length > 0);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving || saved) return;

    const parsed = bulletTextSchema.safeParse(draft);
    const missingEntry = entryId.length === 0;
    setEntryError(missingEntry ? copy.quickAddEntryError : null);
    setTextError(
      parsed.success ? null : (parsed.error.issues[0]?.message ?? bulletCopy.errors.text),
    );
    setFormError(null);
    if (missingEntry || !parsed.success) return;

    setSaving(true);
    let result: Awaited<ReturnType<typeof createBullet>>;
    try {
      result = await createBullet({ entryId, text: parsed.data });
    } catch {
      result = { ok: false, error: { code: "INTERNAL" } };
    }
    setSaving(false);

    if (!result.ok) {
      if (result.error.code === "VALIDATION") {
        setTextError(result.error.fields?.text?.[0] ?? null);
        setEntryError(result.error.fields?.entryId?.[0] ?? null);
        if (!result.error.fields?.text && !result.error.fields?.entryId) {
          setFormError(copy.quickAddFailed);
        }
      } else if (result.error.code === "NOT_FOUND") {
        setFormError(copy.quickAddMissingEntry);
      } else {
        setFormError(copy.quickAddFailed);
      }
      return;
    }

    setSaved(true);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {saved ? (
          <div className="grid gap-4">
            <DialogHeader className="pr-8">
              <DialogTitle className="font-sans">{copy.quickAddTitle}</DialogTitle>
              <DialogDescription className="break-words">{copy.quickAddSaved}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {strings.common.close}
              </Button>
              <Button asChild>
                <Link href={`/jobs/${jobId}?tab=documents`}>{copy.quickAddTailor}</Link>
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="grid gap-4">
            <DialogHeader className="pr-8">
              <DialogTitle className="font-sans">{copy.quickAddTitle}</DialogTitle>
              <DialogDescription className="break-words">
                {requirement ? copy.quickAddBody(requirement.text) : copy.quickAddTitle}
              </DialogDescription>
            </DialogHeader>
            {entries.length === 0 ? (
              <p className="text-sm text-slate">{copy.quickAddEmptyLibrary}</p>
            ) : (
              <>
                <div className="grid gap-2">
                  <Label htmlFor={`${formId}-entry`}>{copy.quickAddEntry}</Label>
                  <Select
                    value={entryId || undefined}
                    onValueChange={(value) => {
                      setEntryId(value);
                      if (entryError) setEntryError(null);
                    }}
                  >
                    <SelectTrigger
                      id={`${formId}-entry`}
                      className="w-full"
                      aria-invalid={entryError ? true : undefined}
                      aria-describedby={entryError ? `${formId}-entry-error` : undefined}
                    >
                      <SelectValue placeholder={copy.quickAddEntryPlaceholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map((group) => (
                        <SelectGroup key={group.kind}>
                          <SelectLabel>{group.label}</SelectLabel>
                          {group.entries.map((entry) => (
                            <SelectItem key={entry.id} value={entry.id}>
                              {entryLabel(entry)}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                  {entryError ? (
                    <p id={`${formId}-entry-error`} className="text-sm text-clay" role="alert">
                      {entryError}
                    </p>
                  ) : null}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={`${formId}-bullet`}>{copy.quickAddBullet}</Label>
                  <Textarea
                    id={`${formId}-bullet`}
                    value={draft}
                    maxLength={BULLET_LIMITS.text}
                    rows={3}
                    aria-invalid={textError ? true : undefined}
                    aria-describedby={
                      textError ? `${formId}-count ${formId}-bullet-error` : `${formId}-count`
                    }
                    onChange={(event) => {
                      setDraft(event.target.value);
                      if (textError) setTextError(null);
                    }}
                  />
                  <p id={`${formId}-count`} className="text-xs text-slate">
                    {copy.count(draft.length, BULLET_LIMITS.text)}
                  </p>
                  {textError ? (
                    <p id={`${formId}-bullet-error`} className="text-sm text-clay" role="alert">
                      {textError}
                    </p>
                  ) : null}
                </div>
              </>
            )}
            {formError ? (
              <p className="text-sm text-clay" role="alert">
                {formError}
              </p>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {strings.common.cancel}
              </Button>
              {entries.length > 0 ? (
                <Button type="submit" disabled={saving}>
                  {saving ? copy.saving : strings.common.save}
                </Button>
              ) : null}
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function entryLabel(entry: LibraryEntryOption): string {
  const title = entry.title.trim() || copy.untitled;
  const organization = entry.organization?.trim();
  return organization ? `${title} · ${organization}` : title;
}
