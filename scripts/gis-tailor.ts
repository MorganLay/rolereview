/**
 * The same analyze → tailor → guard → repair → revise → compose path as
 * scripts/compare-tailor.ts. Dev only. Does not save a job or a resume.
 * Counts do not use the account allowance.
 */
import { randomUUID } from "node:crypto";

import { postProcessAnalyze } from "@/features/jobs/analyze";
import { JobAnalysis, type JobAnalysis as Analysis } from "@/features/jobs/schemas";
import type { LibrarySnapshot } from "@/features/library/schemas";
import { libraryPromptText } from "@/features/library/serialize";
import { assembleResumeContent } from "@/features/tailor/assemble";
import { composeResume } from "@/features/tailor/compose";
import { sameRoleText } from "@/features/tailor/stints";
import { resumePlainText } from "@/features/tailor/plainText";
import {
  applyAcceptedRepairs,
  countRevertedBullets,
  mergeRepair,
  repairTargets,
} from "@/features/tailor/repair";
import {
  acceptEditorial,
  acceptRevision,
  editorialLibrary,
  mergeRevision,
  notesForAccepted,
  notesForEditorial,
  revisionRoute,
} from "@/features/tailor/revise";
import { preferSavedWording } from "@/features/tailor/variants";
import { validateTailorOutput } from "@/features/tailor/validate";
import {
  buildContent as buildAnalyzeContent,
  OutputSchema as AnalyzeSchema,
  SYSTEM as ANALYZE_SYSTEM,
} from "@/lib/ai/prompts/analyze";
import {
  buildRepairContent,
  RepairSchema,
  REPAIR_SYSTEM,
} from "@/lib/ai/prompts/tailor-repair";
import {
  buildEditorialContent,
  buildReviseContent,
  EDITORIAL_SYSTEM,
  EditorialSchema,
  ReviseSchema,
  REVISE_SYSTEM,
} from "@/lib/ai/prompts/tailor-revise";
import {
  buildContent as buildTailorContent,
  OutputSchema as TailorSchema,
  SYSTEM as TAILOR_SYSTEM,
} from "@/lib/ai/prompts/tailor";
import { runStructured } from "@/lib/ai/run";

import { exportGisPdf } from "./gis-export";

export type GisTailorRun = {
  ok: boolean;
  error: string | null;
  text: string;
  pages: number | null;
  /** True only when a PDF was written and its page count was read back. */
  exportOk: boolean;
  exportError: string | null;
  reverts: number;
  issues: { code: string; ref: string }[];
  gaps: string[];
  requirements: { text: string; verdict: string; note: string }[];
  calls: number;
};

