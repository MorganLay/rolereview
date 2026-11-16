import { reviewDraftLine } from "@/features/questions/draft-guard";
import { selectJobQuestions } from "@/features/questions/filter";
import { topicKey } from "@/features/questions/topic-key";

import { QUESTION_CASES, type QuestionCase } from "./cases";

export type OfflineResult = {
  id: string;
  kept: string[];
  expected: string[];
  pass: boolean;
};

export function runOfflineCases(cases: readonly QuestionCase[] = QUESTION_CASES): OfflineResult[] {
  return cases.map((item) => {
    const known = new Set(item.known.map((topic) => topicKey(topic.subject, topic.entryId)));
    const selected = selectJobQuestions({
      proposed: item.proposed,
      requirements: item.requirements,
      entries: item.entries,
      libraryText: item.libraryText,
      postingText: item.postingText,
      knownTopicKeys: known,
    });
    const kept = selected.map((question) => question.question);
    const draftsPass =
      item.drafts?.every(
        (draft) =>
          reviewDraftLine({
            text: draft.text,
            answer: draft.answer,
            evidence: item.entries.flatMap((entry) => entry.bullets),
            kind: "role",
          }).ok === draft.allow,
      ) ?? true;
    const pass =
      draftsPass && kept.length === item.kept.length && kept.every((question, index) => question === item.kept[index]);
    return { id: item.id, kept, expected: item.kept, pass };
  });
}
