"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FileUp } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { openUpgradeModal } from "@/components/shell/upgrade-store";
import { strings } from "@/copy/strings";
import type { FieldErrors } from "@/lib/result";
import { cn } from "@/lib/utils";

import { commitImport, extractResume } from "../actions";
import {
  DOCX_MIME,
  IMPORT_LIMITS,
  PDF_MIME,
} from "../schemas";
import {
  ReviewForm,
  type ReviewDraft,
} from "./review-form";

const copy = strings.library.import;
const errors = copy.errors;
const warnings = copy.warnings;

type ImportFlowProps = {
  libraryHasContent: boolean;
  importsLeft: number;
  email: string;
};

type Source = "file" | "text";
type Step = "upload" | "reading" | "review";
type Banner = "ai" | "nothing" | null;

export function ImportFlow({
  libraryHasContent,
  importsLeft: importsLeftProp,
  email,
}: ImportFlowProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [source, setSource] = useState<Source>("file");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [dragging, setDragging] = useState(false);
  const [fields, setFields] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [banner, setBanner] = useState<Banner>(null);
  const [draft, setDraft] = useState<ReviewDraft | null>(null);
  const [stage, setStage] = useState(0);
  const [pending, setPending] = useState(false);
  const [importsLeft, setImportsLeft] = useState(importsLeftProp);
  const busy = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step !== "reading") return;
    const id = window.setInterval(() => {
      setStage((current) => (current + 1) % copy.stages.length);
    }, 8000);
    return () => window.clearInterval(id);
  }, [step]);

  function updateDraft(next: ReviewDraft | ((current: ReviewDraft) => ReviewDraft)) {
    setFields({});
    setFormError(null);
    setDraft((current) => {
      if (!current) return current;
      return typeof next === "function" ? next(current) : next;
    });
  }

  async function readResume() {
    if (busy.current) return;
    if (importsLeft <= 0) {
      openUpgradeModal({ kind: "quota", meter: "IMPORT" });
      return;
    }

    const request = buildRequest(source, file, text);
    if (!request.ok) {
      setFields(request.fields);
      setBanner(null);
      return;
    }

    busy.current = true;
    setFields({});
    setBanner(null);
    setFormError(null);
    setStage(0);
    setStep("reading");
    setPending(true);
    try {
      const result = await extractResume(request.input);
      if (!result.ok) {
        setStep("upload");
        if (result.error.code === "QUOTA_EXCEEDED") {
          openUpgradeModal({ kind: "quota", meter: "IMPORT" });
          setImportsLeft(0);
          return;
        }
        if (result.error.code === "VALIDATION") {
          setFields(result.error.fields ?? {});
          return;
        }
        setBanner("ai");
        return;
      }
      setImportsLeft((current) => Math.max(0, current - 1));
      if (result.data.warnings.includes(warnings.nothing)) {
        setStep("upload");
        setBanner("nothing");
        return;
      }
      setDraft(draftFromExtracted(result.data));
      setStep("review");
    } catch {
      setStep("upload");
      setBanner("ai");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  function onUpload(event: FormEvent) {
    event.preventDefault();
    void readResume();
  }

  function selectFile(next: File | null) {
    setFile(next);
    if (!next || next.size === 0) {
      setFields((current) => ({ ...current, file: undefined }));
      return;
    }
    if (next.size > IMPORT_LIMITS.fileBytes) {
      setFields((current) => ({ ...current, file: [errors.fileSize] }));
      return;
    }
    setFields((current) => ({ ...current, file: undefined }));
  }

  function clearFile() {
    setFile(null);
    setFields((current) => ({ ...current, file: undefined }));
    if (fileInput.current) fileInput.current.value = "";
  }

  async function save(): Promise<boolean> {
    if (!draft || busy.current) return false;
    busy.current = true;
    setPending(true);
    setFields({});
    setFormError(null);
    const normalized = normalizeDraft(draft);
    setDraft(normalized);
    try {
      const result = await commitImport(toPayload(normalized, libraryHasContent));
      if (!result.ok) {
        if (result.error.code === "CONFLICT") {
          setFormError(copy.conflict);
          return false;
        }
        if (result.error.fields) {
          setFields(result.error.fields);
          return false;
        }
        setFormError(copy.saveFailed);
        return false;
      }
      toast.success(copy.saved(result.data));
      router.push(result.data.redirectTo);
      return true;
    } catch {
      setFormError(copy.saveFailed);
      return false;
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  if (step === "reading") {
    return (
      <section aria-labelledby="import-reading" className="flex flex-col gap-3">
        <h2 id="import-reading" className="text-base font-medium text-ink">
          {copy.reading}
        </h2>
        <p className="text-sm text-slate">{copy.readingHint}</p>
        <ol aria-live="polite" className="grid gap-1">
          {copy.stages.map((line, index) => (
            <li
              key={line}
              className={index === stage ? "text-sm text-ink" : "text-sm text-slate"}
              aria-current={index === stage ? "step" : undefined}
            >
              {line}
            </li>
          ))}
        </ol>
      </section>
    );
  }

  if (step === "review" && draft) {
    return (
      <ReviewForm
        draft={draft}
        setDraft={updateDraft}
        email={email}
        libraryHasContent={libraryHasContent}
        fields={fields}
        formError={formError}
        pending={pending}
        onBack={() => {
          if (pending) return;
          setStep("upload");
          setFields({});
          setFormError(null);
          setDraft(null);
        }}
        onSave={save}
      />
    );
  }

  const trimmed = text.trim();
  const textHint =
    trimmed.length === 0
      ? null
      : trimmed.length < IMPORT_LIMITS.textMin
        ? errors.textShort
        : trimmed.length > IMPORT_LIMITS.textMax
          ? errors.textLong
          : null;
  const ready = source === "text" ? textHint === null && trimmed.length > 0 : fileReady(file);

  return (
    <form
      onSubmit={onUpload}
      className="rounded-card border border-line bg-surface p-4 sm:p-5"
    >
      {banner === "nothing" ? (
        <p className="mb-4 text-sm text-ink" role="alert">
          {warnings.nothing}
        </p>
      ) : null}
      {banner === "ai" ? (
        <div className="mb-4 grid gap-3" role="alert">
          <p className="text-sm text-ink">{copy.aiFailed}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" className="min-h-11" onClick={() => void readResume()}>
              {copy.retry}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => {
                setSource("text");
                setBanner(null);
              }}
            >
              {copy.pasteInstead}
            </Button>
          </div>
        </div>
      ) : null}
      <Tabs
        value={source}
        onValueChange={(value) => setSource(value === "text" ? "text" : "file")}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="h-auto min-h-11 w-full sm:w-fit">
            <TabsTrigger value="file" className="min-h-11 flex-1 px-3 sm:flex-none">
              {copy.uploadTab}
            </TabsTrigger>
            <TabsTrigger value="text" className="min-h-11 flex-1 px-3 sm:flex-none">
              {copy.pasteTab}
            </TabsTrigger>
          </TabsList>
          <p className="text-xs text-slate tabular-nums sm:shrink-0">{copy.importsLeft(importsLeft)}</p>
        </div>
        <TabsContent value="file" className="pt-4">
          <div
            className={cn(
              "rounded-card border border-dashed border-line bg-paper focus-within:border-pine focus-within:ring-3 focus-within:ring-ring/50",
              dragging && "border-pine bg-pine-50",
            )}
          >
            <label
              className="flex min-h-44 cursor-pointer flex-col items-center justify-center gap-2 px-4 py-8 text-center sm:min-h-52"
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                const next = event.dataTransfer.files[0];
                if (next) selectFile(next);
              }}
            >
              <FileUp className="size-5 text-pine" aria-hidden />
              <span className="max-w-full text-sm font-medium break-all text-ink">
                {file ? file.name : copy.dropTitle}
              </span>
              <span className="text-sm text-slate">{copy.dropHint}</span>
              <span className="mt-2 inline-flex min-h-9 items-center rounded-button border border-line bg-surface px-3 text-sm font-medium text-pine">
                {file ? copy.chooseDifferent : copy.chooseFile}
              </span>
              <input
                ref={fileInput}
                type="file"
                accept={`${PDF_MIME},${DOCX_MIME},.pdf,.docx`}
                className="sr-only"
                aria-label={file ? copy.fileChosen(file.name) : copy.chooseFile}
                onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
              />
            </label>
            {file ? (
              <div className="flex justify-center border-t border-line px-4 py-2">
                <Button type="button" variant="ghost" className="min-h-11" onClick={clearFile}>
                  {copy.removeFile}
                </Button>
              </div>
            ) : null}
          </div>
          {fields.file?.[0] ? (
            <p className="mt-2 text-sm text-destructive" role="alert">
              {fields.file[0]}
            </p>
          ) : null}
        </TabsContent>
        <TabsContent value="text" className="pt-4">
          <div className="grid gap-1.5">
            <Label htmlFor="import-paste">{copy.pasteLabel}</Label>
            <Textarea
              id="import-paste"
              value={text}
              placeholder={copy.pastePlaceholder}
              onChange={(event) => {
                setText(event.target.value);
                setFields((current) => ({ ...current, text: undefined }));
              }}
              aria-invalid={Boolean(fields.text?.[0])}
              aria-describedby={
                fields.text?.[0] || textHint ? "import-paste-error" : undefined
              }
              className="min-h-40"
            />
            {fields.text?.[0] || textHint ? (
              <p id="import-paste-error" className="text-sm text-slate" role="status">
                {fields.text?.[0] ?? textHint}
              </p>
            ) : null}
          </div>
        </TabsContent>
      </Tabs>
      <div className="mt-4 flex">
        <Button
          type="submit"
          disabled={!ready || pending}
          className={cn(
            "min-h-11 w-full sm:ml-auto sm:w-auto",
            !ready &&
              "border border-line bg-muted text-slate hover:bg-muted disabled:opacity-100",
          )}
        >
          {copy.read}
        </Button>
      </div>
    </form>
  );
}

