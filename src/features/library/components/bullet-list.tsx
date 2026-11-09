"use client";

import { ChevronDownIcon, ChevronUpIcon, Trash2Icon } from "lucide-react";
import { useEffect, useId, useOptimistic, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { RowActions } from "@/components/row-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { strings } from "@/copy/strings";
import { BULLET_LIMITS, bulletTextSchema } from "@/features/library/schemas";
import { addHidden, removeHidden } from "@/lib/undo-delete";
import { useUndoDelete } from "@/lib/use-undo-delete";
import { cn } from "@/lib/utils";

import { createBullet, deleteBullet, reorderBullet, updateBullet } from "../actions";
import { applyBulletAction } from "../bullet-state";
import { bulletOpportunity } from "../opportunity";
import { bulletRole, bulletStrength } from "../strength";
import type { LibraryBullet } from "../types";
import type { WordingView } from "../wording";
import { BulletAssist } from "./bullet-assist";
import { StrengthMeter } from "./strength-meter";

type BulletListProps = {
  entryId: string;
  entryKind: string;
  bullets: LibraryBullet[];
  skills: readonly string[];
  wordings: readonly WordingView[];
  focusBulletIds?: readonly string[];
};

const copy = strings.library.bullets;

export function BulletList({
  entryId,
  entryKind,
  bullets,
  skills,
  wordings,
  focusBulletIds,
}: BulletListProps) {
  const [optimisticBullets, addOptimistic] = useOptimistic(bullets, applyBulletAction);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [assistId, setAssistId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const { schedule } = useUndoDelete();
  const skipBlur = useRef(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    editorRef.current?.focus();
  }, [editingId, adding]);

  function beginEdit(bullet: LibraryBullet) {
    if (pending || adding || editingId) return;
    skipBlur.current = false;
    setAssistId(null);
    setEditingId(bullet.id);
    setDraft(bullet.text);
    setFieldError(null);
  }

  function beginAdd() {
    if (pending || adding || editingId) return;
    skipBlur.current = false;
    setAssistId(null);
    setAdding(true);
    setDraft("");
    setFieldError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setAdding(false);
    setDraft("");
    setFieldError(null);
  }

  function commitDraft(fromBlur: boolean) {
    const parsed = bulletTextSchema.safeParse(draft);
    if (!parsed.success) {
      if (adding && draft.trim().length === 0) {
        if (!fromBlur) skipBlur.current = true;
        cancelEdit();
        return;
      }
      setFieldError(parsed.error.issues[0]?.message ?? copy.errors.text);
      return;
    }

    const text = parsed.data;
    if (!fromBlur) skipBlur.current = true;

    if (adding) {
      const tempId = crypto.randomUUID();
      setAdding(false);
      setDraft("");
      setFieldError(null);
      startTransition(async () => {
        addOptimistic({ type: "create", tempId, text });
        const result = await createBullet({ entryId, text });
        if (!result.ok) {
          toast.error(copy.saveFailed);
          skipBlur.current = false;
          setAdding(true);
          setDraft(text);
        }
      });
      return;
    }

    if (!editingId) return;
    const existing = bullets.find((bullet) => bullet.id === editingId);
    const id = editingId;
    setEditingId(null);
    setDraft("");
    setFieldError(null);
    if (existing && existing.text === text) return;

    startTransition(async () => {
      addOptimistic({ type: "update", id, text });
      const result = await updateBullet({ id, text });
      if (!result.ok) {
        toast.error(copy.saveFailed);
        skipBlur.current = false;
        setEditingId(id);
        setDraft(text);
      }
    });
  }

  function showBullet(id: string) {
    setHidden((current) => removeHidden(current, id));
  }

  function onDelete(id: string) {
    if (pending || editingId || adding || hidden.has(id)) return;
    setHidden((current) => addHidden(current, id));
    schedule({
      id,
      message: copy.deleted,
      restore: () => showBullet(id),
      commit: async () => {
        try {
          const result = await deleteBullet({ id });
          if (!result.ok) {
            toast.error(copy.deleteFailed);
            showBullet(id);
          }
        } catch {
          toast.error(copy.deleteFailed);
          showBullet(id);
        }
      },
    });
  }

  function onMove(id: string, direction: "up" | "down") {
    if (pending || editingId || adding) return;
    startTransition(async () => {
      addOptimistic({ type: "reorder", id, direction });
      const result = await reorderBullet({ id, direction });
      if (!result.ok) toast.error(copy.reorderFailed);
    });
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      skipBlur.current = true;
      cancelEdit();
      return;
    }
    if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault();
      commitDraft(false);
    }
  }

  function onBlur() {
    if (skipBlur.current) {
      skipBlur.current = false;
      return;
    }
    commitDraft(true);
  }

  const showEditor = adding || editingId !== null;
  const visibleBullets = optimisticBullets.filter((bullet) => !hidden.has(bullet.id));

  const focusSet = focusBulletIds ? new Set(focusBulletIds) : null;

  return (
    <div className="grid gap-0">
      {visibleBullets.length > 0 ? (
        <ul className="divide-y divide-line/60">
          {visibleBullets.map((bullet, index) => {
            const role = bulletRole(entryKind, bullet.text);
            const strength = bulletStrength(bullet.text, skills, role);
            const opportunity = bulletOpportunity(strength, role);
            const isEditing = editingId === bullet.id;
            const isAssisting = assistId === bullet.id;
            const isFocused = focusSet?.has(bullet.id) ?? false;
            const dimmed = focusSet !== null && !isFocused;

            return (
              <li
                key={bullet.id}
                id={`bullet-${bullet.id}`}
                className={cn(
                  "group/bullet -mx-1 rounded-md px-1 transition-colors",
                  isFocused && "bg-pine-50/50",
                  dimmed && "opacity-45",
                  (isEditing || isAssisting) && "bg-pine-50/70 ring-1 ring-pine/15",
                )}
              >
                {isEditing ? (
                  <div className="py-3">
                    <BulletEditor
                      draft={draft}
                      fieldError={fieldError}
                      editorRef={editorRef}
                      onDraft={setDraft}
                      onClearError={() => setFieldError(null)}
                      onKeyDown={onKeyDown}
                      onBlur={onBlur}
                    />
                  </div>
                ) : (
                  <div className="flex min-w-0 flex-col gap-1.5 py-3">
                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <button
                        type="button"
                        className="min-w-0 max-w-prose rounded-md px-1 py-0.5 text-left text-[0.90625rem] leading-[1.55] break-words whitespace-pre-wrap text-ink transition-colors hover:bg-pine-50/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-60 sm:flex-1"
                        onClick={() => beginEdit(bullet)}
                        disabled={pending || showEditor}
                      >
                        <span className="sr-only">{copy.edit}: </span>
                        {bullet.text}
                      </button>
                      <div className="flex w-full shrink-0 items-center justify-between gap-1 sm:ml-auto sm:w-[9.5rem] sm:justify-end">
                        <StrengthMeter text={bullet.text} skills={skills} role={role} />
                        <RowActions
                          layout="menu"
                          menuLabel={copy.actionsLabel(bullet.text)}
                          actions={[
                            {
                              id: "up",
                              label: copy.moveUp,
                              ariaLabel: `${copy.moveUpLabel}: ${bullet.text}`,
                              icon: ChevronUpIcon,
                              disabled: pending || showEditor || index === 0,
                              onSelect: () => onMove(bullet.id, "up"),
                            },
                            {
                              id: "down",
                              label: copy.moveDown,
                              ariaLabel: `${copy.moveDownLabel}: ${bullet.text}`,
                              icon: ChevronDownIcon,
                              disabled:
                                pending ||
                                showEditor ||
                                index === visibleBullets.length - 1,
                              onSelect: () => onMove(bullet.id, "down"),
                            },
                            {
                              id: "delete",
                              label: copy.delete,
                              ariaLabel: `${copy.delete}: ${bullet.text}`,
                              icon: Trash2Icon,
                              destructive: true,
                              disabled: pending || showEditor,
                              onSelect: () => onDelete(bullet.id),
                            },
                          ]}
                        />
                      </div>
                    </div>
                    <div className="pl-1">
                      <BulletAssist
                        bulletId={bullet.id}
                        text={bullet.text}
                        wordings={wordings}
                        improveKind={opportunity.kind}
                        diagnosis={opportunity.diagnosis}
                        active={isAssisting}
                        onOpen={() => setAssistId(bullet.id)}
                        onClose={() => setAssistId(null)}
                      />
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}

      {adding ? (
        <div className="pt-3">
          <BulletEditor
            draft={draft}
            fieldError={fieldError}
            editorRef={editorRef}
            placeholder={copy.placeholder}
            onDraft={setDraft}
            onClearError={() => setFieldError(null)}
            onKeyDown={onKeyDown}
            onBlur={onBlur}
          />
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3 w-fit"
          disabled={pending || editingId !== null}
          onClick={beginAdd}
        >
          {copy.add}
        </Button>
      )}
    </div>
  );
}

function BulletEditor({
  draft,
  fieldError,
  editorRef,
  placeholder,
  onDraft,
  onClearError,
  onKeyDown,
  onBlur,
}: {
  draft: string;
  fieldError: string | null;
  editorRef: React.RefObject<HTMLTextAreaElement | null>;
  placeholder?: string;
  onDraft: (value: string) => void;
  onClearError: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onBlur: () => void;
}) {
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const countId = `${fieldId}-count`;

  return (
    <div className="grid gap-1">
      <Label htmlFor={fieldId} className="sr-only">
        {copy.label}
      </Label>
      <Textarea
        ref={editorRef}
        id={fieldId}
        value={draft}
        placeholder={placeholder}
        maxLength={BULLET_LIMITS.text}
        rows={3}
        className="min-h-16 max-w-prose text-[0.90625rem] leading-relaxed"
        aria-invalid={fieldError ? true : undefined}
        aria-describedby={fieldError ? `${countId} ${errorId}` : countId}
        onChange={(event) => {
          onDraft(event.target.value);
          if (fieldError) onClearError();
        }}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
      />
      <p id={countId} className="text-[0.75rem] text-slate">
        {copy.count(draft.length, BULLET_LIMITS.text)}
      </p>
      {fieldError ? (
        <p id={errorId} className="text-sm text-destructive" role="alert">
          {fieldError}
        </p>
      ) : null}
    </div>
  );
}
