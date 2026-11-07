"use client";

import { useId, type Dispatch, type SetStateAction } from "react";
import { TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { strings } from "@/copy/strings";
import { BULLET_LIMITS } from "@/features/library/schemas";

import { bulletsBlockingQuickSave, firstImportCounts } from "../confirm";
import type { ReviewBullet, ReviewDraft } from "./review-form";

const copy = strings.library.import;
const bulletCopy = strings.library.bullets;

type ImportConfirmProps = {
  draft: ReviewDraft;
  setDraft: Dispatch<SetStateAction<ReviewDraft>>;
  email: string;
  pending: boolean;
  formError: string | null;
  onSave: () => void;
  onReview: () => void;
  onStartOver: () => void;
};

export function ImportConfirm({
  draft,
  setDraft,
  email,
  pending,
  formError,
  onSave,
  onReview,
  onStartOver,
}: ImportConfirmProps) {
  const formId = useId();
  const counts = firstImportCounts(draft);
  const blocking = bulletsBlockingQuickSave(draft);
  const resumeEmail = draft.resumeEmail?.trim() ?? "";
  const emailDiffers =
    resumeEmail.length > 0 && resumeEmail.toLowerCase() !== email.trim().toLowerCase();
  const canSave = blocking.length === 0 && !pending;

  function patchBullet(
    entryIndex: number,
    bulletIndex: number,
    patch: Partial<ReviewBullet>,
  ) {
    setDraft((current) => ({
      ...current,
      entries: current.entries.map((entry, index) => {
        if (index !== entryIndex) return entry;
        return {
          ...entry,
          bullets: entry.bullets.map((bullet, indexInEntry) =>
            indexInEntry === bulletIndex ? { ...bullet, ...patch } : bullet,
          ),
        };
      }),
    }));
  }

  return (
    <section className="rounded-card border border-line bg-surface p-4 sm:p-5">
      {counts.length > 0 ? (
        <ul className="flex flex-wrap justify-around gap-x-6 gap-y-4" aria-label={copy.confirmCounts}>
          {counts.map((item) => (
            <li key={item.id} className="min-w-24 text-center">
              <p className="text-3xl font-semibold text-ink tabular-nums">{item.count}</p>
              <p className="text-sm text-slate">{item.label}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink">{copy.confirmEmpty}</p>
      )}

      {draft.warnings.length > 0 ? (
        <div
          className="mt-5 flex gap-3 rounded-lg bg-marigold-100 px-4 py-3"
          aria-labelledby={`${formId}-warnings`}
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-marigold-700" aria-hidden />
          <div className="min-w-0">
            <h2 id={`${formId}-warnings`} className="text-sm font-medium text-ink">
              {copy.warningsTitle}
            </h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink">
              {draft.warnings.map((warning, index) => (
                <li key={`${index}-${warning}`}>{warning}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {blocking.length > 0 ? (
        <div className="mt-5 grid gap-4" aria-labelledby={`${formId}-long`}>
          <div>
            <h2 id={`${formId}-long`} className="text-sm font-medium text-ink">
              {copy.confirmLongTitle}
            </h2>
            <p className="mt-1 text-sm text-slate">{copy.confirmLongHint}</p>
          </div>
          {blocking.map((bullet) => {
            const fieldId = `${formId}-bullet-${bullet.entryIndex}-${bullet.bulletIndex}`;
            const label =
              bullet.title.length > 0
                ? copy.confirmBullet(bullet.title)
                : copy.confirmBulletUntitled;
            return (
              <div key={fieldId} className="grid gap-1.5">
                <Label htmlFor={fieldId}>{label}</Label>
                <Textarea
                  id={fieldId}
                  value={bullet.text}
                  aria-describedby={`${fieldId}-count`}
                  onChange={(event) =>
                    patchBullet(bullet.entryIndex, bullet.bulletIndex, {
                      text: event.target.value,
                    })
                  }
                  className="min-h-24"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p id={`${fieldId}-count`} className="text-sm text-slate tabular-nums">
                    {bulletCopy.count(bullet.text.trim().length, BULLET_LIMITS.text)}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    disabled={pending}
                    onClick={() =>
                      patchBullet(bullet.entryIndex, bullet.bulletIndex, {
                        included: false,
                      })
                    }
                  >
                    {copy.leaveOut}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <p className="mt-5 text-sm text-slate">{copy.confirmNote}</p>
      {emailDiffers ? (
        <p className="mt-2 text-sm text-slate">{copy.emailDiffers(resumeEmail)}</p>
      ) : null}
      {formError ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {formError}
        </p>
      ) : null}

      <div className="mt-5 flex flex-col gap-2">
        <Button
          type="button"
          className="min-h-11 w-full"
          disabled={!canSave}
          onClick={onSave}
        >
          {pending ? copy.saving : copy.save}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full"
          disabled={pending}
          onClick={onReview}
        >
          {copy.reviewFirst}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 w-full"
          disabled={pending}
          onClick={onStartOver}
        >
          {copy.startOver}
        </Button>
      </div>
    </section>
  );
}
