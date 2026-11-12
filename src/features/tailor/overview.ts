/**
 * Tailoring overview for the resume workspace.
 * Counts and reasons come from the resume on screen, the library snapshot,
 * and requirement ids that exist on the job analysis. A stored strategy
 * can name which included entries carry the emphasis. Its narrative is not shown.
 */

import { strings } from "@/copy/strings";
import type { Requirement } from "@/features/jobs/schemas";
import type { LibrarySnapshot } from "@/features/library/schemas";

import { bulletElementId, entryElementId } from "./evidence";
import { groupMembers } from "./stints";
import { sameWording } from "./grounding";
import { shownEntry } from "./presentation";
import { bulletReview, type BulletReview } from "./review";
import type { ContentBullet, ResumeContent } from "./schemas";
import { SUMMARY_SECTION_ID } from "./workspace-nav";

const copy = strings.jobs.workspace.overview;
const MAX_METRICS = 4;
const MAX_NAMED = 4;
const MAX_REWRITE_GROUPS = 3;
const REQUIREMENT_MAX = 90;

const METRIC_PRIORITY = ["summary", "rewritten", "projects", "omitted", "retained"] as const;
const METRIC_DISPLAY = ["summary", "rewritten", "projects", "retained", "omitted"] as const;

export type OverviewMetricId = (typeof METRIC_PRIORITY)[number];

export type OverviewMetric = {
  id: OverviewMetricId;
  label: string;
};

export type OverviewLink = {
  label: string;
  elementId: string;
};

export type OverviewDecision = {
  id: string;
  heading: string;
  body: string;
  links: OverviewLink[];
};

export type TailoringOverview = {
  strategy: string;
  metrics: OverviewMetric[];
  decisions: OverviewDecision[];
};

type SnapshotEntry = LibrarySnapshot["entries"][number];

type BulletFact = {
  id: string;
  included: boolean;
  reverted: boolean;
  elementId: string;
  entryKey: string;
  entryLabel: string;
  review: BulletReview;
};

type EntryFact = {
  ref: string;
  kind: SnapshotEntry["kind"];
  label: string;
  included: boolean;
  elementId: string;
  bullets: BulletFact[];
};

export function tailoringOverview(input: {
  jobTitle: string;
  content: ResumeContent;
  snapshot: LibrarySnapshot;
  requirements: readonly Requirement[];
}): TailoringOverview {
  const role = input.jobTitle.trim() || copy.thisRole;
  const entries = entryFacts(input.content, input.snapshot, input.requirements);
  const summaryUpdated = summaryWasRewritten(input.content, input.snapshot);
  const lead = entries.find((entry) => entry.included && entry.kind === "EXPERIENCE") ?? null;
  const projects = entries.filter((entry) => entry.included && entry.kind === "PROJECT");
  const omittedEntries = entries.filter((entry) => !entry.included);
  const rewritten = includedBullets(entries).filter((bullet) => bullet.review.state === "applied");
  const retained = includedBullets(entries).filter(
    (bullet) =>
      !bullet.reverted && (bullet.review.state === "none" || bullet.review.state === "restored"),
  );
  const reverted = includedBullets(entries).filter((bullet) => bullet.reverted);
  const omittedBullets = entries
    .filter((entry) => entry.included)
    .flatMap((entry) => entry.bullets.filter((bullet) => !bullet.included));

  const strategy = strategyText({
    role,
    summaryUpdated,
    rewritten: rewritten.length,
    lead,
    projects,
    emphasis: emphasisLabel(input.content, entries, input.snapshot),
  });

  return {
    strategy,
    metrics: metrics({
      summaryUpdated,
      rewritten: rewritten.length,
      projects: projects.length,
      retained: retained.length,
      omittedEntries: omittedEntries.length,
      omittedBullets: omittedBullets.length,
    }),
    decisions: decisions({
      role,
      summaryUpdated,
      librarySummary: input.snapshot.profile.summary?.trim() ?? "",
      lead,
      includedExperience: entries.filter((entry) => entry.included && entry.kind === "EXPERIENCE"),
      projects,
      rewritten,
      omittedEntries,
      omittedBullets: omittedBullets.length,
      combinedRefs: new Set(
        (input.content.review ?? [])
          .filter((item) => item.reason === "same_role")
          .map((item) => item.ref),
      ),
      pageNote: pageNote(input.content),
      reverted,
      gaps: (input.content.plan?.gaps ?? []).map((gap) => gap.trim()).filter((gap) => gap.length > 0).slice(0, 3),
      conflicts: (input.content.review ?? []).filter(
        (item) => item.reason === "fact_conflict" || item.reason === "unresolved_dates",
      ).length,
      shorter:
        input.content.pageLimit === 2 &&
        (input.content.review ?? []).some((item) => item.reason === "within_ceiling"),
      automatic: automaticLength(input.content),
    }),
  };
}

