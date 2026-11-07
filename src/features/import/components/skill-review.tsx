"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { strings } from "@/copy/strings";
import { SKILL_LIMITS } from "@/features/library/schemas";
import type { FieldErrors } from "@/lib/result";
import { cn } from "@/lib/utils";

import { categoryChoices } from "../skill-categories";
import type { ReviewSkill } from "./review-form";

const copy = strings.library.import;
const skillCopy = strings.library.skills;

type SkillReviewProps = {
  formId: string;
  skills: ReviewSkill[];
  fields: FieldErrors;
  onChange: (key: string, patch: Partial<Pick<ReviewSkill, "included" | "name" | "category">>) => void;
};

export function SkillReview({ formId, skills, fields, onChange }: SkillReviewProps) {
  const options = categoryChoices(
    skills.map((skill) => skill.category),
    skillCopy.suggestions,
  );

  return (
    <section className="flex flex-col gap-3" aria-labelledby={`${formId}-skills`}>
      <div className="flex flex-col gap-1">
        <h2 id={`${formId}-skills`} className="text-base font-medium text-ink">
          {skillCopy.title}
        </h2>
        {skills.length === 0 ? (
          <p className="text-sm text-slate">{copy.noSkills}</p>
        ) : (
          <p id={`${formId}-skills-hint`} className="max-w-2xl text-sm text-slate">
            {copy.skillsReview}
          </p>
        )}
      </div>
      {skills.length > 0 ? (
        <div className="rounded-card border border-line bg-surface">
          <div className="hidden border-b border-line px-3 py-2 text-xs font-medium text-slate sm:grid sm:grid-cols-[2.75rem_minmax(0,1.4fr)_minmax(0,1fr)] sm:gap-x-3">
            <span>
              <span className="sr-only">{copy.include}</span>
            </span>
            <span className="px-2.5">{skillCopy.name}</span>
            <span className="px-2.5">{skillCopy.category}</span>
          </div>
          <ul>
            {skills.map((skill, index) => (
              <SkillRow
                key={skill.key}
                formId={formId}
                index={index}
                skill={skill}
                options={options}
                nameError={fields[`skills.${index}.name`]?.[0]}
                categoryError={fields[`skills.${index}.category`]?.[0]}
                onChange={(patch) => onChange(skill.key, patch)}
              />
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function SkillRow({
  formId,
  index,
  skill,
  options,
  nameError,
  categoryError,
  onChange,
}: {
  formId: string;
  index: number;
  skill: ReviewSkill;
  options: readonly string[];
  nameError?: string;
  categoryError?: string;
  onChange: (patch: Partial<Pick<ReviewSkill, "included" | "name" | "category">>) => void;
}) {
  const nameId = `${formId}-skill-${index}-name`;
  const categoryId = `${formId}-skill-${index}-category`;
  const includeId = `${formId}-skill-${index}-include`;

  return (
    <li className="border-b border-line last:border-b-0 focus-within:bg-paper hover:bg-paper">
      <div className="grid grid-cols-[2.75rem_minmax(0,1fr)] items-start gap-x-1 gap-y-2 px-2 py-2.5 sm:grid-cols-[2.75rem_minmax(0,1.4fr)_minmax(0,1fr)] sm:gap-x-3 sm:gap-y-0 sm:px-3 sm:py-1.5">
        <div className="col-start-1 row-start-1 mt-4 flex h-11 w-11 items-center justify-center sm:mt-0 sm:h-8">
          <Checkbox
            id={includeId}
            checked={skill.included}
            aria-label={`${copy.include} ${skill.name.trim() || skillCopy.name}`}
            onCheckedChange={(value) => onChange({ included: value === true })}
          />
        </div>
        <div className="col-start-2 row-start-1 min-w-0">
          <Label htmlFor={nameId} className="mb-1 text-xs font-medium text-slate sm:sr-only">
            {skillCopy.name}
          </Label>
          <Input
            id={nameId}
            value={skill.name}
            maxLength={SKILL_LIMITS.name}
            placeholder={skillCopy.namePlaceholder}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={Boolean(nameError)}
            aria-describedby={nameError ? `${nameId}-error` : undefined}
            onChange={(event) => onChange({ name: event.target.value })}
            className="h-11 sm:h-8"
          />
          {nameError ? (
            <p id={`${nameId}-error`} className="mt-1 text-sm text-destructive" role="alert">
              {nameError}
            </p>
          ) : null}
        </div>
        <div className="col-start-2 row-start-2 min-w-0 sm:col-start-3 sm:row-start-1">
          <Label htmlFor={categoryId} className="mb-1 text-xs font-medium text-slate sm:sr-only">
            {skillCopy.category}
          </Label>
          <CategoryField
            id={categoryId}
            value={skill.category}
            options={options}
            error={categoryError}
            onChange={(category) => onChange({ category })}
          />
        </div>
      </div>
    </li>
  );
}

function CategoryField({
  id,
  value,
  options,
  error,
  onChange,
}: {
  id: string;
  value: string;
  options: readonly string[];
  error?: string;
  onChange: (value: string) => void;
}) {
  const listId = useId();
  const anchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const openedValue = useRef(value);
  const customDraftRef = useRef("");
  const skipCustom = useRef(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [browsing, setBrowsing] = useState(false);
  const [customDraft, setCustomDraft] = useState("");
  const [panelWidth, setPanelWidth] = useState<number>();
  const safeActive = options.length === 0 ? 0 : Math.min(active, options.length - 1);
  const errorId = `${id}-error`;
  const customId = `${id}-custom`;

  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    const item = list?.querySelector<HTMLElement>(`[data-index="${safeActive}"]`);
    if (!list || !item) return;
    const top = item.offsetTop;
    const bottom = top + item.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight) {
      list.scrollTop = bottom - list.clientHeight;
    }
  }, [open, safeActive]);

  function measure() {
    const width = anchorRef.current?.getBoundingClientRect().width;
    if (width) setPanelWidth(width);
  }

  function openList() {
    openedValue.current = value;
    skipCustom.current = false;
    const trimmed = value.trim();
    const known = options.some((option) => option.toLowerCase() === trimmed.toLowerCase());
    const initial = known ? "" : value;
    customDraftRef.current = initial;
    setCustomDraft(initial);
    setBrowsing(false);
    const exact = options.indexOf(trimmed);
    setActive(exact >= 0 ? exact : 0);
    measure();
    setOpen(true);
  }

  function finishList(next: boolean) {
    if (!next && open && !skipCustom.current) {
      const draft = customDraftRef.current.trim();
      if (draft.length > 0) onChange(draft);
    }
    if (!next) skipCustom.current = false;
    setOpen(next);
  }

  function choose(option: string) {
    skipCustom.current = true;
    customDraftRef.current = "";
    onChange(option);
    setCustomDraft("");
    setBrowsing(false);
    setOpen(false);
  }

  function commitCustom() {
    const next = customDraftRef.current.trim();
    if (next.length === 0) {
      skipCustom.current = true;
      setOpen(false);
      return;
    }
    choose(next);
  }

  function cancelList() {
    skipCustom.current = true;
    const restored = openedValue.current;
    const trimmed = restored.trim();
    const known = options.some((option) => option.toLowerCase() === trimmed.toLowerCase());
    const initial = known ? "" : restored;
    customDraftRef.current = initial;
    setCustomDraft(initial);
    onChange(restored);
    setBrowsing(false);
    setOpen(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        openList();
        return;
      }
      if (options.length === 0) return;
      setBrowsing(true);
      setActive((current) => Math.min(options.length - 1, current + 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openList();
        return;
      }
      if (options.length === 0) return;
      setBrowsing(true);
      setActive((current) => Math.max(0, current - 1));
      return;
    }
    if (event.key === "Home" && open) {
      event.preventDefault();
      if (options.length === 0) return;
      setBrowsing(true);
      setActive(0);
      return;
    }
    if (event.key === "End" && open) {
      event.preventDefault();
      if (options.length === 0) return;
      setBrowsing(true);
      setActive(Math.max(0, options.length - 1));
      return;
    }
    if (event.key === "Enter" && open) {
      event.preventDefault();
      if (browsing) {
        const option = options[safeActive];
        if (option) choose(option);
        else setOpen(false);
        return;
      }
      const next = value.trim();
      if (next.length === 0) {
        setOpen(false);
        return;
      }
      onChange(next);
      skipCustom.current = true;
      customDraftRef.current = next;
      setCustomDraft(next);
      setOpen(false);
      return;
    }
    if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      cancelList();
      return;
    }
    if (event.key === "Tab") finishList(false);
  }

  return (
    <div className="min-w-0">
      <Popover open={open} onOpenChange={finishList}>
        <PopoverAnchor asChild>
          <div ref={anchorRef} className="relative min-w-0">
            <Input
              ref={inputRef}
              id={id}
              role="combobox"
              value={value}
              maxLength={SKILL_LIMITS.category}
              placeholder={skillCopy.categoryPlaceholder}
              spellCheck={false}
              autoComplete="off"
              aria-autocomplete="list"
              aria-expanded={open}
              aria-controls={listId}
              aria-haspopup="listbox"
              aria-activedescendant={
                open && options.length > 0 ? `${listId}-${safeActive}` : undefined
              }
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
              onChange={(event) => {
                setBrowsing(false);
                customDraftRef.current = event.target.value;
                setCustomDraft(event.target.value);
                onChange(event.target.value);
              }}
              onKeyDown={onKeyDown}
              className="h-11 pr-10 sm:h-8"
            />
            <button
              type="button"
              tabIndex={-1}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate"
              aria-label={copy.showCategories}
              aria-expanded={open}
              aria-controls={listId}
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onClick={() => {
                inputRef.current?.focus();
                if (open) {
                  finishList(false);
                  return;
                }
                openList();
              }}
            >
              <ChevronDown
                className={cn(
                  "size-4 transition-transform motion-reduce:transition-none",
                  open && "rotate-180",
                )}
                aria-hidden
              />
            </button>
          </div>
        </PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={4}
        collisionPadding={12}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        style={{ width: panelWidth }}
        className="w-auto max-w-[calc(100vw-2rem)] gap-0 p-1"
      >
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={copy.categoryList}
          className="relative max-h-60 overflow-y-auto"
        >
          {options.map((option, index) => {
            const selected = option === value.trim();
            const current = index === safeActive;
            return (
              <li key={option}>
                <div
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={selected}
                  data-index={index}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-left text-sm break-words text-ink sm:min-h-9",
                    current && "bg-pine-50",
                  )}
                  onMouseEnter={() => setActive(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(option)}
                >
                  <span className="min-w-0 flex-1">{option}</span>
                  {selected ? <Check className="size-4 shrink-0 text-pine" aria-hidden /> : null}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="mt-1 border-t border-line px-1 pt-2 pb-1">
          <Label htmlFor={customId} className="px-1 text-xs font-medium text-slate">
            {copy.customCategory}
          </Label>
          <Input
            id={customId}
            value={customDraft}
            maxLength={SKILL_LIMITS.category}
            placeholder={copy.customCategoryPlaceholder}
            spellCheck={false}
            autoComplete="off"
            onChange={(event) => {
              setBrowsing(false);
              customDraftRef.current = event.target.value;
              setCustomDraft(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.stopPropagation();
                commitCustom();
              } else if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                cancelList();
              }
            }}
            className="mt-1 h-11 sm:h-8"
          />
        </div>
      </PopoverContent>
      </Popover>
      {error ? (
        <p id={errorId} className="mt-1 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
