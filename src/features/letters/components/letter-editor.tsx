"use client";

import { ArrowLeftIcon, InfoIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { strings } from "@/copy/strings";
import { resumeTemplateLabel } from "@/features/tailor/template-label";
import {
  SubmittedVersionBanner,
  VersionNameField,
} from "@/features/tailor/components/version-chrome";
import type { ResumeTemplateId } from "@/lib/pdf/template";
import { cn } from "@/lib/utils";

import { saveLetterContent } from "../actions";
import { formatSavedTime, type LetterWorkspaceData } from "../content";
import { letterWordCount } from "../plainText";
import {
  LETTER_LIMITS,
  type CoverLetterContent,
  type LetterParagraph,
} from "../schemas";
import { letterSourceChips } from "../sources";
import { LetterExportBar, useLetterExport } from "./letter-export-bar";

const SAVE_DELAY_MS = 1500;

const copy = strings.jobs.workspace;
const letterCopy = strings.jobs.letters;
type Phase = "saving" | "saved" | "error";

export function LetterEditor({ workspace }: { workspace: LetterWorkspaceData }) {
  const router = useRouter();
  const [content, setContent] = useState(workspace.content);
  const [frozen, setFrozen] = useState(workspace.frozen);
  const [phase, setPhase] = useState<Phase>("saved");
  const [savedAt, setSavedAt] = useState(workspace.savedAt);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [tab, setTab] = useState<"letter" | "details" | "export">("letter");
  const contentRef = useRef(workspace.content);
  const savedRef = useRef(workspace.content);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistRef = useRef<() => Promise<void>>(async () => {});
  const inFlight = useRef(false);
  const queued = useRef(false);
  const serverDrift = useRef(false);
  const unmounted = useRef(false);
  const skipBlur = useRef(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const exportUi = useLetterExport({
    jobId: workspace.jobId,
    letterId: workspace.letterId,
    templateId: workspace.templateId,
    submitted: workspace.submitted,
    frozen,
    onSubmitted: () => {
      setFrozen(true);
      router.refresh();
    },
    rating: workspace.rating,
    templates: workspace.templates,
    content,
  });
  const templateId = exportUi.barProps.templateId;
  const savedLabel = copy.saved(formatSavedTime(savedAt, workspace.timeZone));

  async function persist() {
    if (frozen) return;
    if (inFlight.current) {
      queued.current = true;
      return;
    }
    if (!serverDrift.current && jsonEqual(contentRef.current, savedRef.current)) {
      if (!unmounted.current) setPhase("saved");
      return;
    }

    inFlight.current = true;
    const payload = contentRef.current;
    if (!unmounted.current) setPhase("saving");

    let result: Awaited<ReturnType<typeof saveLetterContent>>;
    try {
      result = await saveLetterContent({
        jobId: workspace.jobId,
        letterId: workspace.letterId,
        content: payload,
      });
    } catch {
      result = { ok: false, error: { code: "INTERNAL" } };
    }
    inFlight.current = false;

    const newer = contentRef.current !== payload || queued.current;
    queued.current = false;
    if (newer) {
      if (result.ok && !jsonEqual(payload, savedRef.current)) serverDrift.current = true;
      if (unmounted.current) await persist();
      else schedule();
      return;
    }
    if (unmounted.current) return;
    if (!result.ok) {
      if (result.error.code === "CONFLICT") toast.error(copy.frozenSave);
      setPhase("error");
      return;
    }

    serverDrift.current = false;
    contentRef.current = result.data.content;
    savedRef.current = result.data.content;
    setContent(result.data.content);
    setSavedAt(result.data.savedAt);
    setPhase("saved");
  }

  function schedule() {
    if (frozen || unmounted.current) return;
    setPhase("saving");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void persist();
    }, SAVE_DELAY_MS);
  }

  useEffect(() => {
    persistRef.current = persist;
  });

  useEffect(() => {
    return () => {
      unmounted.current = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        void persistRef.current();
      } else if (inFlight.current) {
        queued.current = true;
      }
    };
  }, []);

  useEffect(() => {
    if (!editingId) return;
    editorRef.current?.focus();
  }, [editingId]);

  function onTab(value: string) {
    if (value === "letter" || value === "details" || value === "export") setTab(value);
  }

  function updateContent(recipe: (current: CoverLetterContent) => CoverLetterContent) {
    if (frozen) return;
    const next = recipe(contentRef.current);
    contentRef.current = next;
    setContent(next);
    schedule();
  }

  function retry() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    void persist();
  }

  function beginEdit(paragraph: LetterParagraph) {
    if (frozen || editingId) return;
    skipBlur.current = false;
    setEditingId(paragraph.id);
    setDraft(paragraph.text);
    setFieldError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft("");
    setFieldError(null);
  }

  function commitEdit(paragraphId: string, fromBlur: boolean) {
    const text = draft.replace(/\s+/g, " ").trim();
    if (text.length === 0) {
      setFieldError(letterCopy.paragraphEmpty);
      return;
    }
    if (text.length > LETTER_LIMITS.paragraph) {
      setFieldError(letterCopy.paragraphEmpty);
      return;
    }
    if (!fromBlur) skipBlur.current = true;
    const current = contentRef.current.paragraphs.find((item) => item.id === paragraphId)
      ?.text;
    cancelEdit();
    if (current === text) return;
    updateContent((currentContent) => ({
      ...currentContent,
      paragraphs: currentContent.paragraphs.map((item) =>
        item.id === paragraphId ? { ...item, text } : item,
      ),
    }));
  }

  function onEditKeyDown(
    event: React.KeyboardEvent<HTMLTextAreaElement>,
    paragraphId: string,
  ) {
    if (event.key === "Escape") {
      event.preventDefault();
      skipBlur.current = true;
      cancelEdit();
      return;
    }
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      commitEdit(paragraphId, false);
    }
  }

  function onEditBlur(paragraphId: string) {
    if (skipBlur.current) {
      skipBlur.current = false;
      return;
    }
    commitEdit(paragraphId, true);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link
            href={`/jobs/${workspace.jobId}?tab=documents`}
            className="inline-flex items-center gap-1 rounded-md text-sm text-pine underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <ArrowLeftIcon aria-hidden className="size-4" />
            {copy.back}
          </Link>
          <p aria-live="polite" className="text-sm text-slate">
            {phase === "error" ? (
              <button
                type="button"
                className="text-destructive underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                onClick={retry}
              >
                {copy.saveFailed}
              </button>
            ) : phase === "saving" ? (
              copy.saving
            ) : (
              savedLabel
            )}
          </p>
          <div className="ml-auto hidden lg:flex">
            <LetterExportBar {...exportUi.barProps} />
          </div>
        </div>
        <VersionNameField
          kind="letter"
          jobId={workspace.jobId}
          documentId={workspace.letterId}
          label={workspace.label}
          placeholder={workspace.title}
        />
        {frozen && workspace.submittedOn ? (
          <SubmittedVersionBanner
            kind="letter"
            jobId={workspace.jobId}
            documentId={workspace.letterId}
            submittedOn={workspace.submittedOn}
          />
        ) : null}
        <h1 className="font-serif text-2xl font-semibold tracking-tight break-words text-ink md:text-3xl">
          {workspace.jobTitle}
        </h1>
        <p className="text-sm text-slate">{workspace.company}</p>
        <p className="text-sm text-slate">
          {letterCopy.templateLook(resumeTemplateLabel(templateId))}
        </p>
      </div>

      <div className="min-w-0 overflow-x-auto lg:hidden">
        <Tabs value={tab} onValueChange={onTab}>
          <TabsList aria-label={letterCopy.tabsLabel}>
            <TabsTrigger value="letter">{letterCopy.letterTab}</TabsTrigger>
            <TabsTrigger value="details">{letterCopy.detailsTab}</TabsTrigger>
            <TabsTrigger value="export">{letterCopy.exportTab}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {tab === "export" ? (
        <div className="flex max-w-lg flex-col items-start gap-3 lg:hidden">
          <p className="text-sm text-slate">{letterCopy.exportBody}</p>
          <LetterExportBar {...exportUi.barProps} />
        </div>
      ) : null}

      <div className="lg:grid lg:grid-cols-5 lg:items-start lg:gap-8">
        <div
          className={cn(
            "flex flex-col",
            templateId === "compact" ? "gap-4" : "gap-6",
            "lg:col-span-3",
            tab !== "letter" && "max-lg:hidden",
          )}
        >
          <LineField
            id="letter-greeting"
            label={letterCopy.greeting}
            value={content.greeting}
            max={LETTER_LIMITS.greeting}
            rows={2}
            templateId={templateId}
            readOnly={frozen}
            onChange={(greeting) =>
              updateContent((current) => ({ ...current, greeting }))
            }
          />

          <ol className="grid gap-4">
            {content.paragraphs.map((paragraph, index) => (
              <ParagraphRow
                key={paragraph.id}
                index={index + 1}
                paragraph={paragraph}
                snapshot={workspace.snapshot}
                editing={editingId === paragraph.id}
                readOnly={frozen}
                draft={draft}
                fieldError={fieldError}
                editorRef={editorRef}
                templateId={templateId}
                onDraft={(value) => {
                  setDraft(value);
                  if (fieldError) setFieldError(null);
                }}
                onIncluded={(included) =>
                  updateContent((current) => ({
                    ...current,
                    paragraphs: current.paragraphs.map((item) =>
                      item.id === paragraph.id ? { ...item, included } : item,
                    ),
                  }))
                }
                onBeginEdit={() => beginEdit(paragraph)}
                onEditKeyDown={(event) => onEditKeyDown(event, paragraph.id)}
                onEditBlur={() => onEditBlur(paragraph.id)}
              />
            ))}
          </ol>

          <LineField
            id="letter-closing"
            label={letterCopy.closing}
            value={content.closing}
            max={LETTER_LIMITS.closing}
            rows={1}
            templateId={templateId}
            readOnly={frozen}
            onChange={(closing) =>
              updateContent((current) => ({ ...current, closing }))
            }
          />
          <LineField
            id="letter-signature"
            label={letterCopy.signature}
            value={content.signature}
            max={LETTER_LIMITS.signature}
            rows={1}
            templateId={templateId}
            readOnly={frozen}
            onChange={(signature) =>
              updateContent((current) => ({ ...current, signature }))
            }
          />
        </div>

        <aside
          aria-label={letterCopy.panelLabel}
          className={cn(
            "lg:sticky lg:top-20 lg:col-span-2 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto",
            tab !== "details" && "max-lg:hidden",
          )}
        >
          <LetterDetails
            content={content}
            tone={workspace.tone}
            requirements={workspace.requirements}
          />
        </aside>
      </div>
    </div>
  );
}

