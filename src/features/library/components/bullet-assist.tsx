"use client";

import {
  ListTreeIcon,
  PencilLineIcon,
  SearchIcon,
  SparklesIcon,
} from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { openUpgradeModal } from "@/components/shell/upgrade-store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { strings } from "@/copy/strings";
import { UNDO_DELETE_MS } from "@/lib/undo-delete";

import type { ImproveKind } from "../opportunity";
import {
  acceptBulletRewrite,
  discardWording,
  proposeBulletRewrite,
  undoBulletRewrite,
  useBulletWording as applyBulletWording,
} from "../wording-actions";
import type { WordingView } from "../wording";

const copy = strings.library.assist;

type BulletAssistProps = {
  bulletId: string;
  text: string;
  wordings: readonly WordingView[];
  improveKind: ImproveKind | null;
  diagnosis: string | null;
  active: boolean;
  onOpen: () => void;
  onClose: () => void;
};

const IMPROVE_ICONS = {
  clarify: PencilLineIcon,
  evidence: SparklesIcon,
  detail: SearchIcon,
  repetition: ListTreeIcon,
} as const;

export function BulletAssist({
  bulletId,
  text,
  wordings,
  improveKind,
  diagnosis,
  active,
  onOpen,
  onClose,
}: BulletAssistProps) {
  const [mode, setMode] = useState<"rewrite" | "wording" | null>(null);
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState("");
  const [proposal, setProposal] = useState("");
  const [why, setWhy] = useState<string | null>(null);
  const [question, setQuestion] = useState<string | null>(null);

  const saved = wordings.filter(
    (item) => item.bulletId === bulletId && item.status === "APPROVED" && item.text !== text,
  );
  const open = active ? mode : null;
  const actionLabel = improveKind ? copy.improve[improveKind] : null;
  const ImproveIcon = improveKind ? IMPROVE_ICONS[improveKind] : null;

  function onImprove() {
    onOpen();
    setMode("rewrite");
    setWhy(null);
    setQuestion(null);
    startTransition(async () => {
      const result = await proposeBulletRewrite({ id: bulletId });
      if (!result.ok) {
        if (result.error.code === "QUOTA_EXCEEDED") {
          toast.error(copy.allowance);
          openUpgradeModal({ kind: "plan" });
        } else toast.error(copy.failed);
        onClose();
        return;
      }
      if (result.data.status !== "suggestion" || !result.data.text || !result.data.why) {
        toast.message(result.data.status === "unchanged" ? copy.unchanged : copy.dropped);
        onClose();
        return;
      }
      setProposal(result.data.text);
      setDraft(result.data.text);
      setWhy(result.data.why);
      setQuestion(result.data.question);
    });
  }

  function onAccept() {
    startTransition(async () => {
      const result = await acceptBulletRewrite({
        bulletId,
        text: draft,
        proposalText: proposal,
        reason: why ?? "",
      });
      if (!result.ok) {
        toast.error(result.error.code === "VALIDATION" ? copy.rejected : copy.failed);
        return;
      }
      onClose();
      const savedRewrite = result.data;
      toast(copy.accepted, {
        duration: UNDO_DELETE_MS,
        action: {
          label: strings.common.undo,
          onClick: () => {
            void undoBulletRewrite(savedRewrite).then((undo) => {
              if (undo.ok && undo.data.restored) toast.success(copy.undone);
            });
          },
        },
      });
    });
  }

  if (!actionLabel && saved.length === 0) return null;

  return (
    <div className="grid gap-1.5">
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1">
        {actionLabel && ImproveIcon ? (
          <button
            type="button"
            className="inline-flex min-h-7 items-center gap-1.5 rounded-md px-0.5 text-[0.8125rem] font-medium text-pine transition-colors hover:text-pine-hover focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-60"
            disabled={pending}
            onClick={onImprove}
          >
            <ImproveIcon aria-hidden className="size-3.5 shrink-0 stroke-[1.5]" />
            {actionLabel}
          </button>
        ) : null}
        {saved.length > 0 ? (
          <button
            type="button"
            className="inline-flex min-h-7 items-center gap-1 rounded-md px-0.5 text-[0.8125rem] text-slate underline-offset-2 hover:text-ink hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            title={copy.alternateWordingHint}
            aria-label={`${copy.alternateWording(saved.length)}. ${copy.alternateWordingHint}`}
            onClick={() => {
              onOpen();
              setMode(open === "wording" ? null : "wording");
              if (open === "wording") onClose();
            }}
          >
            {copy.alternateWording(saved.length)}
          </button>
        ) : null}
      </div>
      {open === "rewrite" ? (
        <div className="mt-0.5 grid gap-3 rounded-md border border-line bg-paper px-3.5 py-3">
          {pending && !why ? <WaitLine /> : null}
          {why ? (
            <>
              {diagnosis ? (
                <p className="text-[0.8125rem] leading-relaxed text-ink">
                  <span className="font-medium">{copy.assessment}. </span>
                  {diagnosis}
                </p>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <p className="text-[0.6875rem] font-medium tracking-wide text-slate uppercase">
                    {copy.original}
                  </p>
                  <p className="rounded-md border border-line/80 bg-surface/70 px-3 py-2 text-[0.8125rem] leading-relaxed whitespace-pre-wrap text-slate">
                    {text}
                  </p>
                </div>
                <label className="grid gap-1.5 text-[0.8125rem] text-ink">
                  <span className="text-[0.6875rem] font-medium tracking-wide text-slate uppercase">
                    {copy.suggestion}
                  </span>
                  <Textarea
                    value={draft}
                    maxLength={400}
                    rows={4}
                    className="bg-surface text-[0.8125rem] leading-relaxed"
                    onChange={(event) => setDraft(event.target.value)}
                  />
                </label>
              </div>
              <p className="text-[0.75rem] leading-relaxed text-slate">{copy.editHint}</p>
              <p className="text-[0.75rem] leading-relaxed text-slate">{copy.replaceNote}</p>
              <p className="text-[0.8125rem] leading-relaxed text-ink">
                <span className="font-medium">{copy.why}. </span>
                {why}
              </p>
              {question ? (
                <p className="rounded-md border border-marigold-100 bg-marigold-100/60 px-3 py-2 text-[0.8125rem] leading-relaxed text-ink">
                  <span className="font-medium">{copy.question}. </span>
                  {question}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" disabled={pending} onClick={onAccept}>
                  {copy.accept}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => onClose()}>
                  {copy.dismiss}
                </Button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
      {open === "wording" ? (
        <ul className="mt-0.5 grid gap-2">
          <li className="text-[0.75rem] text-slate">{copy.alternateWordingHint}</li>
          {saved.map((item) => (
            <li key={item.id} className="rounded-md border border-line bg-paper px-3.5 py-2.5">
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-ink">{item.text}</p>
              <p className="mt-1.5 text-[0.75rem] text-slate">
                {item.jobId ? copy.forJob : copy.approved}
                {item.reason ? ` · ${item.reason}` : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-3">
                {item.jobId ? null : (
                  <button
                    type="button"
                    className="text-[0.8125rem] text-pine underline-offset-4 hover:underline"
                    onClick={() => {
                      startTransition(async () => {
                        const result = await applyBulletWording({ id: item.id });
                        if (!result.ok) toast.error(copy.failed);
                      });
                    }}
                  >
                    {copy.useDefault}
                  </button>
                )}
                <button
                  type="button"
                  className="text-[0.8125rem] text-slate underline-offset-4 hover:underline"
                  onClick={() => {
                    startTransition(async () => {
                      const result = await discardWording({ id: item.id });
                      if (!result.ok) toast.error(copy.failed);
                    });
                  }}
                >
                  {copy.discard}
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function WaitLine() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 3000);
    return () => clearTimeout(timer);
  }, []);
  return (
    <p className="text-[0.8125rem] text-slate" role="status">
      {slow ? copy.stillWorking : copy.working}
    </p>
  );
}
