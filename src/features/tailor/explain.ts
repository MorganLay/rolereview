/**
 * A testing read of a saved resume. It prints the plan's value for each
 * entry and the composer's reason for keeping or leaving it. No model call.
 */

import type { Requirement } from "@/features/jobs/schemas";
import type { LibrarySnapshot } from "@/features/library/schemas";

import { shownEntry } from "./presentation";
import type {
  ContentEntry,
  EditorialPlan,
  ResumeContent,
  ResumeReviewItem,
  StrategyEvidence,
} from "./schemas";

type Match = {
  requirementId: string;
  verdict: string;
  note: string;
  evidenceRefs: readonly string[];
};

type SnapshotEntry = LibrarySnapshot["entries"][number];

const USE_ORDER = ["lead", "support", "omit"] as const;

const REASONS: Record<string, string> = {
  prioritized: "The composer kept it ahead of the model's order because the posting terms match it more strongly.",
  model_selected: "The model selected it, and the composer kept it.",
  strategy_omit: "The plan marked it omit.",
  no_marginal_value: "It did not add a requirement the selected evidence was missing.",
  covered: "Selected entries already cover what it would add.",
  page_budget: "It was cut so the resume stayed within the page ceiling.",
  lower_relevance: "A closer entry was kept instead.",
  missing_source: "It has no bullet text to cite.",
  not_selected: "The model did not select it.",
  unresolved: "The plan did not decide this entry.",
  same_role: "It was merged into another record of the same role.",
  same_degree: "It was merged into another record of the same degree.",
  current_role_not_selected: "This current role was left off.",
  stronger_bullet: "A stronger line from the same entry replaced it.",
  overlapping_claim: "It repeats a claim already on the resume.",
  hands_on: "A selected bullet shows this tool in use.",
  academic: "The library states this as academic or coursework.",
  name_only: "The name is in the library, and no selected bullet shows the work.",
  irrelevant_skill: "Nothing selected shows this tool.",
  auto_one_page: "Automatic kept one page. The evidence fit without a short second page.",
  auto_two_pages: "Automatic kept two pages. The second page still holds evidence the plan kept.",
  auto_kept_sparse: "The second page is short. Cutting it would remove evidence the plan still values.",
  within_ceiling: "The resume is shorter than the two-page maximum. Empty space was left empty.",
  page_overflow: "The rendered resume was over the ceiling, so the lowest-valued line was removed.",
  projects_lead: "Projects are placed before employment.",
  experience_leads: "Employment is placed before projects.",
  chronology: "Employment was put back into date order.",
  job_headline: "The line under the name was written for this job.",
  project_name: "The project heading uses the project name.",
  fact_conflict: "Two records of this role disagree, and nothing confirmed which fact to print.",
  unresolved_dates: "The dates disagree, so the records stayed separate.",
  confirmation_rejected: "A confirmation did not match the records, so it was ignored.",
};

export function explainResumeDecisions(input: {
  content: ResumeContent;
  snapshot: LibrarySnapshot;
  title: string;
  company: string;
  requirements?: readonly Requirement[];
  matches?: readonly Match[];
}): string {
  const plan = input.content.plan;
  const review = input.content.review ?? [];
  const lines: string[] = [];
  const title = input.title.trim() || "This job";
  const company = input.company.trim();
  lines.push(company ? `${title} at ${company}` : title);
  lines.push(lengthLine(input.content, review));
  const headline = input.content.headline?.trim();
  if (headline) lines.push(`Headline: ${headline}`);
  lines.push("");
  lines.push(valueRules());
  lines.push("");
  lines.push("Positioning");
  if (!plan) {
    lines.push("This version has no editorial plan. The notes below are the composer's only record.");
  } else {
    lines.push(...positioning(plan));
  }
  lines.push("");
  lines.push("Requirements");
  lines.push(...requirementLines(input.requirements ?? [], plan, input.matches ?? []));
  lines.push("");
  lines.push("Evidence");
  lines.push(...evidence(input.content, input.snapshot, plan, review));
  lines.push("");
  lines.push("Skills");
  lines.push(...skills(input.content, input.snapshot, review));
  const other = otherNotes(review);
  if (other.length > 0) {
    lines.push("");
    lines.push("Other decisions");
    lines.push(...other);
  }
  return lines.join("\n");
}

function valueRules(): string {
  return [
    "How value is assigned",
    "The plan values each library entry as lead, support, or omit. A lead is the evidence the resume is built around. Support may add a few lines. Omit stays off. The bullet number is how many lines that entry is allowed, not a score.",
    "A requirement is mandatory, differentiating, or secondary when the plan says so. The posting still marks it must or nice.",
    "The composer can still leave a line off when it repeats a stronger claim, when a selected entry already covers it, or when the page is over the ceiling. Clearing a short second page protects every lead line and the last line of a support entry.",
  ].join("\n");
}

function lengthLine(content: ResumeContent, review: readonly ResumeReviewItem[]): string {
  const pages =
    content.pageLimit === 1 ? "1 page" : content.pageLimit === 2 ? "2 pages" : "no stored page limit";
  const reason = review.find((item) =>
    ["auto_one_page", "auto_two_pages", "auto_kept_sparse", "within_ceiling", "page_overflow"].includes(item.reason),
  );
  return reason ? `Length: ${pages}. ${say(reason.reason)}` : `Length: ${pages}.`;
}