function LineField({
  id,
  label,
  value,
  max,
  rows,
  templateId,
  readOnly,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  max: number;
  rows: number;
  templateId: ResumeTemplateId;
  readOnly: boolean;
  onChange: (value: string) => void;
}) {
  const countId = `${id}-count`;
  return (
    <section className="grid gap-2" aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`} className={sectionHeading(templateId)}>
        {label}
      </h2>
      <Textarea
        id={id}
        value={value}
        maxLength={max}
        rows={rows}
        aria-labelledby={`${id}-heading`}
        aria-describedby={countId}
        readOnly={readOnly}
        className="text-sm"
        onChange={(event) => onChange(event.target.value)}
      />
      <p id={countId} className="text-xs text-slate">
        {copy.count(value.length, max)}
      </p>
    </section>
  );
}

function ParagraphRow({
  index,
  paragraph,
  snapshot,
  editing,
  readOnly,
  draft,
  fieldError,
  editorRef,
  templateId,
  onDraft,
  onIncluded,
  onBeginEdit,
  onEditKeyDown,
  onEditBlur,
}: {
  index: number;
  paragraph: LetterParagraph;
  snapshot: LetterWorkspaceData["snapshot"];
  editing: boolean;
  readOnly: boolean;
  draft: string;
  fieldError: string | null;
  editorRef: React.RefObject<HTMLTextAreaElement | null>;
  templateId: ResumeTemplateId;
  onDraft: (value: string) => void;
  onIncluded: (included: boolean) => void;
  onBeginEdit: () => void;
  onEditKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onEditBlur: () => void;
}) {
  const fieldId = useId();
  const sources = letterSourceChips(paragraph.sourceRefs, snapshot);
  const errorId = `${fieldId}-error`;
  const countId = `${fieldId}-count`;

  return (
    <li className="grid gap-2 border-t border-line pt-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className={sectionHeading(templateId)}>{letterCopy.paragraph(index)}</h2>
        <div className="flex items-center gap-1">
          <IncludeSwitch
            label={letterCopy.includeParagraph(index)}
            checked={paragraph.included}
            disabled={readOnly}
            onCheckedChange={onIncluded}
          />
          <SourceButton sources={sources} />
        </div>
      </div>
      {editing ? (
        <div className="grid gap-1">
          <Label htmlFor={fieldId} className="sr-only">
            {letterCopy.paragraph(index)}
          </Label>
          <Textarea
            ref={editorRef}
            id={fieldId}
            value={draft}
            maxLength={LETTER_LIMITS.paragraph}
            rows={4}
            className="min-h-24 text-sm"
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={fieldError ? `${countId} ${errorId}` : countId}
            onChange={(event) => onDraft(event.target.value)}
            onKeyDown={onEditKeyDown}
            onBlur={onEditBlur}
          />
          <p id={countId} className="text-xs text-slate">
            {copy.count(draft.length, LETTER_LIMITS.paragraph)}
          </p>
          {fieldError ? (
            <p id={errorId} className="text-sm text-destructive" role="alert">
              {fieldError}
            </p>
          ) : null}
        </div>
      ) : readOnly ? (
        <p
          className={cn(
            "px-2 py-1 text-sm whitespace-pre-wrap text-ink",
            !paragraph.included && "opacity-60",
          )}
        >
          {paragraph.text}
        </p>
      ) : (
        <button
          type="button"
          className={cn(
            "w-full rounded-md px-2 py-1 text-left text-sm whitespace-pre-wrap text-ink hover:bg-pine-50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            !paragraph.included && "opacity-60",
          )}
          onClick={onBeginEdit}
        >
          <span className="sr-only">{strings.common.edit}: </span>
          {paragraph.text}
        </button>
      )}
      {editing || !paragraph.reverted ? null : (
        <p className="w-fit rounded-full bg-marigold-100 px-2 py-0.5 text-xs text-marigold-700">
          {copy.restored}
        </p>
      )}
      {paragraph.needsWhy ? (
        <p className="text-sm text-slate">{letterCopy.needsWhy}</p>
      ) : null}
    </li>
  );
}

function SourceButton({ sources }: { sources: ReturnType<typeof letterSourceChips> }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon-xs" aria-label={copy.source}>
          <InfoIcon aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="max-h-80 w-80 max-w-[calc(100vw-2rem)] overflow-y-auto">
        {sources.length === 0 ? (
          <p className="text-sm text-slate">{letterCopy.sourceEmpty}</p>
        ) : (
          <ul className="grid gap-2">
            {sources.map((source) => (
              <li key={source.ref} className="grid gap-0.5">
                <p className="text-sm font-medium text-ink">
                  {source.kind === "library" ? copy.sourceFrom(source.title) : source.title}
                </p>
                {source.kind === "library" ? (
                  <p className="text-sm whitespace-pre-wrap text-ink">{source.text}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

function IncludeSwitch({
  label,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (included: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex shrink-0 items-center gap-2">
      <Label htmlFor={id} className="text-sm font-normal text-slate">
        {copy.include}
      </Label>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

function LetterDetails({
  content,
  tone,
  requirements,
}: {
  content: CoverLetterContent;
  tone: LetterWorkspaceData["tone"];
  requirements: LetterWorkspaceData["requirements"];
}) {
  return (
    <div className="flex flex-col gap-6 rounded-lg border border-line bg-surface p-4">
      <section className="grid gap-2">
        <h2 className="text-sm font-medium text-ink">{letterCopy.toneLabel}</h2>
        <p className="text-sm text-ink">{letterCopy.tones[tone]}</p>
      </section>
      <section className="grid gap-2">
        <h2 className="text-sm font-medium text-ink">{letterCopy.wordCountLabel}</h2>
        <p className="text-sm text-ink">{letterCopy.wordCount(letterWordCount(content))}</p>
      </section>
      <section className="grid gap-2">
        <h2 className="text-sm font-medium text-ink">{letterCopy.requirementsTitle}</h2>
        {requirements.length === 0 ? (
          <p className="text-sm text-slate">{letterCopy.noRequirements}</p>
        ) : (
          <ul className="grid gap-2">
            {requirements.map((requirement) => (
              <li key={requirement.id} className="text-sm break-words text-ink">
                {requirement.text}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function sectionHeading(templateId: ResumeTemplateId): string {
  return cn(
    "font-medium text-ink",
    templateId === "compact" ? "text-sm" : "text-base",
    templateId === "modern" && "border-b border-pine pb-1 font-serif text-lg",
  );
}

function jsonEqual(left: CoverLetterContent, right: CoverLetterContent): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
