"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { openUpgradeModal } from "@/components/shell/upgrade-store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { strings } from "@/copy/strings";

import { addStrengthenedBullet, draftStrengthenedBullet, proposeStrengthQuestions } from "../wording-actions";

const copy = strings.library.assist;

type Answer = { question: string; yes: boolean; detail: string };

export function StrengthenPanel({ entryId }: { entryId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [followUp, setFollowUp] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [why, setWhy] = useState<string | null>(null);

  function start() {
    setOpen(true);
    setDraft(null);
    setWhy(null);
    setFollowUp(false);
    startTransition(async () => {
      const result = await proposeStrengthQuestions({ id: entryId });
      if (!result.ok) {
        if (result.error.code === "QUOTA_EXCEEDED") {
          toast.error(copy.allowance);
          openUpgradeModal({ kind: "plan" });
        } else toast.error(copy.failed);
        setOpen(false);
        return;
      }
      if (result.data.questions.length === 0) {
        toast.message(copy.unchanged);
        setOpen(false);
        return;
      }
      setAnswers(result.data.questions.map((question) => ({ question, yes: false, detail: "" })));
    });
  }

  function confirmedLines(): string[] {
    return answers
      .filter((answer) => answer.yes)
      .map((answer) => {
        const detail = answer.detail.trim();
        return detail.length > 0 ? `${answer.question} ${detail}` : answer.question;
      });
  }

  function submitAnswers() {
    const confirmed = confirmedLines();
    if (confirmed.length === 0) {
      toast.message(copy.nothingConfirmed);
      setOpen(false);
      return;
    }
    startTransition(async () => {
      const result = await draftStrengthenedBullet({
        entryId,
        confirmed,
        followUpRound: followUp,
      });
      if (!result.ok) {
        if (result.error.code === "QUOTA_EXCEEDED") {
          toast.error(copy.allowance);
          openUpgradeModal({ kind: "plan" });
        } else toast.error(copy.failed);
        return;
      }
      if (result.data.status === "followUps") {
        setFollowUp(true);
        setAnswers(result.data.questions.map((question) => ({ question, yes: false, detail: "" })));
        return;
      }
      if (result.data.status === "dropped") {
        toast.message(copy.dropped);
        return;
      }
      setDraft(result.data.text);
      setWhy(result.data.why);
    });
  }

  function addBullet() {
    if (!draft) return;
    startTransition(async () => {
      const result = await addStrengthenedBullet({
        entryId,
        text: draft,
        reason: why ?? "",
      });
      if (!result.ok) {
        toast.error(copy.failed);
        return;
      }
      toast.success(copy.added);
      setOpen(false);
      setDraft(null);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        className="text-xs text-pine underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        onClick={start}
      >
        {copy.strengthen}
      </button>
    );
  }

  return (
    <div className="mt-2 grid max-w-prose gap-2 rounded-md border border-line bg-surface px-3 py-2">
      <p className="text-sm font-medium text-ink">{followUp ? copy.followUp : copy.strengthenTitle}</p>
      <p className="text-xs text-slate">{copy.strengthenBody}</p>
      {pending && answers.length === 0 ? (
        <p className="text-xs text-slate" role="status">
          {copy.working}
        </p>
      ) : null}
      {draft ? (
        <>
          <Textarea value={draft} maxLength={400} rows={3} onChange={(event) => setDraft(event.target.value)} />
          {why ? <p className="text-xs text-ink">{why}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={pending} onClick={addBullet}>
              {copy.addBullet}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
              {copy.dismiss}
            </Button>
          </div>
        </>
      ) : (
        <>
          <ul className="grid gap-2">
            {answers.map((answer, index) => (
              <li key={answer.question} className="grid gap-1">
                <p className="text-sm text-ink">{answer.question}</p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={answer.yes ? "default" : "outline"}
                    onClick={() =>
                      setAnswers((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, yes: true } : item,
                        ),
                      )
                    }
                  >
                    {copy.yes}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={!answer.yes ? "default" : "outline"}
                    onClick={() =>
                      setAnswers((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, yes: false, detail: "" } : item,
                        ),
                      )
                    }
                  >
                    {copy.no}
                  </Button>
                </div>
                {answer.yes ? (
                  <input
                    value={answer.detail}
                    aria-label={copy.detail}
                    placeholder={copy.detail}
                    className="rounded-md border border-line bg-paper px-2 py-1 text-sm text-ink"
                    onChange={(event) =>
                      setAnswers((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, detail: event.target.value } : item,
                        ),
                      )
                    }
                  />
                ) : null}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={pending} onClick={submitAnswers}>
              {copy.useAnswers}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
              {copy.dismiss}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
