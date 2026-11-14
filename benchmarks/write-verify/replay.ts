/**
 * Free replay of a saved draft. No model call.
 * A is production validate plus composeModelLed.
 * B relaxes the split cap, counts the heading as evidence, and ignores spacing in tokens.
 * C is B, and it flags G4, G13, G16, and G12 instead of reverting them.
 */
import { assembleResumeContent } from "@/features/tailor/assemble";
import type { LibrarySnapshot } from "@/features/library/schemas";
import type { JobAnalysis } from "@/features/jobs/schemas";
import { resumePlainText } from "@/features/tailor/plainText";
import { pageCeiling, type ResumeContent, type TailorOutput } from "@/features/tailor/schemas";

import { guardDraft, type GuardFlag, type GuardMode } from "../lib/grounded-guard";
import { composeModelLed } from "../model-led/compose";
import { planRows } from "../model-led/pipeline";

export type Replay = {
  mode: GuardMode;
  content: ResumeContent;
  text: string;
  flags: GuardFlag[];
  reverts: number;
  issues: { code: string; ref: string }[];
  draftLines: { id: string; text: string }[];
};

export function replayDraft(input: {
  draft: TailorOutput;
  snapshot: LibrarySnapshot;
  analysis: JobAnalysis;
  mode: GuardMode;
}): Replay {
  const guard = guardDraft(input.draft, input.snapshot, input.analysis, input.mode);
  const composed = composeModelLed({
    output: guard.output,
    snapshot: input.snapshot,
    decisions: planRows(input.draft),
  });
  const headline = input.draft.plan?.headline?.trim() ?? "";
  const content = assembleResumeContent(composed.output, input.snapshot, sequence(), new Map(), {
    output: composed.output,
    sectionOrder: composed.sectionOrder,
    contacts: [],
    review: composed.review,
    presentation: {},
    stints: [],
    headline: headline.length > 0 ? headline.slice(0, 120) : null,
    pageLimit: pageCeiling("auto"),
  });
  return {
    mode: input.mode,
    content,
    text: resumePlainText(content, input.snapshot),
    flags: guard.flags,
    reverts: guard.reverts,
    issues: guard.issues,
    draftLines: draftLines(input.draft),
  };
}

export function applyReplacements(draft: TailorOutput, replacements: readonly { id: string; text: string }[]): TailorOutput {
  const byId = new Map(replacements.map((item) => [item.id, item.text]));
  const summary = draft.summary
    .split(/(?<=[.!?])\s+/)
    .map((sentence, index) => byId.get(`summary#${index}`) ?? sentence)
    .join(" ");
  return {
    ...draft,
    summary,
    entries: draft.entries.map((entry) => ({
      ...entry,
      bullets: entry.bullets.map((bullet, index) => ({
        ...bullet,
        text: byId.get(`${entry.ref}#${index}`) ?? bullet.text,
      })),
    })),
  };
}

/** A line that is still flagged after the one fix call is removed. The summary sentence is removed too. */
export function dropFlagged(draft: TailorOutput, flags: readonly GuardFlag[]): { draft: TailorOutput; dropped: GuardFlag[] } {
  const summaryFlags = new Set(flags.filter((flag) => flag.ref === "summary").map((flag) => flag.text.trim()));
  const lineFlags = new Set(flags.filter((flag) => flag.ref !== "summary").map((flag) => flag.text.trim()));
  const summary = draft.summary
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0 && !summaryFlags.has(sentence))
    .join(" ");
  return {
    draft: {
      ...draft,
      summary,
      entries: draft.entries.map((entry) => ({
        ...entry,
        bullets: entry.bullets.filter((bullet) => !lineFlags.has(bullet.text.trim())),
      })),
    },
    dropped: [...flags],
  };
}

export function flagRecords(
  draft: TailorOutput,
  flags: readonly GuardFlag[],
  snapshot: LibrarySnapshot,
): { id: string; text: string; code: string; token: string; sources: string }[] {
  const records: { id: string; text: string; code: string; token: string; sources: string }[] = [];
  const sentences = draft.summary.split(/(?<=[.!?])\s+/).map((sentence) => sentence.trim());
  for (const flag of flags) {
    if (flag.ref === "summary") {
      const index = sentences.findIndex((sentence) => sentence === flag.text.trim());
      records.push({
        id: `summary#${index >= 0 ? index : 0}`,
        text: flag.text,
        code: flag.code,
        token: flag.token,
        sources: librarySources(snapshot, []),
      });
      continue;
    }
    for (const entry of draft.entries) {
      const index = entry.bullets.findIndex((bullet) => bullet.text.trim() === flag.text.trim());
      if (index < 0) continue;
      const bullet = entry.bullets[index];
      if (!bullet) continue;
      records.push({
        id: `${entry.ref}#${index}`,
        text: flag.text,
        code: flag.code,
        token: flag.token,
        sources: librarySources(snapshot, bullet.sourceRefs),
      });
    }
  }
  return records;
}

function librarySources(snapshot: LibrarySnapshot, refs: readonly string[]): string {
  const parts: string[] = [];
  for (const ref of refs) {
    const entry = snapshot.entries.find((item) => item.ref === ref);
    if (entry) {
      parts.push(`${entry.ref} ${entry.title}${entry.organization ? ` | ${entry.organization}` : ""}`);
      for (const bullet of entry.bullets) parts.push(`${bullet.ref}: ${bullet.text}`);
      continue;
    }
    for (const item of snapshot.entries) {
      const bullet = item.bullets.find((candidate) => candidate.ref === ref);
      if (!bullet) continue;
      parts.push(`${item.ref} ${item.title}`);
      parts.push(`${bullet.ref}: ${bullet.text}`);
    }
  }
  if (parts.length === 0) {
    for (const entry of snapshot.entries) {
      parts.push(`${entry.ref} ${entry.title}`);
      for (const bullet of entry.bullets) parts.push(`${bullet.ref}: ${bullet.text}`);
    }
  }
  return parts.join("\n");
}

function draftLines(draft: TailorOutput): { id: string; text: string }[] {
  const lines = draft.summary
    .split(/(?<=[.!?])\s+/)
    .map((sentence, index) => ({ id: `summary#${index}`, text: sentence.trim() }))
    .filter((line) => line.text.length > 0);
  for (const entry of draft.entries) {
    entry.bullets.forEach((bullet, index) => {
      lines.push({ id: `${entry.ref}#${index}`, text: bullet.text });
    });
  }
  return lines;
}

function sequence(): () => string {
  let next = 1;
  return () => `write-verify-${next++}`;
}

export function bareAnalysis(job: string): JobAnalysis {
  const first = job.split("\n").map((line) => line.trim()).find((line) => line.length > 0) ?? "Role";
  return {
    title: first.slice(0, 120),
    company: "",
    location: null,
    seniority: "unknown",
    workMode: "UNKNOWN",
    employmentType: null,
    salary: null,
    referenceNumber: null,
    summary: "",
    requirements: [],
    keywords: [],
  };
}