function fileReady(file: File | null): boolean {
  return file !== null && file.size > 0 && file.size <= IMPORT_LIMITS.fileBytes;
}

function buildRequest(
  source: Source,
  file: File | null,
  text: string,
):
  | { ok: true; input: FormData | { source: "text"; text: string } }
  | { ok: false; fields: FieldErrors } {
  if (source === "text") {
    const trimmed = text.trim();
    if (trimmed.length < IMPORT_LIMITS.textMin) {
      return { ok: false, fields: { text: [errors.textShort] } };
    }
    if (trimmed.length > IMPORT_LIMITS.textMax) {
      return { ok: false, fields: { text: [errors.textLong] } };
    }
    return { ok: true, input: { source: "text", text: trimmed } };
  }
  if (!file || file.size === 0) {
    return { ok: false, fields: { file: [errors.empty] } };
  }
  if (file.size > IMPORT_LIMITS.fileBytes) {
    return { ok: false, fields: { file: [errors.fileSize] } };
  }
  const formData = new FormData();
  formData.set("file", file);
  return { ok: true, input: formData };
}

function draftFromExtracted(
  resume: Extract<
    Awaited<ReturnType<typeof extractResume>>,
    { ok: true }
  >["data"],
): ReviewDraft {
  return {
    profileIncluded: true,
    fullName: resume.profile.fullName ?? "",
    headline: resume.profile.headline ?? "",
    phone: resume.profile.phone ?? "",
    location: resume.profile.location ?? "",
    summary: resume.profile.summary ?? "",
    links: resume.profile.links.map((link) => ({
      key: crypto.randomUUID(),
      label: link.label,
      url: link.url,
    })),
    resumeEmail: resume.profile.email,
    entries: resume.entries.map((entry) => ({
      key: crypto.randomUUID(),
      included: true,
      kind: entry.kind,
      title: entry.title,
      organization: entry.organization ?? "",
      location: entry.location ?? "",
      url: entry.url ?? "",
      startDate: entry.startDate ?? "",
      endDate: entry.endDate ?? "",
      isCurrent: entry.isCurrent,
      bullets: entry.bullets.map((bullet) => ({
        key: crypto.randomUUID(),
        included: true,
        text: bullet.text,
      })),
    })),
    skills: resume.skills.map((skill) => ({
      key: crypto.randomUUID(),
      included: true,
      name: skill.name,
      category: skill.category ?? "",
    })),
    warnings: resume.warnings.filter((warning) => warning !== warnings.nothing),
    mode: "append",
  };
}

