"use client";

import { CheckIcon, ChevronDownIcon, LockIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { openUpgradeModal } from "@/components/shell/upgrade-store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { strings } from "@/copy/strings";
import type { LibrarySnapshot } from "@/features/library/schemas";
import { filenameFromContentDisposition } from "@/lib/pdf/filename";
import { RESUME_TEMPLATES, type ResumeTemplateId } from "@/lib/pdf/template";

import {
  markResumeSubmitted,
  markSubmittedAndApply,
  setResumeTemplate,
} from "../actions";
import type { ResumeTemplateAccess } from "../content";
import {
  FIRST_EXPORT_HEADER,
  isFirstExportHeader,
  shouldPromptMoveToApplied,
} from "../export-prompt";
import { resumePlainText } from "../plainText";
import type { ResumeContent } from "../schemas";
import { resumeTemplateLabel } from "../template-label";

const copy = strings.jobs.workspace;

type ExportInput = {
  jobId: string;
  resumeId: string;
  jobStatus: string;
  templateId: ResumeTemplateId;
  submitted: boolean;
  templates: ResumeTemplateAccess;
  content: ResumeContent;
  snapshot: LibrarySnapshot;
};

export function useResumeExport(input: ExportInput) {
  const [templateId, setTemplateId] = useState(input.templateId);
  const [submitted, setSubmitted] = useState(input.submitted);
  const [jobStatus, setJobStatus] = useState(input.jobStatus);
  const [resumeKey, setResumeKey] = useState(input.resumeId);
  const [templatePending, setTemplatePending] = useState(false);
  const [submitPending, setSubmitPending] = useState(false);
  const [applyPending, setApplyPending] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const resumeRef = useRef(input.resumeId);
  useEffect(() => {
    resumeRef.current = input.resumeId;
  }, [input.resumeId]);

  if (resumeKey !== input.resumeId) {
    setResumeKey(input.resumeId);
    setTemplateId(input.templateId);
    setSubmitted(input.submitted);
    setJobStatus(input.jobStatus);
    setPromptOpen(false);
    setTemplatePending(false);
    setSubmitPending(false);
    setApplyPending(false);
    setExporting(false);
  }

  async function onTemplate(next: ResumeTemplateId) {
    if (templatePending || next === templateId) return;
    const resumeId = input.resumeId;
    setTemplatePending(true);
    let result: Awaited<ReturnType<typeof setResumeTemplate>>;
    try {
      result = await setResumeTemplate({
        jobId: input.jobId,
        resumeId,
        templateId: next,
      });
    } catch {
      result = { ok: false, error: { code: "INTERNAL" } };
    }
    setTemplatePending(false);
    if (resumeRef.current !== resumeId) return;
    if (!result.ok) {
      if (result.error.code === "PRO_REQUIRED") openUpgradeModal(copy.templatePro);
      else toast.error(copy.templateFailed);
      return;
    }
    setTemplateId(result.data.templateId);
  }

  async function onCopy() {
    try {
      if (!navigator.clipboard?.writeText) {
        toast.error(copy.copyFailed);
        return;
      }
      await navigator.clipboard.writeText(resumePlainText(input.content, input.snapshot));
      toast.success(copy.copied);
    } catch {
      toast.error(copy.copyFailed);
    }
  }

  async function onExportPdf() {
    if (exporting) return;
    const resumeId = input.resumeId;
    const status = jobStatus;
    setExporting(true);
    try {
      const response = await fetch(`/api/resumes/${resumeId}/pdf`);
      const type = response.headers.get("Content-Type") ?? "";
      if (!response.ok || !type.includes("application/pdf")) {
        toast.error(copy.exportFailed);
        return;
      }
      const blob = await response.blob();
      const filename =
        filenameFromContentDisposition(response.headers.get("Content-Disposition")) ??
        "resume.pdf";
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      if (resumeRef.current !== resumeId) return;
      if (
        shouldPromptMoveToApplied(
          status,
          isFirstExportHeader(response.headers.get(FIRST_EXPORT_HEADER)),
        )
      ) {
        setPromptOpen(true);
      }
    } catch {
      toast.error(copy.exportFailed);
    } finally {
      if (resumeRef.current === resumeId) setExporting(false);
    }
  }

  async function onMarkSubmitted() {
    if (submitted || submitPending) return;
    const resumeId = input.resumeId;
    setSubmitPending(true);
    let result: Awaited<ReturnType<typeof markResumeSubmitted>>;
    try {
      result = await markResumeSubmitted({ jobId: input.jobId, resumeId });
    } catch {
      result = { ok: false, error: { code: "INTERNAL" } };
    }
    setSubmitPending(false);
    if (resumeRef.current !== resumeId) return;
    if (!result.ok) {
      toast.error(copy.submitFailed);
      return;
    }
    setSubmitted(true);
  }

  async function onYes() {
    if (applyPending) return;
    const resumeId = input.resumeId;
    setApplyPending(true);
    let result: Awaited<ReturnType<typeof markSubmittedAndApply>>;
    try {
      result = await markSubmittedAndApply({ jobId: input.jobId, resumeId });
    } catch {
      result = { ok: false, error: { code: "INTERNAL" } };
    }
    setApplyPending(false);
    if (resumeRef.current !== resumeId) return;
    if (!result.ok) {
      toast.error(copy.submitFailed);
      return;
    }
    setSubmitted(true);
    setJobStatus(result.data.status);
    if (result.data.moved || result.data.status !== "SAVED") {
      setPromptOpen(false);
      return;
    }
    toast.error(copy.applyFailed);
  }

  function onPromptOpenChange(open: boolean) {
    if (applyPending) return;
    setPromptOpen(open);
  }

  return {
    barProps: {
      templateId,
      templatePending,
      submitted,
      submitPending,
      exporting,
      templates: input.templates,
      onTemplate,
      onCopy,
      onExportPdf,
      onMarkSubmitted,
    },
    dialogProps: {
      open: promptOpen,
      pending: applyPending,
      onOpenChange: onPromptOpenChange,
      onYes,
    },
  };
}

export function ResumeExportBar({
  templateId,
  templatePending,
  submitted,
  submitPending,
  exporting,
  templates,
  onTemplate,
  onCopy,
  onExportPdf,
  onMarkSubmitted,
}: {
  templateId: ResumeTemplateId;
  templatePending: boolean;
  submitted: boolean;
  submitPending: boolean;
  exporting: boolean;
  templates: ResumeTemplateAccess;
  onTemplate: (templateId: ResumeTemplateId) => void;
  onCopy: () => void;
  onExportPdf: () => void;
  onMarkSubmitted: () => void;
}) {
  const current = resumeTemplateLabel(templateId);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={templatePending}
          >
            {`${copy.templateLabel}: ${current}`}
            <ChevronDownIcon aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {RESUME_TEMPLATES.map((id) => {
            const locked = templateLocked(id, templates);
            const label = resumeTemplateLabel(id);
            return (
              <DropdownMenuItem
                key={id}
                aria-current={templateId === id ? "true" : undefined}
                aria-label={locked ? `${label}, ${copy.includedWithPro}` : label}
                onSelect={() => {
                  if (locked) {
                    openUpgradeModal(copy.templatePro);
                    return;
                  }
                  onTemplate(id);
                }}
              >
                {templateId === id && !locked ? (
                  <CheckIcon aria-hidden />
                ) : locked ? (
                  <LockIcon aria-hidden />
                ) : (
                  <span className="size-4" aria-hidden />
                )}
                {label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button type="button" variant="outline" onClick={onCopy}>
        {copy.copyText}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" disabled={exporting} aria-busy={exporting}>
            {exporting ? copy.exporting : copy.exportMenu}
            <ChevronDownIcon aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled={exporting} onSelect={onExportPdf}>
            {copy.exportPdf}
          </DropdownMenuItem>
          <DropdownMenuItem
            aria-label={
              templates.docx
                ? `${copy.exportDocx}, ${copy.comingSoon}`
                : `${copy.exportDocx}, ${copy.includedWithPro}`
            }
            onSelect={() => {
              if (templates.docx) toast.message(copy.docxLater);
              else openUpgradeModal(copy.docxPro);
            }}
          >
            <LockIcon aria-hidden />
            {copy.exportDocx}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        type="button"
        variant="outline"
        disabled={submitted || submitPending}
        aria-busy={submitPending}
        onClick={onMarkSubmitted}
      >
        {submitted ? strings.jobs.documents.submitted : copy.markSubmitted}
      </Button>
    </div>
  );
}

export function ExportAppliedDialog({
  open,
  pending,
  onOpenChange,
  onYes,
}: {
  open: boolean;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onYes: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-lg font-semibold">
            {copy.exportReadyTitle}
          </DialogTitle>
          <DialogDescription>{copy.exportReadyBody}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            {copy.exportNotYet}
          </Button>
          <Button type="button" disabled={pending} onClick={onYes}>
            {copy.exportYes}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function templateLocked(id: ResumeTemplateId, access: ResumeTemplateAccess): boolean {
  if (id === "modern") return !access.modern;
  if (id === "compact") return !access.compact;
  return false;
}
