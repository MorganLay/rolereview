"use client";

import { useEffect, useId, useOptimistic, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { strings } from "@/copy/strings";
import { BULLET_LIMITS, bulletTextSchema } from "@/features/library/schemas";

import { createBullet, deleteBullet, reorderBullet, updateBullet } from "../actions";
import { applyBulletAction } from "../bullet-state";
import type { LibraryBullet } from "../types";

type BulletListProps = {
  entryId: string;
  bullets: LibraryBullet[];
};

const copy = strings.library.bullets;

export function BulletList({ entryId, bullets }: BulletListProps) {
  const [optimisticBullets, addOptimistic] = useOptimistic(bullets, applyBulletAction);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const skipBlur = useRef(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    editorRef.current?.focus();
  }, [editingId, adding]);

  function beginEdit(bullet: LibraryBullet) {
    if (pending || adding || editingId) return;
    skipBlur.current = false;
    setEditingId(bullet.id);
    setDraft(bullet.text);
    setFieldError(null);
  }

  function beginAdd() {
    if (pending || adding || editingId) return;
    skipBlur.current = false;
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

  function onDelete(id: string) {
    if (pending || editingId || adding) return;
    startTransition(async () => {
      addOptimistic({ type: "delete", id });
      const result = await deleteBullet({ id });
      if (!result.ok) toast.error(copy.deleteFailed);
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

  return (
    <div className="mt-3 grid gap-2">
      {optimisticBullets.length > 0 ? (
        <ul className="grid gap-2">
          {optimisticBullets.map((bullet, index) => (
            <li key={bullet.id} className="grid gap-1">
              {editingId === bullet.id ? (
                <BulletEditor
                  draft={draft}
                  fieldError={fieldError}
                  editorRef={editorRef}
                  onDraft={setDraft}
                  onClearError={() => setFieldError(null)}
                  onKeyDown={onKeyDown}
                  onBlur={onBlur}
                />
              ) : (
                <button
                  type="button"
                  className="w-full rounded-md px-2 py-1 text-left text-sm whitespace-pre-wrap text-ink hover:bg-pine-50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-60"
                  onClick={() => beginEdit(bullet)}
                  disabled={pending || showEditor}
                >
                  <span className="sr-only">{copy.edit}: </span>
                  {bullet.text}
                </button>
              )}
              {editingId === bullet.id ? null : (
                <div className="flex flex-wrap gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`${copy.moveUpLabel}: ${bullet.text}`}
                    disabled={pending || showEditor || index === 0}
                    onClick={() => onMove(bullet.id, "up")}
                  >
                    {copy.moveUp}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`${copy.moveDownLabel}: ${bullet.text}`}
                    disabled={
                      pending || showEditor || index === optimisticBullets.length - 1
                    }
                    onClick={() => onMove(bullet.id, "down")}
                  >
                    {copy.moveDown}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`${copy.delete}: ${bullet.text}`}
                    disabled={pending || showEditor}
                    onClick={() => onDelete(bullet.id)}
                  >
                    {copy.delete}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {adding ? (
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
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
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
        rows={2}
        className="min-h-12 text-sm"
        aria-invalid={fieldError ? true : undefined}
        aria-describedby={fieldError ? `${countId} ${errorId}` : countId}
        onChange={(event) => {
          onDraft(event.target.value);
          if (fieldError) onClearError();
        }}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
      />
      <p id={countId} className="text-xs text-slate">
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
