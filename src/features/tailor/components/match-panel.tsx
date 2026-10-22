"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { strings } from "@/copy/strings";
import type { Requirement } from "@/features/jobs/schemas";
import type { LibrarySnapshot } from "@/features/library/schemas";
import type { LibraryEntryOption } from "@/features/tailor/content";
import { evidenceLinks } from "@/features/tailor/evidence";
import { keywordCoverage } from "@/features/tailor/keywords";
import type { RequirementVerdict, ResumeContent } from "@/features/tailor/schemas";
import { cn } from "@/lib/utils";

import { QuickAddBulletDialog } from "./quick-add-bullet-dialog";

const copy = strings.jobs.workspace;
const scoreCopy = strings.jobs.documents;
const resultCopy = strings.jobs.result;
const statusCopy = strings.status;

const verdictMark = {
  met: "✓",
  partial: "◐",
  missing: "✗",
} as const;

const verdictClass = {
  met: "text-pine",
  partial: "text-marigold-700",
  missing: "text-clay",
} as const;

export function MatchPanel({
  content,
  snapshot,
  score,
  verdicts,
  requirements,
  keywords,
  libraryEntries,
  jobId,
  onEvidence,
  readOnly = false,
  revealCount,
  headingLevel = "h2",
}: {
  content: ResumeContent;
  snapshot: LibrarySnapshot;
  score: number | null;
  verdicts: readonly RequirementVerdict[];
  requirements: readonly Requirement[];
  keywords: readonly string[];
  libraryEntries: readonly LibraryEntryOption[];
  jobId: string;
  onEvidence: (elementId: string) => void;
  readOnly?: boolean;
  /** Requirements at this index and after stay pending. Omit to show every verdict. */
  revealCount?: number;
  headingLevel?: "h2" | "h3";
}) {
  const [adding, setAdding] = useState<Requirement | null>(null);
  const scoreId = useId();
  const keywordId = useId();
  const coverage = keywordCoverage(content, snapshot, keywords);
  const ScoreHeading = headingLevel;

  return (
    <div className="flex flex-col gap-6 rounded-lg border border-line bg-surface p-4">
      <section className="flex flex-col gap-3" aria-labelledby={scoreId}>
        <ScoreHeading id={scoreId} className="text-base font-medium tabular-nums text-ink">
          {score === null ? scoreCopy.matchScoreEmpty : scoreCopy.matchScore(score)}
        </ScoreHeading>
        {requirements.length === 0 ? (
          <p className="text-sm text-slate">{copy.noRequirements}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {requirements.map((requirement, index) => {
              const verdict = verdictFor(requirement.id, verdicts);
              const pending = revealCount !== undefined && index >= revealCount;
              const links = evidenceLinks(verdict.evidenceRefs, content, snapshot);
              return (
                <li key={requirement.id} className="grid gap-1 border-t border-line pt-3">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-sm font-medium",
                        pending ? "text-slate" : verdictClass[verdict.verdict],
                      )}
                    >
                      <span aria-hidden>{pending ? "○" : verdictMark[verdict.verdict]}</span>
                      {pending ? copy.pending : statusCopy[verdict.verdict]}
                    </span>
                    <span className="text-xs text-slate">
                      {requirement.importance === "must" ? resultCopy.must : resultCopy.nice}
                    </span>
                  </div>
                  <p className="text-sm break-words text-ink">{requirement.text}</p>
                  {!pending && verdict.note ? (
                    <p className="text-sm break-words text-slate">{verdict.note}</p>
                  ) : null}
                  {!pending && links.length > 0 ? (
                    <ul className="flex flex-col gap-1">
                      {links.map((link) => {
                        const label = link.label.trim() || copy.untitled;
                        return (
                          <li key={link.ref}>
                            <button
                              type="button"
                              className="rounded-md text-left text-sm break-words text-pine underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                              aria-label={copy.showEvidence(label)}
                              onClick={() => onEvidence(link.elementId)}
                            >
                              {label}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                  {!readOnly && verdict.verdict === "missing" && !pending ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-1 w-fit"
                      aria-label={copy.addToLibraryFor(requirement.text)}
                      onClick={() => setAdding(requirement)}
                    >
                      {copy.addToLibrary}
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby={keywordId}>
        <ScoreHeading id={keywordId} className="text-base font-medium text-ink">
          {copy.keywordCoverage}{" "}
          <span className="tabular-nums">{copy.keywordPct(coverage.pct)}</span>
        </ScoreHeading>
        {keywords.length === 0 ? (
          <p className="text-sm text-slate">{resultCopy.noKeywords}</p>
        ) : (
          <div className="flex flex-col gap-3">
            <KeywordChips heading={copy.covered} keywords={coverage.covered} tone="covered" />
            <KeywordChips
              heading={copy.missingKeywords}
              keywords={coverage.missing}
              tone="missing"
            />
          </div>
        )}
      </section>

      {readOnly ? null : (
        <QuickAddBulletDialog
          key={adding?.id ?? "closed"}
          requirement={adding}
          entries={libraryEntries}
          jobId={jobId}
          open={adding !== null}
          onOpenChange={(open) => {
            if (!open) setAdding(null);
          }}
        />
      )}
    </div>
  );
}

function KeywordChips({
  heading,
  keywords,
  tone,
}: {
  heading: string;
  keywords: readonly string[];
  tone: "covered" | "missing";
}) {
  if (keywords.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-slate">{heading}</p>
      <ul className="flex flex-wrap gap-2">
        {keywords.map((keyword, index) => (
          <li
            key={`${keyword}-${index}`}
            className={cn(
              "max-w-full rounded-full px-2.5 py-0.5 text-xs break-words text-ink",
              tone === "covered" ? "bg-pine-50" : "border border-clay",
            )}
          >
            {keyword}
          </li>
        ))}
      </ul>
    </div>
  );
}

function verdictFor(
  requirementId: string,
  verdicts: readonly RequirementVerdict[],
): RequirementVerdict {
  return (
    verdicts.find((item) => item.requirementId === requirementId) ?? {
      requirementId,
      verdict: "missing",
      evidenceRefs: [],
      note: copy.notAssessed,
    }
  );
}