function normalizeDraft(draft: ReviewDraft): ReviewDraft {
  return {
    ...draft,
    links: draft.links.filter(
      (link) => link.label.trim().length > 0 || link.url.trim().length > 0,
    ),
  };
}

function toPayload(draft: ReviewDraft, libraryHasContent: boolean) {
  return {
    mode: libraryHasContent && draft.mode === "replace" ? "replace" : "append",
    profile: {
      included: draft.profileIncluded,
      fullName: draft.fullName,
      headline: draft.headline,
      phone: draft.phone,
      location: draft.location,
      summary: draft.summary,
      links: draft.links
        .filter((link) => link.label.trim().length > 0 || link.url.trim().length > 0)
        .map(({ label, url }) => ({ label, url })),
    },
    entries: draft.entries.map((entry) => ({
      included: entry.included,
      kind: entry.kind,
      title: entry.title,
      organization: entry.organization,
      location: entry.location,
      url: entry.url,
      startDate: entry.startDate,
      endDate: entry.isCurrent ? "" : entry.endDate,
      isCurrent: entry.isCurrent,
      bullets: entry.bullets.map((bullet) => ({
        included: bullet.included,
        text: bullet.text,
      })),
    })),
    skills: draft.skills.map((skill) => ({
      included: skill.included,
      name: skill.name,
      category: skill.category,
    })),
  } as const;
}
