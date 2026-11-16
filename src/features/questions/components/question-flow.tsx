"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { strings } from "@/copy/strings";
import { TailorDialog } from "@/features/tailor/components/tailor-dialog";
import { tailorResume } from "@/features/tailor/actions";
import type { ResumeLengthChoice } from "@/features/tailor/schemas";
import { cn } from "@/lib/utils";

import {
  draftJobAnswers,
  saveAcceptedLines,
  saveFollowUp,
  saveJobAnswer,
} from "../actions";
import type { JobQuestionView } from "../view";

const copy = strings.jobs.questions;
const DETAIL = new Set(["detail", "scale", "outcome", "role"]);

export function QuestionFlow({
  jobId,
  questions,
  startId,
  review,
  saved,
  canTailor,
  savedIds = [],
}: {
  jobId: string;
  questions: JobQuestionView[];
  startId: string | null;
  review: boolean;
  saved: boolean;
  canTailor: boolean;
  savedIds?: readonly string[];
}) {
  const initial = Math.max(
    0,
    questions.findIndex((question) => question.requirementId === startId),
  );
  if (saved) return <Saved jobId={jobId} questions={questions} />;
  if (review) {
    return (
      <Review
        jobId={jobId}
        questions={questions.filter((question) => !savedIds.includes(question.id))}
        canTailor={canTailor}
      />
    );
  }
  return <Stepper jobId={jobId} questions={questions} initial={initial < 0 ? 0 : initial} />;
}

