"use client";

import { CheckIcon, ChevronDownIcon, LockIcon, ThumbsDown, ThumbsUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { openUpgradeModal } from "@/components/shell/upgrade-store";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { strings } from "@/copy/strings";
import type { ResumeTemplateAccess } from "@/features/tailor/content";
import { resumeTemplateLabel } from "@/features/tailor/template-label";
import { filenameFromContentDisposition } from "@/lib/pdf/filename";
import { RESUME_TEMPLATES, type ResumeTemplateId } from "@/lib/pdf/template";

import {
  markLetterSubmitted,
  rateCoverLetter,
  setLetterTemplate,
} from "../actions";
import { letterPlainText } from "../plainText";
import type { CoverLetterContent } from "../schemas";

const copy = strings.jobs.workspace;
const letterCopy = strings.jobs.letters;

type ExportInput = {
  jobId: string;
  letterId: string;
  templateId: ResumeTemplateId;
  submitted: boolean;
  rating: 1 | -1 | null;
  templates: ResumeTemplateAccess;
  content: CoverLetterContent;
};

export function useLetterExport(input: ExportInput) {
  const [templateId, setTemplateId] = useState(input.templateId);
  const [submitted, setSubmitted] = useState(input.submitted);
  const [rating, setRating] = useState(input.rating);
  const [letterKey, setLetterKey] = useState(input.letterId);
  const [templatePending, setTemplatePending] = useState(false);
  const [submitPending, setSubmitPending] = useState(false);
  const [ratingPending, setRatingPending] = useState(false);
  const [exporting, setExporting] = useState(false);
  const letterRef = useRef(input.letterId);
  useEffect(() => {
    letterRef.current = input.letterId;
  }, [input.letterId]);

  if (letterKey !== input.letterId) {
    setLetterKey(input.letterId);
    setTemplateId(input.templateId);
    setSubmitted(input.submitted);
    setRating(input.rating);
    setTemplatePending(false);
    setSubmitPending(false);
    setRatingPending(false);
    setExporting(false);
  }

  async function onTemplate(next: ResumeTemplateId) {
    if (templatePending || next === templateId) return;
    const letterId = input.letterId;
    setTemplatePending(true);
    let result: Awaited<ReturnType<typeof setLetterTemplate>>;
    try {
      result = await setLetterTemplate({
        jobId: input.jobId,
        letterId,
        templateId: next,
      });
    } catch {
      result = { ok: false, error: { code: "INTERNAL" } };
    }
    setTemplatePending(false);
    if (letterRef.current !== letterId) return;
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
      await navigator.clipboard.writeText(letterPlainText(input.content));
      toast.success(copy.copied);
    } catch {
      toast.error(copy.copyFailed);
    }
  }

  async function onExportPdf() {
    if (exporting) return;
    const letterId = input.letterId;
    setExporting(true);
    try {
      const response = await fetch(`/api/letters/${letterId}/pdf`);
      const type = response.headers.get("Content-Type") ?? "";
      if (!response.ok || !type.includes("application/pdf")) {
        toast.error(copy.exportFailed);
        return;
      }
      const blob = await response.blob();
      const filename =
        filenameFromContentDisposition(response.headers.get("Content-Disposition")) ??
        "letter.pdf";
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(copy.exportFailed);
    } finally {
      if (letterRef.current === letterId) setExporting(false);
    }
  }

  async function onMarkSubmitted() {
    if (submitted || submitPending) return;
    const letterId = input.letterId;
    setSubmitPending(true);
    let result: Awaited<ReturnType<typeof markLetterSubmitted>>;
    try {
      result = await markLetterSubmitted({ jobId: input.jobId, letterId });
    } catch {
      result = { ok: false, error: { code: "INTERNAL" } };
    }
    setSubmitPending(false);
    if (letterRef.current !== letterId) return;
    if (!result.ok) {
      toast.error(copy.submitFailed);
      return;
    }
    setSubmitted(true);
  }

  async function onRate(next: 1 | -1) {
    if (ratingPending) return;
    const letterId = input.letterId;
    setRatingPending(true);
    let result: Awaited<ReturnType<typeof rateCoverLetter>>;
    try {
      result = await rateCoverLetter({ letterId, rating: next });
    } catch {
      result = { ok: false, error: { code: "INTERNAL" } };
    }
    setRatingPending(false);
    if (letterRef.current !== letterId) return;
    if (!result.ok) {
      toast.error(letterCopy.ratingFailed);
      return;
    }
    setRating(result.data.rating);
  }

  return {
    barProps: {
      templateId,
      templatePending,
      submitted,
      submitPending,
      rating,
      ratingPending,
      exporting,
      templates: input.templates,
      onTemplate,
      onCopy,
      onExportPdf,
      onMarkSubmitted,
      onRate,
    },
  };
}

export function LetterExportBar({
  templateId,
  templatePending,
  submitted,
  submitPending,
  rating,
  ratingPending,
  exporting,
  templates,
  onTemplate,
  onCopy,
  onExportPdf,
  onMarkSubmitted,
  onRate,
}: {
  templateId: ResumeTemplateId;
  templatePending: boolean;
  submitted: boolean;
  submitPending: boolean;
  rating: 1 | -1 | null;
  ratingPending: boolean;
  exporting: boolean;
  templates: ResumeTemplateAccess;
  onTemplate: (templateId: ResumeTemplateId) => void;
  onCopy: () => void;
  onExportPdf: () => void;
  onMarkSubmitted: () => void;
  onRate: (rating: 1 | -1) => void;
}) {
  const current = resumeTemplateLabel(templateId);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" disabled={templatePending}>
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
        {submitted ? letterCopy.submitted : copy.markSubmitted}
      </Button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-pressed={rating === 1}
        aria-label={letterCopy.helpful}
        disabled={ratingPending}
        className={rating === 1 ? "border-pine bg-pine-50 text-pine" : undefined}
        onClick={() => onRate(1)}
      >
        <ThumbsUp aria-hidden />
        {letterCopy.helpful}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-pressed={rating === -1}
        aria-label={letterCopy.notHelpful}
        disabled={ratingPending}
        className={rating === -1 ? "border-pine bg-pine-50 text-pine" : undefined}
        onClick={() => onRate(-1)}
      >
        <ThumbsDown aria-hidden />
        {letterCopy.notHelpful}
      </Button>
    </div>
  );
}

function templateLocked(id: ResumeTemplateId, access: ResumeTemplateAccess): boolean {
  if (id === "modern") return !access.modern;
  if (id === "compact") return !access.compact;
  return false;
}
