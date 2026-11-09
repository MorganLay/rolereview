"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { openUpgradeModal } from "@/components/shell/upgrade-store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { strings } from "@/copy/strings";

import {
  confirmedFromAnswers,
  mergeConfirmed,
  type StrengthenAnswer,
} from "../strengthen-confirm";
import {
  addStrengthenedBullet,
  draftStrengthenedBullet,
  proposeStrengthQuestions,
} from "../wording-actions";

const copy = strings.library.assist;
const entryCopy = strings.library.entries;

export function StrengthenPanel({ entryId }: { entryId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [answers, setAnswers] = useState<StrengthenAnswer[]>([]);
  const [priorConfirmed, setPriorConfirmed] = useState<string[]>([]);
  const [followUp, setFollowUp] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [why, setWhy] = useState<string | null>(null);

  function reset() {
    setOpen(false);
    setAnswers([]);
    setPriorConfirmed([]);
    setFollowUp(false);
    setDraft(null);
    setWhy(null);
  }

  function start() {
    setOpen(true);
    setDraft(null);
    setWhy(null);
    setFollowUp(false);
    setPriorConfirmed([]);
    setAnswers([]);
    startTransition(async () => {
      const result = await proposeStrengthQuestions({ id: entryId });
      if (!result.ok) {
        if (result.error.code === "QUOTA_EXCEEDED") {
          toast.error(copy.allowance);
          openUpgradeModal({ kind: "plan" });
        } else toast.error(copy.failed);
        reset();
        return;
      }
      if (result.data.questions.length === 0) {
        toast.message(copy.unchanged);
        reset();
        return;
      }
      setAnswers(
        result.data.questions.map((question) => ({ question, yes: null, detail: "" })),
      );
    });
  }

  function submitAnswers() {
    const round = confirmedFromAnswers(answers);
    if (round.length === 0 && priorConfirmed.length === 0) {
      toast.message(copy.nothingConfirmed);
      reset();
      return;
    }
    const confirmed = mergeConfirmed(priorConfirmed, round);
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
        setPriorConfirmed(confirmed);
        setFollowUp(true);
        setAnswers(
          result.data.questions.map((question) => ({ question, yes: null, detail: "" })),
        );
        return;
      }
      if (result.data.status === "dropped") {
        toast.message(
          result.data.reason === "empty" ? copy.strengthenEmpty : copy.strengthenDropped,
        );
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
      reset();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        className="inline-flex min-h-8 items-center text-[0.8125rem] font-medium text-pine underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        onClick={start}
      >
        {entryCopy.explore}
      </button>
    );
  }

  return (
    <div className="w-full max-w-prose grid gap-3 rounded-md border border-line bg-paper px-3.5 py-3">
      <div className="grid gap-1">
        <p className="text-sm font-medium text-ink">
          {draft ? copy.suggestion : followUp ? copy.followUp : copy.strengthenTitle}
        </p>
        {!draft ? (
          <p className="text-[0.8125rem] leading-relaxed text-slate">{copy.strengthenBody}</p>
        ) : null}
      </div>
      {pending && answers.length === 0 && !draft ? (
        <p className="text-[0.8125rem] text-slate" role="status">
          {copy.working}
        </p>
      ) : null}
      {draft ? (
        <>
          <div className="grid gap-1.5">
            <Textarea
              value={draft}
              maxLength={400}
              rows={3}
              className="bg-surface text-sm leading-relaxed"
              onChange={(event) => setDraft(event.target.value)}
            />
          </div>
          {why ? (
            <p className="text-[0.8125rem] leading-relaxed text-ink">
              <span className="font-medium">{copy.why}. </span>
              {why}
            </p>
          ) : null}
          <p className="text-[0.75rem] leading-relaxed text-slate">{copy.editHint}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={pending} onClick={addBullet}>
              {copy.addBullet}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={reset}>
              {copy.dismiss}
            </Button>
          </div>
        </>
      ) : (
        <>
          <ul className="grid gap-3.5">
            {answers.map((answer, index) => (
              <li key={answer.question} className="grid gap-2">
                <p className="text-sm leading-relaxed text-ink">{answer.question}</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={answer.yes === true ? "default" : "outline"}
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
                    variant={answer.yes === false ? "default" : "outline"}
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
                {answer.yes === true ? (
                  <input
                    value={answer.detail}
                    aria-label={copy.detail}
                    placeholder={copy.detail}
                    className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm text-ink focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
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
            <Button type="button" size="sm" variant="outline" onClick={reset}>
              {copy.dismiss}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