function strategyText(input: {
  role: string;
  summaryUpdated: boolean;
  rewritten: number;
  lead: EntryFact | null;
  projects: EntryFact[];
  emphasis: string;
}): string {
  const selection = selectionClause(input.lead, input.projects);
  let body: string;
  if (!input.summaryUpdated && input.rewritten === 0 && selection.length === 0) {
    body = copy.libraryKept(input.role);
  } else {
    const opening = input.summaryUpdated
      ? copy.summaryFor(input.role)
      : input.rewritten > 0
        ? copy.rewrittenFor(input.role, input.rewritten)
        : copy.wordingKept(input.role);
    body = selection.length === 0 ? `${opening}.` : `${opening}. ${sentence(selection)}`;
  }
  if (input.emphasis.length === 0) return body;
  return `${copy.emphasized(input.emphasis)} ${body}`;
}

function emphasisLabel(
  content: ResumeContent,
  entries: readonly EntryFact[],
  snapshot: LibrarySnapshot,
): string {
  const leads = (content.plan?.evidence ?? []).filter((row) => row.use === "lead").map((row) => row.ref);
  if (leads.length === 0) return "";
  const shown = entries.filter((entry) => {
    if (!entry.included) return false;
    if (leads.includes(entry.ref)) return true;
    const members = groupMembers(snapshot.entries, snapshot.takenAt, entry.ref);
    return members.some((ref) => leads.includes(ref));
  });
  return joinAnd(shown.map((entry) => entry.label));
}

function selectionClause(lead: EntryFact | null, projects: EntryFact[]): string {
  const parts: string[] = [];
  if (lead) parts.push(copy.leads(clip(lead.label, 60)));
  const projectsClause = projectClause(projects);
  if (projectsClause) parts.push(projectsClause);
  return joinAnd(parts);
}

function projectClause(projects: EntryFact[]): string | null {
  const first = projects[0];
  if (!first) return null;
  if (projects.length === 1 && first.label.length <= 48) return copy.projectIncluded(first.label);
  return copy.projectsCount(projects.length);
}

function metrics(input: {
  summaryUpdated: boolean;
  rewritten: number;
  projects: number;
  retained: number;
  omittedEntries: number;
  omittedBullets: number;
}): OverviewMetric[] {
  const byId = new Map<OverviewMetricId, OverviewMetric>();
  if (input.summaryUpdated) byId.set("summary", { id: "summary", label: copy.summaryMetric });
  if (input.rewritten > 0) {
    byId.set("rewritten", { id: "rewritten", label: copy.rewrittenMetric(input.rewritten) });
  }
  if (input.projects > 0) {
    byId.set("projects", { id: "projects", label: copy.projectsMetric(input.projects) });
  }
  if (input.omittedEntries > 0) {
    byId.set("omitted", { id: "omitted", label: copy.omittedMetric(input.omittedEntries) });
  } else if (input.omittedBullets > 0) {
    byId.set("omitted", { id: "omitted", label: copy.omittedBulletsMetric(input.omittedBullets) });
  }
  if (input.retained > 0) {
    byId.set("retained", { id: "retained", label: copy.retainedMetric(input.retained) });
  }
  const chosen = new Set(
    METRIC_PRIORITY.filter((id) => byId.has(id)).slice(0, MAX_METRICS),
  );
  return METRIC_DISPLAY.flatMap((id) => {
    if (!chosen.has(id)) return [];
    const metric = byId.get(id);
    return metric ? [metric] : [];
  });
}