function Saved({ jobId, questions }: { jobId: string; questions: JobQuestionView[] }) {
  const router = useRouter();
  const lines = questions.filter((question) => question.status === "YES" && question.draftText);
  const declined = questions.filter((question) => question.status === "NOT_YET");
  const [detail, setDetail] = useState<Record<string, string>>({});
  return (
    <section className="grid gap-3">
      <h1 className="font-serif text-2xl text-ink">{copy.addTitle}</h1>
      <p className="text-sm text-ink">{copy.added(lines.length)}</p>
      <ul className="grid gap-2">
        {lines.map((line) => (
          <li key={line.id} className="rounded-lg border border-line bg-surface p-4 text-sm text-ink">
            {line.draftText}
            <p className="mt-1 text-xs text-slate">{copy.fromAnswer}</p>
          </li>
        ))}
      </ul>
      {declined.length > 0 ? (
        <ul className="grid gap-3">
          {declined.map((question) => (
            <li key={question.id} className="rounded-lg border border-line bg-surface p-4">
              <p className="font-serif text-lg text-ink">{question.question}</p>
              <p className="mt-1 text-xs text-slate">{copy.notYet}</p>
              <Textarea
                className="mt-2"
                rows={3}
                value={detail[question.id] ?? ""}
                onChange={(event) =>
                  setDetail((current) => ({ ...current, [question.id]: event.target.value }))
                }
              />
              <Button
                type="button"
                className="mt-2"
                onClick={() => {
                  void saveJobAnswer({
                    questionId: question.id,
                    status: "YES",
                    detail: detail[question.id] ?? "",
                  }).then((result) => {
                    if (!result.ok) {
                      toast.error(copy.detailNeeded);
                      return;
                    }
                    router.push(`/jobs/${jobId}/questions?view=review`);
                    router.refresh();
                  });
                }}
              >
                {copy.yes}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <a href="/library" className="text-sm text-pine underline-offset-4 hover:underline">
        {strings.nav.library}
      </a>
    </section>
  );
}

function Stepper({
  jobId,
  questions,
  initial,
}: {
  jobId: string;
  questions: JobQuestionView[];
  initial: number;
}) {
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [index, setIndex] = useState(initial);
  const [rows, setRows] = useState(questions);
  const [pending, setPending] = useState(false);
  const current = rows[index];

  useEffect(() => {
    headingRef.current?.focus();
  }, [index]);

  if (!current) return null;
  const step = current;
  const detailRequired = step.status === "YES" && DETAIL.has(step.kind);
  const blocked = detailRequired && current.detail.trim().length === 0;

  async function choose(status: "YES" | "NOT_YET" | "SKIPPED") {
    setRows((items) =>
      items.map((item) =>
        item.id === step.id
          ? { ...item, status, detail: status === "YES" ? item.detail : "" }
          : item,
      ),
    );
    if (status !== "YES") {
      setPending(true);
      const result = await saveJobAnswer({ questionId: step.id, status });
      setPending(false);
      if (!result.ok) toast.error(strings.jobs.saveFailed);
    }
  }

  async function go(nextIndex: number) {
    if (step.status === "YES") {
      if (blocked) {
        toast.error(copy.detailNeeded);
        return;
      }
      setPending(true);
      const result = await saveJobAnswer({
        questionId: step.id,
        status: "YES",
        detail: step.detail,
      });
      setPending(false);
      if (!result.ok) {
        toast.error(copy.detailNeeded);
        return;
      }
    }
    if (nextIndex >= rows.length) {
      router.push(`/jobs/${jobId}/questions?view=review`);
      return;
    }
    setIndex(nextIndex);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void go(index + 1);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-start">
      <ol className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible" aria-label={copy.listLabel}>
        {rows.map((question, step) => (
          <li key={question.id} className="shrink-0">
            <button
              type="button"
              className={cn(
                "rounded-lg px-2 py-1 text-left text-sm",
                step === index ? "bg-pine-50 text-ink" : "text-slate hover:text-ink",
              )}
              aria-current={step === index ? "step" : undefined}
              onClick={() => setIndex(step)}
            >
              <span className="lg:hidden">{step + 1}</span>
              <span className="hidden lg:inline">{question.question}</span>
            </button>
          </li>
        ))}
      </ol>
      <section
        className="rounded-lg border border-line bg-surface p-4 sm:p-5"
        onKeyDown={(event) => {
          if (event.key === "Enter" && event.target === event.currentTarget) void go(index + 1);
        }}
      >
        <p className="text-sm text-slate tabular-nums">{copy.progress(index + 1, rows.length)}</p>
        <p className="mt-3 w-fit rounded-full bg-marigold-100 px-2.5 py-0.5 text-sm text-ink">
          {current.why}
        </p>
        {current.about ? <p className="mt-2 text-sm text-slate">{copy.about(current.about)}</p> : null}
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mt-4 font-serif text-xl leading-snug text-ink outline-none"
        >
          {current.question}
        </h1>
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={current.question}>
          <Choice label={copy.yes} selected={current.status === "YES"} onClick={() => void choose("YES")} />
          <Choice label={copy.notYet} selected={current.status === "NOT_YET"} onClick={() => void choose("NOT_YET")} />
          <Choice label={copy.skipOne} selected={current.status === "SKIPPED"} onClick={() => void choose("SKIPPED")} />
        </div>
        {index === 0 ? <p className="mt-3 text-sm text-slate">{copy.honesty}</p> : null}
        {current.status === "YES" ? (
          <label className="mt-4 grid gap-1.5 text-sm text-ink">
            {copy.prompt}
            <Textarea
              rows={3}
              value={current.detail}
              onChange={(event) =>
                setRows((items) =>
                  items.map((item) =>
                    item.id === current.id ? { ...item, detail: event.target.value } : item,
                  ),
                )
              }
              onKeyDown={onKeyDown}
            />
            <span className="text-xs text-slate">{copy.tip}</span>
          </label>
        ) : null}
        <div className="mt-6 flex items-center justify-end gap-3">
          <Button type="button" variant="outline" disabled={index === 0 || pending} onClick={() => setIndex(index - 1)}>
            {copy.back}
          </Button>
          <Button type="button" disabled={pending} onClick={() => void go(index + 1)}>
            {index === rows.length - 1 ? copy.reviewAction : copy.next}
          </Button>
        </div>
      </section>
    </div>
  );
}

function Choice({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <Button type="button" variant={selected ? "default" : "outline"} onClick={onClick}>
      {label}
    </Button>
  );
}

function includedDrafts(questions: readonly JobQuestionView[]): Record<string, boolean> {
  return Object.fromEntries(
    questions.map((row) => [row.id, !row.draftDropped && Boolean(row.draftText)]),
  );
}

function needsDraft(questions: readonly JobQuestionView[]): boolean {
  return questions.some(
    (row) => !row.draftText && !row.draftDropped && !(row.followUp && row.followUpDetail.trim().length === 0),
  );
}

function Review({
  jobId,
  questions,
  canTailor,
}: {
  jobId: string;
  questions: JobQuestionView[];
  canTailor: boolean;
}) {
  const router = useRouter();
  const yesQuestions = questions.filter((question) => question.status === "YES");
  const serverKey = yesQuestions
    .map((row) =>
      [row.id, row.draftText ?? "", row.draftDropped, row.followUp ?? "", row.followUpDetail].join(":"),
    )
    .join("|");
  const [seenKey, setSeenKey] = useState(serverKey);
  const [rows, setRows] = useState(yesQuestions);
  const [included, setIncluded] = useState<Record<string, boolean>>(() => includedDrafts(yesQuestions));
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, setPending] = useState(() => needsDraft(yesQuestions));
  const [tailorOpen, setTailorOpen] = useState(false);
  const started = useRef(false);

  if (seenKey !== serverKey) {
    setSeenKey(serverKey);
    setRows(yesQuestions);
    setIncluded(includedDrafts(yesQuestions));
    setPending(false);
  }

  const waitingForDraft = needsDraft(rows);
  const needsFollowUp = rows.some((row) => row.followUp && row.followUpDetail.trim().length === 0);

  useEffect(() => {
    if (started.current || !waitingForDraft || needsFollowUp) return;
    started.current = true;
    void draftJobAnswers({ jobId, followUpRound: false }).then(() => {
      setPending(false);
      router.refresh();
    });
  }, [jobId, waitingForDraft, needsFollowUp, router]);

  const accepted = rows.filter((row) => included[row.id] && row.draftText && !row.draftDropped);

  async function save(thenTailor: { length: ResumeLengthChoice; emphasis: string } | null) {
    if (accepted.length === 0) {
      toast.error(copy.noneAccepted);
      return;
    }
    setPending(true);
    const result = await saveAcceptedLines({
      jobId,
      lines: accepted.map((row) => ({
        questionId: row.id,
        text: row.draftText ?? "",
        include: true,
      })),
    });
    if (!result.ok) {
      setPending(false);
      toast.error(strings.jobs.saveFailed);
      return;
    }
    if (result.data.dropped.length > 0) {
      setPending(false);
      setRows((items) =>
        items.map((item) =>
          result.data.dropped.includes(item.id)
            ? { ...item, draftText: null, draftDropped: true }
            : item,
        ),
      );
      return;
    }
    if (!thenTailor) {
      setPending(false);
      toast.success(copy.saved(result.data.saved));
      router.push(`/jobs/${jobId}?tab=documents`);
      return;
    }
    const tailored = await tailorResume({
      jobId,
      length: thenTailor.length,
      emphasis: thenTailor.emphasis,
    });
    setPending(false);
    if (!tailored.ok) {
      toast.error(strings.jobs.documents.aiFailed);
      router.push(`/jobs/${jobId}?tab=documents`);
      return;
    }
    router.push(`/jobs/${jobId}/resumes/${tailored.data.resumeId}`);
  }

  if (pending && rows.every((row) => !row.draftText && !row.followUp)) {
    return <p className="text-sm text-slate">{copy.preparing}</p>;
  }

  if (needsFollowUp) {
    return (
      <section className="rounded-lg border border-line bg-surface p-4 sm:p-5">
        <h1 className="font-serif text-2xl text-ink">{copy.followUp}</h1>
        <ul className="mt-4 grid gap-4">
          {rows
            .filter((row) => row.followUp && row.followUpDetail.trim().length === 0)
            .map((row) => (
              <li key={row.id} className="grid gap-2">
                <p className="font-serif text-lg text-ink">{row.followUp}</p>
                <Textarea
                  rows={3}
                  value={row.followUpDetail}
                  onChange={(event) =>
                    setRows((items) =>
                      items.map((item) =>
                        item.id === row.id ? { ...item, followUpDetail: event.target.value } : item,
                      ),
                    )
                  }
                />
              </li>
            ))}
        </ul>
        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            disabled={pending}
            onClick={() => {
              setPending(true);
              void (async () => {
                for (const row of rows) {
                  if (!row.followUp || row.followUpDetail.trim().length === 0) continue;
                  await saveFollowUp({ questionId: row.id, detail: row.followUpDetail });
                }
                await draftJobAnswers({ jobId, followUpRound: true });
                setPending(false);
                router.refresh();
              })();
            }}
          >
            {copy.continue}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="grid gap-4">
      <h1 className="font-serif text-2xl text-ink">{copy.addTitle}</h1>
      <ul className="grid gap-3">
        {rows.map((row) => (
          <li key={row.id} className="rounded-lg border border-line bg-surface p-4">
            <p className="text-xs text-slate">
              {copy.destination}: {row.destinationLabel ?? row.about ?? "Library"}
            </p>
            {row.draftDropped || !row.draftText ? (
              <div className="mt-2 grid gap-2">
                <p className="text-sm text-ink">{copy.dropped}</p>
                <Textarea
                  rows={3}
                  value={row.detail}
                  onChange={(event) =>
                    setRows((items) =>
                      items.map((item) =>
                        item.id === row.id ? { ...item, detail: event.target.value } : item,
                      ),
                    )
                  }
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-fit"
                  disabled={pending}
                  onClick={() => {
                    setPending(true);
                    void (async () => {
                      await saveJobAnswer({ questionId: row.id, status: "YES", detail: row.detail });
                      await draftJobAnswers({ jobId, followUpRound: false });
                      setPending(false);
                      router.refresh();
                    })();
                  }}
                >
                  {copy.updateAnswer}
                </Button>
              </div>
            ) : (
              <>
                <Textarea
                  className="mt-2"
                  rows={3}
                  readOnly={editing !== row.id}
                  value={row.draftText}
                  onChange={(event) =>
                    setRows((items) =>
                      items.map((item) =>
                        item.id === row.id ? { ...item, draftText: event.target.value } : item,
                      ),
                    )
                  }
                />
                <p className="mt-1 text-xs text-slate">{copy.fromAnswer}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={included[row.id] ? "default" : "outline"}
                    onClick={() => setIncluded((current) => ({ ...current, [row.id]: true }))}
                  >
                    {copy.accept}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setEditing(row.id)}>
                    {copy.edit}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIncluded((current) => ({ ...current, [row.id]: false }))}
                  >
                    {copy.discard}
                  </Button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="outline" disabled={pending} onClick={() => void save(null)}>
          {copy.saveOnly}
        </Button>
        {canTailor ? (
          <Button type="button" disabled={pending} onClick={() => setTailorOpen(true)}>
            {copy.saveTailor(accepted.length)}
          </Button>
        ) : null}
      </div>
      <TailorDialog
        open={tailorOpen}
        onOpenChange={setTailorOpen}
        onConfirm={async (input) => {
          setTailorOpen(false);
          await save(input);
        }}
      />
    </section>
  );
}
