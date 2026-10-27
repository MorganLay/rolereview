"use client";

import { ChevronDownIcon, ChevronUpIcon, XIcon } from "lucide-react";
import { useEffect, useId, useOptimistic, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { strings } from "@/copy/strings";
import { createSkillSchema, SKILL_LIMITS, zodFieldErrors } from "@/features/library/schemas";
import { addHidden, removeHidden } from "@/lib/undo-delete";
import { useUndoDelete } from "@/lib/use-undo-delete";

import { createSkill, deleteSkill, reorderSkill, updateSkill } from "../actions";
import {
  applySkillAction,
  categorySuggestions,
  groupSkills,
  hasDuplicateSkill,
  resolveCategory,
} from "../skill-state";
import type { LibrarySkill } from "../types";

type SkillListProps = {
  skills: LibrarySkill[];
};

type Editor = { mode: "add" } | { mode: "edit"; id: string };

const copy = strings.library.skills;

export function SkillList({ skills }: SkillListProps) {
  const [optimisticSkills, addOptimistic] = useOptimistic(skills, applySkillAction);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const { schedule } = useUndoDelete();
  const nameRef = useRef<HTMLInputElement>(null);
  const headingId = useId();
  const editorKey = editor?.mode === "edit" ? editor.id : (editor?.mode ?? "closed");

  useEffect(() => {
    if (editorKey === "closed") return;
    nameRef.current?.focus();
  }, [editorKey]);

  function closeEditor() {
    setEditor(null);
    setName("");
    setCategory("");
    setNameError(null);
    setCategoryError(null);
  }

  function beginAdd() {
    if (pending || editor) return;
    setEditor({ mode: "add" });
    setName("");
    setCategory("");
    setNameError(null);
    setCategoryError(null);
  }

  function beginEdit(skill: LibrarySkill) {
    if (pending || editor) return;
    setEditor({ mode: "edit", id: skill.id });
    setName(skill.name);
    setCategory(skill.category ?? "");
    setNameError(null);
    setCategoryError(null);
  }

  function commit() {
    if (!editor || pending) return;

    const parsed = createSkillSchema.safeParse({ name, category });
    if (!parsed.success) {
      const fields = zodFieldErrors(parsed.error);
      setNameError(fields.name?.[0] ?? null);
      setCategoryError(fields.category?.[0] ?? null);
      return;
    }

    const exceptId = editor.mode === "edit" ? editor.id : undefined;
    if (hasDuplicateSkill(skills, parsed.data.name, exceptId)) {
      setNameError(copy.duplicate);
      setCategoryError(null);
      return;
    }

    const resolved = resolveCategory(
      parsed.data.category,
      skills.map((skill) => skill.category),
    );
    const nextName = parsed.data.name;
    const categoryDraft = category;

    if (editor.mode === "edit") {
      const id = editor.id;
      const existing = skills.find((skill) => skill.id === id);
      if (
        existing &&
        existing.name === nextName &&
        (existing.category ?? null) === resolved
      ) {
        closeEditor();
        return;
      }

      closeEditor();
      startTransition(async () => {
        addOptimistic({ type: "update", id, name: nextName, category: resolved });
        const result = await updateSkill({
          id,
          name: nextName,
          category: categoryDraft,
        });
        if (!result.ok) {
          toast.error(result.error.fields?.name?.[0] ?? copy.saveFailed);
          setEditor({ mode: "edit", id });
          setName(nextName);
          setCategory(categoryDraft);
          setNameError(result.error.fields?.name?.[0] ?? null);
          setCategoryError(result.error.fields?.category?.[0] ?? null);
        }
      });
      return;
    }

    const tempId = crypto.randomUUID();
    closeEditor();
    startTransition(async () => {
      addOptimistic({
        type: "create",
        tempId,
        name: nextName,
        category: resolved,
      });
      const result = await createSkill({ name: nextName, category: categoryDraft });
      if (!result.ok) {
        toast.error(result.error.fields?.name?.[0] ?? copy.saveFailed);
        setEditor({ mode: "add" });
        setName(nextName);
        setCategory(categoryDraft);
        setNameError(result.error.fields?.name?.[0] ?? null);
        setCategoryError(result.error.fields?.category?.[0] ?? null);
      }
    });
  }

  function showSkill(id: string) {
    setHidden((current) => removeHidden(current, id));
  }

  function onDelete(id: string) {
    if (pending || editor || hidden.has(id)) return;
    setHidden((current) => addHidden(current, id));
    schedule({
      id,
      message: copy.deleted,
      restore: () => showSkill(id),
      commit: async () => {
        try {
          const result = await deleteSkill({ id });
          if (!result.ok) {
            toast.error(copy.deleteFailed);
            showSkill(id);
          }
        } catch {
          toast.error(copy.deleteFailed);
          showSkill(id);
        }
      },
    });
  }

  function onMove(id: string, direction: "up" | "down") {
    if (pending || editor) return;
    startTransition(async () => {
      addOptimistic({ type: "reorder", id, direction });
      const result = await reorderSkill({ id, direction });
      if (!result.ok) toast.error(copy.reorderFailed);
    });
  }

  const visibleSkills = optimisticSkills.filter((skill) => !hidden.has(skill.id));
  const groups = groupSkills(visibleSkills);
  const suggestions = categorySuggestions(skills);
  const busy = pending || editor !== null;
  const form = editor ? (
    <SkillForm
      name={name}
      category={category}
      nameError={nameError}
      categoryError={categoryError}
      suggestions={suggestions}
      pending={pending}
      nameRef={nameRef}
      onName={(value) => {
        setName(value);
        if (nameError) setNameError(null);
      }}
      onCategory={(value) => {
        setCategory(value);
        if (categoryError) setCategoryError(null);
      }}
      onSubmit={(event) => {
        event.preventDefault();
        commit();
      }}
      onCancel={closeEditor}
    />
  ) : null;

  return (
    <section className="grid gap-3" aria-labelledby={headingId}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={headingId} className="text-base font-medium text-ink">
          {copy.title}
        </h2>
        {editor?.mode === "add" ? null : (
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={beginAdd}>
            {copy.add}
          </Button>
        )}
      </div>

      {editor?.mode === "add" ? form : null}

      {visibleSkills.length === 0 ? (
        <p className="text-sm text-slate">{copy.noneYet}</p>
      ) : (
        <div className="grid gap-4">
          {groups.map((group) => (
            <div key={`group:${group.key}`} className="grid gap-2">
              <h3 className="text-sm font-medium text-slate">
                {group.label ?? copy.uncategorized}
              </h3>
              <ul className="flex flex-wrap gap-2">
                {group.skills.map((skill, index) =>
                  editor?.mode === "edit" && editor.id === skill.id ? (
                    <li key={skill.id} className="w-full basis-full">
                      {form}
                    </li>
                  ) : (
                    <li key={skill.id} className="max-w-full">
                      <SkillChip
                        skill={skill}
                        canMoveUp={index > 0}
                        canMoveDown={index < group.skills.length - 1}
                        disabled={busy}
                        onEdit={() => beginEdit(skill)}
                        onDelete={() => onDelete(skill.id)}
                        onMove={(direction) => onMove(skill.id, direction)}
                      />
                    </li>
                  ),
                )}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SkillChip({
  skill,
  canMoveUp,
  canMoveDown,
  disabled,
  onEdit,
  onDelete,
  onMove,
}: {
  skill: LibrarySkill;
  canMoveUp: boolean;
  canMoveDown: boolean;
  disabled: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (direction: "up" | "down") => void;
}) {
  return (
    <div className="inline-flex max-w-full items-center gap-0.5 rounded-full border border-line bg-secondary py-0.5 pr-0.5 pl-1">
      <button
        type="button"
        className="min-w-0 rounded-full px-2 py-1 text-left text-sm break-words text-secondary-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-60"
        onClick={onEdit}
        disabled={disabled}
      >
        <span className="sr-only">{copy.edit}: </span>
        {skill.name}
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="rounded-full"
        aria-label={`${copy.moveUp}: ${skill.name}`}
        disabled={disabled || !canMoveUp}
        onClick={() => onMove("up")}
      >
        <ChevronUpIcon aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="rounded-full"
        aria-label={`${copy.moveDown}: ${skill.name}`}
        disabled={disabled || !canMoveDown}
        onClick={() => onMove("down")}
      >
        <ChevronDownIcon aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="rounded-full"
        aria-label={`${copy.delete}: ${skill.name}`}
        disabled={disabled}
        onClick={onDelete}
      >
        <XIcon aria-hidden="true" />
      </Button>
    </div>
  );
}

function SkillForm({
  name,
  category,
  nameError,
  categoryError,
  suggestions,
  pending,
  nameRef,
  onName,
  onCategory,
  onSubmit,
  onCancel,
}: {
  name: string;
  category: string;
  nameError: string | null;
  categoryError: string | null;
  suggestions: readonly string[];
  pending: boolean;
  nameRef: React.RefObject<HTMLInputElement | null>;
  onName: (value: string) => void;
  onCategory: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  const nameId = useId();
  const categoryId = useId();
  const listId = useId();
  const nameErrorId = `${nameId}-error`;
  const categoryErrorId = `${categoryId}-error`;
  const countId = `${nameId}-count`;
  const hintId = `${categoryId}-hint`;

  return (
    <form
      onSubmit={onSubmit}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
      }}
      className="grid gap-3 rounded-lg border border-line p-3"
    >
      <div className="grid gap-1">
        <Label htmlFor={nameId}>{copy.name}</Label>
        <Input
          ref={nameRef}
          id={nameId}
          value={name}
          placeholder={copy.namePlaceholder}
          maxLength={SKILL_LIMITS.name}
          spellCheck={false}
          autoComplete="off"
          disabled={pending}
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? `${countId} ${nameErrorId}` : countId}
          onChange={(event) => onName(event.target.value)}
        />
        <p id={countId} className="text-xs text-slate">
          {copy.count(name.length, SKILL_LIMITS.name)}
        </p>
        {nameError ? (
          <p id={nameErrorId} className="text-sm text-destructive" role="alert">
            {nameError}
          </p>
        ) : null}
      </div>
      <div className="grid gap-1">
        <Label htmlFor={categoryId}>{copy.category}</Label>
        <Input
          id={categoryId}
          value={category}
          placeholder={copy.categoryPlaceholder}
          maxLength={SKILL_LIMITS.category}
          list={listId}
          spellCheck={false}
          disabled={pending}
          aria-invalid={categoryError ? true : undefined}
          aria-describedby={categoryError ? `${hintId} ${categoryErrorId}` : hintId}
          onChange={(event) => onCategory(event.target.value)}
        />
        <datalist id={listId}>
          {suggestions.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
        <p id={hintId} className="text-xs text-slate">
          {copy.categoryHint}
        </p>
        {categoryError ? (
          <p id={categoryErrorId} className="text-sm text-destructive" role="alert">
            {categoryError}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? copy.saving : copy.save}
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={onCancel}>
          {copy.cancel}
        </Button>
      </div>
    </form>
  );
}