function decisions(input: {
  role: string;
  summaryUpdated: boolean;
  librarySummary: string;
  lead: EntryFact | null;
  includedExperience: EntryFact[];
  projects: EntryFact[];
  rewritten: BulletFact[];
  omittedEntries: EntryFact[];
  omittedBullets: number;
  combinedRefs: ReadonlySet<string>;
  pageNote: string;
  reverted: BulletFact[];
  gaps: string[];
  conflicts: number;
  shorter: boolean;
  automatic: "one" | "two" | "sparse" | null;
}): OverviewDecision[] {
  const items: OverviewDecision[] = [];
  if (input.summaryUpdated) {
    items.push({
      id: "summary",
      heading: copy.summaryHeading,
      body:
        input.librarySummary.length > 0
          ? copy.summaryReplaced(input.role)
          : copy.summaryWritten(input.role),
      links: [{ label: copy.summaryLink, elementId: SUMMARY_SECTION_ID }],
    });
  }
  if (input.lead) {
    const rest = input.includedExperience.filter((entry) => entry.ref !== input.lead?.ref);
    items.push({
      id: "experience",
      heading: copy.experienceHeading,
      body:
        rest.length === 0
          ? copy.experienceLeads(input.lead.label)
          : rest.length === 1
            ? copy.experienceAlso(input.lead.label, rest[0]?.label ?? "")
            : copy.experienceFirst(input.lead.label, joinAnd(rest.map((entry) => entry.label))),
      links: input.includedExperience.map(entryLink),
    });
  }
  const rewriteGroups = groupRewrites(input.rewritten);
  if (rewriteGroups.length > 0) {
    items.push({
      id: "rewrites",
      heading: copy.rewritesHeading,
      body: rewriteGroups.map((group) => group.body).join(" "),
      links: rewriteGroups.map((group) => group.link),
    });
  }
  if (input.projects.length > 0) {
    items.push({
      id: "projects",
      heading: copy.projectsHeading,
      body: projectsBody(input.projects),
      links: input.projects.slice(0, MAX_NAMED).map(entryLink),
    });
  }
  if (input.omittedEntries.length > 0 || input.omittedBullets > 0) {
    items.push({
      id: "omitted",
      heading: copy.omittedHeading,
      body: omittedBody(input.omittedEntries, input.omittedBullets, input.combinedRefs, input.pageNote),
      links: input.omittedEntries.slice(0, MAX_NAMED).map(entryLink),
    });
  }
  if (input.reverted.length > 0) {
    items.push({
      id: "reverts",
      heading: copy.revertsHeading,
      body: copy.reverts(input.reverted.length),
      links: input.reverted.slice(0, MAX_NAMED).map((bullet) => ({
        label: clip(bullet.review.original, 48) || copy.revertedLink,
        elementId: bullet.elementId,
      })),
    });
  }
  if (input.gaps.length > 0) {
    items.push({
      id: "gaps",
      heading: copy.gapsHeading,
      body: copy.gapsBody(joinAnd(input.gaps.map((gap) => clip(gap, REQUIREMENT_MAX)))),
      links: [],
    });
  }
  if (input.conflicts > 0) {
    items.push({
      id: "conflicts",
      heading: copy.conflictsHeading,
      body: copy.conflictsBody(input.conflicts),
      links: [],
    });
  }
  if (input.automatic === "one") {
    items.push({
      id: "length",
      heading: copy.lengthHeading,
      body: copy.autoOnePage,
      links: [],
    });
  } else if (input.automatic === "two") {
    items.push({
      id: "length",
      heading: copy.lengthHeading,
      body: copy.autoTwoPages,
      links: [],
    });
  } else if (input.automatic === "sparse") {
    items.push({
      id: "length",
      heading: copy.lengthHeading,
      body: copy.autoKeptSparse,
      links: [],
    });
  } else if (input.shorter) {
    items.push({
      id: "length",
      heading: copy.lengthHeading,
      body: copy.shorterThanAllowance,
      links: [],
    });
  }
  return items;
}

function projectsBody(projects: EntryFact[]): string {
  const first = projects[0];
  if (!first) return "";
  const names = joinAnd(projects.map((entry) => entry.label));
  const selected =
    projects.length === 1 ? copy.projectSelected(first.label) : copy.projectsSelected(names);
  const tied = projects
    .map((entry) => ({ entry, requirement: citedRequirement(entry) }))
    .find((item) => item.requirement.length > 0);
  if (!tied) return selected;
  return `${selected} ${copy.projectTied(tied.entry.label, tied.requirement)}`;
}

function citedRequirement(entry: EntryFact): string {
  for (const bullet of entry.bullets) {
    if (!bullet.included || bullet.review.state !== "applied") continue;
    const requirement = bullet.review.requirements[0];
    if (requirement) return clip(requirement, REQUIREMENT_MAX);
  }
  return "";
}

function automaticLength(content: ResumeContent): "one" | "two" | "sparse" | null {
  const reasons = new Set((content.review ?? []).map((item) => item.reason));
  if (reasons.has("auto_one_page")) return "one";
  if (reasons.has("auto_kept_sparse")) return "sparse";
  if (reasons.has("auto_two_pages")) return "two";
  return null;
}

function pageNote(content: ResumeContent): string {
  const reasons = new Set((content.review ?? []).map((item) => item.reason));
  if (reasons.has("page_overflow")) return copy.pageOverflow;
  if (reasons.has("page_budget")) return copy.pageBudget;
  return "";
}

