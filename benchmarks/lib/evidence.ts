/**
 * Shared preflight for every benchmark arm.
 * A case is not sent when the normalized library drops material source text
 * or an include phrase is missing from either the original resume or that library.
 */
import { libraryPromptText } from "@/features/library/serialize";

import { equalEvidenceInput } from "./load";
import { phraseEquivalent } from "./phrases";
import { adaptFixtureResume, evidenceGaps } from "./snapshot";
import type { BenchmarkCase } from "./types";

type Adapted = ReturnType<typeof adaptFixtureResume>;

export type PreparedEvidence = {
  evidence: { resume: string; job: string };
  adapted: Adapted;
  libraryText: string;
};

export function prepareEvidence(testCase: BenchmarkCase): PreparedEvidence {
  const evidence = equalEvidenceInput(testCase);
  const adapted = adaptFixtureResume(evidence.resume);
  const gaps = evidenceGaps(adapted.snapshot, adapted.spans);
  if (gaps.length > 0) {
    const summary = gaps.map((gap) => `${gap.label} (${gap.text.length} characters)`).join(", ");
    throw new Error(`${testCase.id}: not sent. Material source text is missing from the library: ${summary}.`);
  }
  const libraryText = libraryPromptText(adapted.snapshot);
  const uneven = testCase.includeEvidence.filter(
    (phrase) => !phraseEquivalent(evidence.resume, phrase) || !phraseEquivalent(libraryText, phrase),
  );
  if (uneven.length > 0) {
    throw new Error(
      `${testCase.id}: not sent. An include phrase is missing from the resume or the normalized library: ${uneven.join("; ")}.`,
    );
  }
  return { evidence, adapted, libraryText };
}

/** An include phrase that the fitted resume lost and a removed line still contains. */
export function includeLostToFitting(input: {
  fittedText: string;
  dropped: readonly string[];
  includeEvidence: readonly string[];
}): string[] {
  return input.includeEvidence.filter(
    (phrase) => !phraseEquivalent(input.fittedText, phrase) && input.dropped.some((line) => phraseEquivalent(line, phrase)),
  );
}