function positioning(plan: EditorialPlan): string[] {
  const lines: string[] = [];
  if (plan.positioning?.trim()) lines.push(plan.positioning.trim());
  if (plan.narrative.trim()) lines.push(plan.narrative.trim());
  if (plan.hiringFor?.trim()) lines.push(`Hiring for: ${plan.hiringFor.trim()}`);
  if (plan.priorities.length > 0) lines.push(`Priorities: ${plan.priorities.join("; ")}`);
  if (plan.gaps.length > 0) lines.push(`No evidence for: ${plan.gaps.join("; ")}`);
  if (plan.closeCall) lines.push("The plan called this ranking close.");
  return lines.length > 0 ? lines : ["The plan has no positioning text."];
}

function requirementLines(
  requirements: readonly Requirement[],
  plan: EditorialPlan | undefined,
  matches: readonly Match[],
): string[] {
  if (requirements.length === 0) return ["This job has no stored requirements."];
  return requirements.map((requirement) => {
    const weight = plan?.qualifications?.find((item) => item.requirementId === requirement.id)?.weight;
    const match = matches.find((item) => item.requirementId === requirement.id);
    const parts = [
      requirement.id,
      weight ?? "unranked",
      requirement.importance,
      requirement.text.trim(),
    ];
    if (match) parts.push(match.verdict, match.note.trim());
    return parts.filter((part) => part.length > 0).join(" — ");
  });
}

function evidence(
  content: ResumeContent,
  snapshot: LibrarySnapshot,
  plan: EditorialPlan | undefined,
  review: readonly ResumeReviewItem[],
): string[] {
  const rows = [...(plan?.evidence ?? [])].sort(
    (left, right) => USE_ORDER.indexOf(left.use) - USE_ORDER.indexOf(right.use),
  );
  const seen = new Set(rows.map((row) => row.ref));
  const lines: string[] = [];
  for (const row of rows) lines.push(...entryBlock(row, content, snapshot, review));
  for (const entry of snapshot.entries) {
    if (seen.has(entry.ref)) continue;
    lines.push(...entryBlock(null, content, snapshot, review, entry));
  }
  return lines.length > 0 ? lines : ["No library entries."];
}

function entryBlock(
  row: StrategyEvidence | null,
  content: ResumeContent,
  snapshot: LibrarySnapshot,
  review: readonly ResumeReviewItem[],
  fallback?: SnapshotEntry,
): string[] {
  const ref = row?.ref ?? fallback?.ref ?? "";
  const source = snapshot.entries.find((entry) => entry.ref === ref) ?? fallback;
  const saved = content.entries.find((entry) => entry.ref === ref);
  const notes = review.filter((item) => item.ref === ref);
  const label = source ? heading(saved, source) : ref;
  const lines = [`${(row?.use ?? "unlisted").toUpperCase()}  ${label}`];
  if (row) {
    lines.push(`  Allowed lines: ${row.bullets}`);
    if (row.because.trim()) lines.push(`  Because: ${row.because.trim()}`);
  } else {
    lines.push("  The plan did not value this entry.");
  }
  if (!saved || !saved.included) {
    const why = notes.map((item) => say(item.reason));
    lines.push(`  Left off. ${why.join(" ") || "No composer note was stored."}`);
    return lines;
  }
  const why = notes.map((item) => say(item.reason));
  if (why.length > 0) lines.push(`  Kept. ${why.join(" ")}`);
  for (const bullet of saved.bullets) {
    const bulletNotes = review.filter((item) => bullet.sourceRefs.includes(item.ref) || item.ref === bullet.id);
    const state = !bullet.included ? "left off" : bullet.reverted ? "reverted to the library line" : "included";
    const detail = bulletNotes.map((item) => say(item.reason)).join(" ");
    lines.push(`  - [${state}] ${bullet.text}${detail ? ` (${detail})` : ""}`);
  }
  return lines;
}

function skills(
  content: ResumeContent,
  snapshot: LibrarySnapshot,
  review: readonly ResumeReviewItem[],
): string[] {
  const kept = new Set(content.skills.flatMap((group) => group.names.map((name) => name.toLowerCase())));
  if (snapshot.skills.length === 0) return ["The library has no skills."];
  return snapshot.skills.map((skill) => {
    const note = review.find((item) => item.code === "SKILL_EVIDENCE" && item.ref === skill.ref);
    const onResume = kept.has(skill.name.toLowerCase());
    const why = note ? say(note.reason) : onResume ? "It was selected with the resume." : "It was not selected.";
    return `${onResume ? "Kept" : "Left off"}  ${skill.name}. ${why}`;
  });
}

function otherNotes(review: readonly ResumeReviewItem[]): string[] {
  const attached = new Set([
    "ENTRY_INCLUDED",
    "ENTRY_EXCLUDED",
    "DUPLICATE_CONSOLIDATED",
    "BULLET_PREFERENCE",
    "SKILL_EVIDENCE",
    "CURRENT_ROLE_OMITTED",
  ]);
  return review
    .filter((item) => !attached.has(item.code))
    .map((item) => say(item.reason));
}

function heading(saved: ContentEntry | undefined, source: SnapshotEntry): string {
  const shown = saved ? shownEntry(saved, source) : null;
  const title = shown?.title || source.title;
  const organization = shown?.organization ?? source.organization;
  return [title, organization].filter((part) => part && part.trim().length > 0).join(", ");
}

function say(reason: string): string {
  return REASONS[reason] ?? reason;
}