function omittedBody(
  entries: EntryFact[],
  bullets: number,
  combinedRefs: ReadonlySet<string>,
  page: string,
): string {
  const combined = entries.filter((entry) => combinedRefs.has(entry.ref));
  const other = entries.filter((entry) => !combinedRefs.has(entry.ref));
  const sentences = [
    namedOmission(other, false),
    namedOmission(combined, true),
    bullets > 0 ? copy.bulletsOmitted(bullets) : "",
    page,
  ];
  return sentences.filter((part) => part.length > 0).join(" ");
}

function namedOmission(entries: EntryFact[], combined: boolean): string {
  const shown = entries.slice(0, MAX_NAMED).map((entry) => entry.label);
  const rest = entries.length - shown.length;
  if (shown.length === 0) return "";
  if (combined) {
    return shown.length === 1 ? copy.combinedOne(shown[0] ?? "") : copy.combinedMany(joinAnd(shown));
  }
  if (shown.length === 1 && rest === 0) return copy.oneOmitted(shown[0] ?? "");
  if (rest === 0) return copy.manyOmitted(joinAnd(shown));
  return copy.omittedMore(joinAnd(shown), rest);
}

function groupRewrites(bullets: BulletFact[]): { body: string; link: OverviewLink }[] {
  const byEntry = new Map<string, BulletFact[]>();
  for (const bullet of bullets) {
    const list = byEntry.get(bullet.entryKey) ?? [];
    list.push(bullet);
    byEntry.set(bullet.entryKey, list);
  }
  const groups: { body: string; link: OverviewLink }[] = [];
  for (const list of byEntry.values()) {
    if (groups.length >= MAX_REWRITE_GROUPS) break;
    const first = list[0];
    if (!first) continue;
    const noted = list.find((bullet) => bullet.review.what || bullet.review.requirements[0]) ?? first;
    groups.push({
      body: rewriteBody(first.entryLabel, list.length, noted.review),
      link: { label: first.entryLabel, elementId: first.elementId },
    });
  }
  return groups;
}

function rewriteBody(label: string, count: number, review: BulletReview): string {
  const lead = copy.rewrittenIn(count, label);
  const what = review.what ? ensurePeriod(review.what) : "";
  const requirement = review.requirements[0] ? clip(review.requirements[0], REQUIREMENT_MAX) : "";
  const tied = requirement ? copy.tiedTo(requirement) : "";
  const detail = [what, tied].filter((part) => part.length > 0).join(" ");
  return detail.length > 0 ? `${lead} ${detail}` : `${lead} ${copy.rewriteUnspecified}`;
}

function entryFacts(
  content: ResumeContent,
  snapshot: LibrarySnapshot,
  requirements: readonly Requirement[],
): EntryFact[] {
  const byRef = new Map(snapshot.entries.map((entry) => [entry.ref, entry]));
  return content.entries.flatMap((entry) => {
    const source = byRef.get(entry.ref);
    if (!source) return [];
    const shown = shownEntry(entry, source);
    const label = entryLabel(shown.title, shown.organization);
    return [
      {
        ref: entry.ref,
        kind: source.kind,
        label,
        included: entry.included,
        elementId: entryElementId(entry.ref),
        bullets: entry.bullets.map((bullet) => ({
          id: bullet.id,
          included: bullet.included,
          reverted: bullet.reverted,
          elementId: bulletElementId(bullet.id),
          entryKey: entry.ref,
          entryLabel: label,
          review: bulletReview(bullet, libraryText(bullet, source), requirements),
        })),
      },
    ];
  });
}

function includedBullets(entries: EntryFact[]): BulletFact[] {
  return entries
    .filter((entry) => entry.included)
    .flatMap((entry) => entry.bullets.filter((bullet) => bullet.included));
}

function libraryText(bullet: ContentBullet, entry: SnapshotEntry): string {
  const ref = bullet.sourceRefs[0];
  const source = ref ? entry.bullets.find((item) => item.ref === ref) : undefined;
  return source?.text ?? bullet.originalText ?? "";
}

function summaryWasRewritten(content: ResumeContent, snapshot: LibrarySnapshot): boolean {
  if (!content.summary.included) return false;
  const current = content.summary.text.trim();
  if (current.length === 0) return false;
  return !sameWording(current, snapshot.profile.summary?.trim() ?? "");
}

function entryLabel(title: string, organization: string | null): string {
  const name = title.trim();
  const org = organization?.trim() ?? "";
  if (name && org) return `${name} at ${org}`;
  return name || org || strings.jobs.workspace.untitled;
}

function entryLink(entry: EntryFact): OverviewLink {
  return { label: entry.label, elementId: entry.elementId };
}

function joinAnd(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]}, and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function sentence(clause: string): string {
  const trimmed = clause.trim();
  if (trimmed.length === 0) return "";
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}.`;
}

function ensurePeriod(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length === 0) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max - 1).trimEnd()}…`;
}
