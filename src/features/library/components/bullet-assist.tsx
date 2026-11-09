"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { openUpgradeModal } from "@/components/shell/upgrade-store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { strings } from "@/copy/strings";
import { UNDO_DELETE_MS } from "@/lib/undo-delete";

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
};

export function BulletAssist({ bulletId, text, wordings }: BulletAssistProps) {
  const [open, setOpen] = useState<"rewrite" | "wording" | null>(null);
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState("");
  const [proposal, setProposal] = useState("");
  const [why, setWhy] = useState<string | null>(null);
  const [question, setQuestion] = useState<string | null>(null);

  const saved = wordings.filter(
    (item) => item.bulletId === bulletId && item.status === "APPROVED" && item.text !== text,
  );

  function onRewrite() {
    setOpen("rewrite");
    setWhy(null);
    setQuestion(null);
    startTransition(async () => {
      const result = await proposeBulletRewrite({ id: bulletId });
      if (!result.ok) {
        if (result.error.code === "QUOTA_EXCEEDED") {
          toast.error(copy.allowance);
          openUpgradeModal({ kind: "plan" });
        } else toast.error(copy.failed);
        return;
      }
      if (result.data.status !== "suggestion" || !result.data.text || !result.data.why) {
        toast.message(result.data.status === "unchanged" ? copy.unchanged : copy.dropped);
        setOpen(null);
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
      setOpen(null);
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

  return (
    <div className="grid gap-1">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="text-xs text-pine underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-60"
          disabled={pending}
          onClick={onRewrite}
        >
          {copy.rewrite}
        </button>
        {saved.length > 0 ? (
          <button
            type="button"
            className="text-xs text-pine underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            onClick={() => setOpen(open === "wording" ? null : "wording")}
          >
            {copy.wording}
          </button>
        ) : null}
      </div>
      {open === "rewrite" ? (
        <div className="grid max-w-prose gap-2 rounded-md border border-line bg-surface px-3 py-2">
          {pending && !why ? <WaitLine /> : null}
          {why ? (
            <>
              <p className="text-xs whitespace-pre-wrap text-slate">
                <span className="font-medium text-ink">{copy.original}. </span>
                {text}
              </p>
              <label className="grid gap-1 text-xs text-ink">
                {copy.suggestion}
                <Textarea
                  value={draft}
                  maxLength={400}
                  rows={3}
                  onChange={(event) => setDraft(event.target.value)}
                />
              </label>
              <p className="text-xs text-slate">{copy.editHint}</p>
              <p className="text-xs text-ink">
                <span className="font-medium">{copy.why}. </span>
                {why}
              </p>
              {question ? (
                <p className="text-xs text-ink">
                  <span className="font-medium">{copy.question} </span>
                  {question}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" disabled={pending} onClick={onAccept}>
                  {copy.accept}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setOpen(null)}>
                  {copy.dismiss}
                </Button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
      {open === "wording" ? (
        <ul className="grid max-w-prose gap-2">
          {saved.map((item) => (
            <li key={item.id} className="rounded-md border border-line px-3 py-2">
              <p className="text-sm whitespace-pre-wrap text-ink">{item.text}</p>
              <p className="mt-1 text-xs text-slate">
                {item.jobId ? copy.forJob : copy.approved}
                {item.reason ? ` · ${item.reason}` : ""}
              </p>
              {item.jobId ? null : (
                <button
                  type="button"
                  className="mt-1 text-xs text-pine underline-offset-4 hover:underline"
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
                className="mt-1 ml-3 text-xs text-slate underline-offset-4 hover:underline"
                onClick={() => {
                  startTransition(async () => {
                    const result = await discardWording({ id: item.id });
                    if (!result.ok) toast.error(copy.failed);
                  });
                }}
              >
                {copy.discard}
              </button>
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
    <p className="text-xs text-slate" role="status">
      {slow ? copy.stillWorking : copy.working}
    </p>
  );
}
