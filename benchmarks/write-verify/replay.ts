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

/**
 * Saved drafts cite the refs from the run that produced them.
 * The corrected adapter can renumber those refs. Match the old library text
 * onto the new snapshot before the draft is checked again.
 */
export function remapSavedDraft(draft: TailorOutput, snapshot: LibrarySnapshot, libraryText: string): TailorOutput {
  const oldBullets = new Map<string, string>();
  const oldSkills = new Map<string, string>();
  for (const line of libraryText.split("\n")) {
    const bullet = line.match(/^ {2}(E\d+\.B\d+) id=[^:]+: (.*)$/);
    if (bullet?.[1] && bullet[2]) oldBullets.set(bullet[1], bullet[2].trim());
    const skill = line.match(/^ {2}(S\d+) id=[^:]+: (.*)$/);
    if (skill?.[1] && skill[2]) oldSkills.set(skill[1], skill[2].trim());
  }
  const bulletRefs = new Map<string, string>();
  for (const [ref, text] of oldBullets) {
    for (const entry of snapshot.entries) {
      const match = entry.bullets.find((item) => item.text.trim() === text);
      if (match) bulletRefs.set(ref, match.ref);
    }
  }
  const skillRefs = new Map<string, string>();
  for (const [ref, name] of oldSkills) {
    const match = snapshot.skills.find((skill) => skill.name.trim() === name || (skill.category ? `${skill.name} (${skill.category})` === name : false));
    if (match) skillRefs.set(ref, match.ref);
  }
  const known = (ref: string) => snapshot.entries.some((entry) => entry.ref === ref || entry.bullets.some((bullet) => bullet.ref === ref));
  const grouped = new Map<string, TailorOutput["entries"][number]["bullets"]>();
  for (const entry of draft.entries) {
    for (const bullet of entry.bullets) {
      const refs = bullet.sourceRefs.map((ref) => bulletRefs.get(ref) ?? (known(ref) ? ref : null)).filter((ref): ref is string => ref !== null);
      const entryRef = refs[0]?.split(".")[0] ?? (known(entry.ref) ? entry.ref : null);
      if (!entryRef) continue;
      const list = grouped.get(entryRef) ?? [];
      list.push({ ...bullet, sourceRefs: refs.length > 0 ? refs : [entryRef] });
      grouped.set(entryRef, list);
    }
  }
  return {
    ...draft,
    entries: [...grouped.entries()].map(([ref, bullets]) => ({ ref, bullets })),
    skills: draft.skills
      .map((group) => ({
        ...group,
        refs: group.refs
          .map((ref) => skillRefs.get(ref) ?? (snapshot.skills.some((skill) => skill.ref === ref) ? ref : null))
          .filter((ref): ref is string => ref !== null),
      }))
      .filter((group) => group.refs.length > 0),
  };
}

/** A fact that lives on another library entry moves there. It is not deleted. */
export function moveWrongEntry(
  draft: TailorOutput,
  flags: readonly GuardFlag[],
): { draft: TailorOutput; moved: GuardFlag[] } {
  const moves = flags.filter((flag) => flag.code === "wrong-entry" && flag.home && !flag.home.startsWith("S") && flag.ref !== "summary");
  if (moves.length === 0) return { draft, moved: [] };
  const entries = draft.entries.map((entry) => ({ ...entry, bullets: [...entry.bullets] }));
  for (const flag of moves) {
    const homeRef = flag.home ?? "";
    for (const entry of entries) {
      entry.bullets = entry.bullets.filter((bullet) => bullet.text.trim() !== flag.text.trim());
    }
    let home = entries.find((entry) => entry.ref === homeRef);
    if (!home) {
      home = { ref: homeRef, bullets: [] };
      entries.push(home);
    }
    if (!home.bullets.some((bullet) => bullet.text.trim() === flag.text.trim())) {
      home.bullets.push({ sourceRefs: [homeRef], text: flag.text });
    }
  }
  return { draft: { ...draft, entries }, moved: [...moves] };
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
