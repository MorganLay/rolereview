"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { strings } from "@/copy/strings";

import { applyLibraryRevision, reviseLibraryAnswer } from "../actions";
import type { AnswerOriginView } from "../view";

const copy = strings.library.fromAnswer;

export function AnswerSource({ origin }: { origin: AnswerOriginView }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState(origin.answer);
  const [draft, setDraft] = useState<string | null>(null);
  const [dropped, setDropped] = useState(false);
  const [pending, setPending] = useState(false);

  function reset(next = origin.answer) {
    setAnswer(next);
    setDraft(null);
    setDropped(false);
  }

  async function onUpdate() {
    setPending(true);
    try {
      const result = await reviseLibraryAnswer({
        originId: origin.id,
        decision: "yes",
        answer,
      });
      if (!result.ok) {
        toast.error(copy.dropped);
        return;
      }
      if (result.data.dropped || !result.data.text) {
        setDraft(null);
        setDropped(true);
        return;
      }
      setDropped(false);
      setDraft(result.data.text);
    } finally {
      setPending(false);
    }
  }

  async function onAccept() {
    if (!draft) return;
    setPending(true);
    try {
      const result = await applyLibraryRevision({
        originId: origin.id,
        text: draft,
        answer,
      });
      if (!result.ok) {
        setDropped(true);
        setDraft(null);
        return;
      }
      toast.success(copy.saved);
      setOpen(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function onNotYet() {
    setPending(true);
    try {
      const result = await reviseLibraryAnswer({
        originId: origin.id,
        decision: "not_yet",
        answer,
      });
      if (!result.ok) {
        toast.error(copy.dropped);
        return;
      }
      toast.success(copy.removed);
      setOpen(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="w-fit rounded-md text-left text-xs text-slate underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        {copy.tag}
        <span className="text-slate"> · {origin.answeredLabel}</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-5 sm:max-w-md">
          <DialogHeader className="pr-8">
            <DialogTitle className="font-sans text-base">{copy.edit}</DialogTitle>
          </DialogHeader>
          <p className="font-serif text-lg leading-snug text-ink">{origin.question}</p>
          <label className="grid gap-1.5 text-sm text-ink">
            {copy.answer}
            <Textarea
              value={answer}
              rows={3}
              onChange={(event) => setAnswer(event.target.value)}
            />
          </label>
          {dropped ? <p className="text-sm text-ink">{copy.dropped}</p> : null}
          {draft ? (
            <p className="rounded-lg border border-line bg-paper p-3 text-sm text-ink">{draft}</p>
          ) : null}
          <DialogFooter className="flex-row flex-wrap justify-end gap-2 border-0 bg-transparent p-0">
            <Button type="button" variant="outline" disabled={pending} onClick={() => void onNotYet()}>
              {copy.notYet}
            </Button>
            {draft ? (
              <Button type="button" disabled={pending} onClick={() => void onAccept()}>
                {copy.accept}
              </Button>
            ) : (
              <Button type="button" disabled={pending || answer.trim().length === 0} onClick={() => void onUpdate()}>
                {copy.save}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
