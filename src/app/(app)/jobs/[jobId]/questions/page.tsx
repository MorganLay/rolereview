import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { strings } from "@/copy/strings";
import { QuestionFlow } from "@/features/questions/components/question-flow";
import { getQuestionCard, listJobQuestions, savedQuestionIds } from "@/features/questions/queries";
import { getJobDocuments } from "@/features/tailor/queries";
import { requireUser } from "@/lib/auth";
import { jobQuestionsEnabled } from "@/lib/env";

export const metadata: Metadata = {
  title: strings.jobs.questions.start,
  description: strings.jobs.questions.body,
};

export const maxDuration = 120;
export const instant = false;

export default async function JobQuestionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ jobId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  if (!jobQuestionsEnabled()) notFound();
  const { jobId } = await params;
  const query = await searchParams;
  const user = await requireUser();
  const [questions, card, documents, savedIds] = await Promise.all([
    listJobQuestions(user.id, jobId),
    getQuestionCard(user.id, jobId),
    getJobDocuments(user.id, user.plan, jobId),
    savedQuestionIds(user.id, jobId),
  ]);
  if (!questions || questions.length === 0) notFound();
  const requirement = queryValue(query.requirement) ?? null;
  const unsavedYes = questions.some(
    (question) => question.status === "YES" && !savedIds.includes(question.id),
  );
  const showSaved = card?.phase === "saved" && !unsavedYes;
  const review =
    !showSaved &&
    (queryValue(query.view) === "review" || card?.phase === "review");

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-4">
      <Link href={`/jobs/${jobId}?tab=documents`} className="text-sm text-pine underline-offset-4 hover:underline">
        {strings.jobs.questions.back}
      </Link>
      <QuestionFlow
        jobId={jobId}
        questions={questions}
        startId={requirement}
        review={review}
        saved={showSaved}
        canTailor={documents.canTailor}
        savedIds={savedIds}
      />
    </div>
  );
}

function queryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