export async function runGisTailor(input: {
  userId: string;
  snapshot: LibrarySnapshot;
  posting: string;
  fallbackTitle: string;
  fallbackCompany: string;
  pdfPath: string;
}): Promise<GisTailorRun> {
  const empty: GisTailorRun = {
    ok: false,
    error: null,
    text: "",
    pages: null,
    exportOk: false,
    exportError: null,
    reverts: 0,
    issues: [],
    gaps: [],
    requirements: [],
    calls: 0,
  };
  let calls = 0;
  const analyzed = await runStructured({
    kind: "ANALYZE",
    userId: input.userId,
    usedBonusCredit: false,
    countsTowardQuota: false,
    system: ANALYZE_SYSTEM,
    content: buildAnalyzeContent(input.posting),
    schema: AnalyzeSchema,
    refId: `gis-beta-${randomUUID()}`,
  });
  calls += 1;
  if (!analyzed.ok) return { ...empty, error: analyzed.code, calls };

  let analysis: Analysis;
  try {
    analysis = JobAnalysis.parse(postProcessAnalyze(analyzed.data, input.posting));
  } catch {
    return { ...empty, error: "ANALYSIS_SCHEMA", calls };
  }

  const generated = await runStructured({
    kind: "TAILOR",
    userId: input.userId,
    usedBonusCredit: false,
    countsTowardQuota: false,
    system: TAILOR_SYSTEM,
    content: buildTailorContent({
      libraryText: libraryPromptText(input.snapshot),
      title: analysis.title || input.fallbackTitle,
      company: analysis.company || input.fallbackCompany,
      seniority: analysis.seniority,
      requirements: analysis.requirements,
      keywords: analysis.keywords,
      posting: input.posting,
      length: 1,
      emphasis: null,
      sameRole: sameRoleText(input.snapshot.entries, input.snapshot.takenAt),
    }),
    schema: TailorSchema,
    refId: `gis-beta-${randomUUID()}`,
  });
  calls += 1;
  if (!generated.ok) return { ...empty, error: generated.code, calls };

  const prepared = preferSavedWording(generated.data, [], input.snapshot);
  let guard = validateTailorOutput(prepared.output, input.snapshot, analysis);
  let notes = prepared.why;
  const repairs = repairTargets(prepared.output, guard, input.snapshot);
  if (repairs.length > 0) {
    const repair = await runStructured({
      kind: "TAILOR",
      userId: input.userId,
      usedBonusCredit: false,
      countsTowardQuota: false,
      system: REPAIR_SYSTEM,
      content: buildRepairContent({
        title: analysis.title || input.fallbackTitle,
        company: analysis.company || input.fallbackCompany,
        requirements: analysis.requirements,
        targets: repairs,
      }),
      schema: RepairSchema,
      refId: `gis-beta-${randomUUID()}`,
    });
    calls += 1;
    const parsed = repair.ok ? RepairSchema.safeParse(repair.data) : null;
    if (parsed?.success) {
      const merged = mergeRepair(prepared.output, parsed.data.bullets, repairs);
      const second = validateTailorOutput(merged, input.snapshot, analysis);
      const chosen = applyAcceptedRepairs(guard.output, second.output, repairs);
      if (chosen.accepted.length > 0) {
        const summaryReverts = Math.max(0, guard.reverts - countRevertedBullets(guard.output));
        guard = {
          output: chosen.output,
          reverts: summaryReverts + countRevertedBullets(chosen.output),
          issues: guard.issues,
        };
      }
    }
  }

  const route = revisionRoute({
    output: guard.output,
    snapshot: input.snapshot,
    analysis,
  });
  let editorialApplied = false;
  if (route.kind === "editorial" && guard.output.plan) {
    const revised = await runStructured({
      kind: "TAILOR",
      userId: input.userId,
      usedBonusCredit: false,
      countsTowardQuota: false,
      system: EDITORIAL_SYSTEM,
      content: buildEditorialContent({
        title: analysis.title || input.fallbackTitle,
        company: analysis.company || input.fallbackCompany,
        length: 1,
        strategy: guard.output.plan,
        doubts: route.doubts,
        draft: guard.output.entries.map((entry) => ({
          ref: entry.ref,
          bullets: entry.bullets.map((bullet) => ({
            sourceRefs: bullet.sourceRefs,
            text: bullet.text,
          })),
        })),
        library: editorialLibrary({
          output: guard.output,
          snapshot: input.snapshot,
          targets: route.targets,
        }),
        sameRole: sameRoleText(input.snapshot.entries, input.snapshot.takenAt),
      }),
      schema: EditorialSchema,
      refId: `gis-beta-${randomUUID()}`,
    });
    calls += 1;
    const parsed = revised.ok ? EditorialSchema.safeParse(revised.data) : null;
    if (parsed?.success && parsed.data.changed) {
      const second = validateTailorOutput(
        {
          ...guard.output,
          summary: parsed.data.summary,
          entries: parsed.data.entries.map((entry) => ({
            ref: entry.ref,
            bullets: entry.bullets.map((bullet) => ({
              sourceRefs: bullet.sourceRefs,
              text: bullet.text,
            })),
          })),
          requirementMatches: guard.output.requirementMatches.map((match) => ({
            requirementId: match.requirementId,
            verdict: match.verdict === "unassessed" ? "missing" : match.verdict,
            evidenceRefs: [...match.evidenceRefs],
            note: match.note,
          })),
        },
        input.snapshot,
        analysis,
      );
      const chosen = acceptEditorial(guard.output, second.output);
      if (chosen.accepted && second.reverts <= guard.reverts) {
        editorialApplied = true;
        guard = { output: chosen.output, reverts: second.reverts, issues: second.issues };
        notes = notesForEditorial(notes, parsed.data.entries);
      }
    }
  }
  if (!editorialApplied && route.kind !== "none" && route.targets.length > 0) {
    const revised = await runStructured({
      kind: "TAILOR",
      userId: input.userId,
      usedBonusCredit: false,
      countsTowardQuota: false,
      system: REVISE_SYSTEM,
      content: buildReviseContent({
        title: analysis.title || input.fallbackTitle,
        company: analysis.company || input.fallbackCompany,
        targets: route.targets,
      }),
      schema: ReviseSchema,
      refId: `gis-beta-${randomUUID()}`,
    });
    calls += 1;
    if (revised.ok) {
      const merged = mergeRevision(guard.output, revised.data.entries, route.targets);
      const second = validateTailorOutput(merged.output, input.snapshot, analysis);
      const chosen = acceptRevision(
        guard.output,
        second.output,
        route.targets.map((target) => target.entryRef),
      );
      if (chosen.accepted.length > 0) {
        const summaryReverts = Math.max(0, guard.reverts - countRevertedBullets(guard.output));
        guard = {
          output: chosen.output,
          reverts: summaryReverts + countRevertedBullets(chosen.output),
          issues: guard.issues,
        };
        notes = notesForAccepted(notes, merged.notes, chosen.accepted, chosen.output);
      }
    }
  }

  const composition = composeResume({
    output: guard.output,
    snapshot: input.snapshot,
    analysis,
    length: 1,
  });
  const assembled = assembleResumeContent(
    composition.output,
    input.snapshot,
    () => randomUUID(),
    notes,
    composition,
  );
  const exported = await exportGisPdf({
    content: assembled,
    snapshot: input.snapshot,
    pdfPath: input.pdfPath,
  });
  if (exported.error) {
    console.error(`PDF export failed (${exported.error}).`);
  }

  const byId = new Map(analysis.requirements.map((item) => [item.id, item.text]));
  return {
    ok: true,
    error: null,
    text: exported.error ? resumePlainText(assembled, input.snapshot) : exported.text,
    pages: exported.pages,
    exportOk: exported.error === null && exported.pages !== null && exported.pages > 0,
    exportError: exported.error,
    reverts: guard.reverts,
    issues: guard.issues.map((issue) => ({ code: issue.code, ref: issue.ref })),
    gaps: guard.output.plan?.gaps ?? [],
    requirements: guard.output.requirementMatches.map((match) => ({
      text: byId.get(match.requirementId) ?? match.requirementId,
      verdict: match.verdict,
      note: match.note,
    })),
    calls,
  };
}
