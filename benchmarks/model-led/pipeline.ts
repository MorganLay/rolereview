/**
 * Turns a model draft into a resume.
 * The fabrication guard checks facts. composeModelLed keeps the surviving lines.
 * It does not call production composeResume. Page length is measured by the PDF renderer.
 */
import { assembleResumeContent } from "@/features/tailor/assemble";
import type { LibrarySnapshot } from "@/features/library/schemas";
import type { JobAnalysis } from "@/features/jobs/schemas";
import { classifyLink } from "@/features/tailor/identity";
import { resumePlainText } from "@/features/tailor/plainText";
import {
  pageCeiling,
  type ResumeContact,
  type ResumeContent,
  type ResumeLengthChoice,
  type TailorOutput,
  type ValidatedTailorOutput,
} from "@/features/tailor/schemas";
import { validateTailorOutput } from "@/features/tailor/validate";

import { coverageDiscrepancies, type CoverageDiscrepancy, type PlanRow } from "../lib/plan-compose";
import { composeModelLed, type ComposeNote } from "./compose";
import { careerLibraryInput } from "./library";
import { MODEL_LED_DEFAULTS, MODEL_LED_ID, type ModelLedAblation } from "./prompt";

const REPAIRABLE = new Set(["G4", "G13", "G16"]);

export type PageMeasure = {
  pages: 1 | 2 | null;
  dropped: string[];
  measured: boolean;
  text: string;
};

export type ModelLedResult = {
  version: typeof MODEL_LED_ID;
  content: ResumeContent;
  text: string;
  decisions: PlanRow[];
  guard: { reverts: number; issues: { code: string; ref: string }[] };
  coverage: CoverageDiscrepancy[];
  notes: ComposeNote[];
  page: PageMeasure | null;
  reasons: ("guard" | "coverage" | "page")[];
  revised: boolean;
  libraryNote: string;
};

export async function buildModelLedResume(input: {
  draft: TailorOutput;
  snapshot: LibrarySnapshot;
  analysis: JobAnalysis;
  length?: ResumeLengthChoice;
  ablation?: Partial<ModelLedAblation>;
  measure?: (content: ResumeContent, snapshot: LibrarySnapshot) => Promise<PageMeasure>;
  reviser?: (brief: string) => Promise<TailorOutput | null>;
}): Promise<ModelLedResult> {
  const ablation = { ...MODEL_LED_DEFAULTS, ...input.ablation };
  const length = input.length ?? "auto";
  const first = finish(input.draft, input.snapshot, input.analysis, length, ablation, input.measure);
  const built = await first;
  if (!ablation.revision || !input.reviser || built.reasons.length === 0) return built;
  const revised = await input.reviser(revisionBrief(built));
  if (!revised) return built;
  const second = await finish(revised, input.snapshot, input.analysis, length, ablation, input.measure);
  return { ...second, revised: true };
}

async function finish(
  draft: TailorOutput,
  snapshot: LibrarySnapshot,
  analysis: JobAnalysis,
  length: ResumeLengthChoice,
  ablation: ModelLedAblation,
  measure: ((content: ResumeContent, snapshot: LibrarySnapshot) => Promise<PageMeasure>) | undefined,
): Promise<ModelLedResult> {
  const decisions = planRows(draft);
  const guard = validateTailorOutput(draft, snapshot, analysis);
  const composed = composeModelLed({ output: guard.output, snapshot, decisions });
  const content = assembleResumeContent(composed.output, snapshot, sequence(), new Map(), {
    output: composed.output,
    sectionOrder: composed.sectionOrder,
    contacts: profileContacts(snapshot),
    review: composed.review,
    presentation: {},
    stints: [],
    headline: headlineOf(draft),
    pageLimit: pageCeiling(length),
  });
  if (content.plan && decisions.length > 0) content.plan = { ...content.plan, evidence: decisions };
  const plain = resumePlainText(content, snapshot);
  const coverage = ablation.coverageCheck
    ? coverageDiscrepancies({ plan: decisions, snapshot, resumeText: plain })
    : [];
  const page = ablation.pageFit && measure ? await measure(content, snapshot) : null;
  const text = page?.measured ? page.text : plain;
  const reasons: ModelLedResult["reasons"] = [];
  if (guard.issues.some((issue) => REPAIRABLE.has(issue.code))) reasons.push("guard");
  if (coverage.length > 0) reasons.push("coverage");
  const ceiling = pageCeiling(length);
  if (page?.measured && ((page.pages !== null && page.pages > ceiling) || page.dropped.length > 0)) {
    reasons.push("page");
  }
  return {
    version: MODEL_LED_ID,
    content,
    text,
    decisions,
    guard: {
      reverts: guard.reverts,
      issues: guard.issues.map((issue) => ({ code: issue.code, ref: issue.ref })),
    },
    coverage,
    notes: composed.notes,
    page,
    reasons,
    revised: false,
    libraryNote: careerLibraryInput(snapshot).report.note,
  };
}

/** Lead and support keep every guarded line. Omit stays off. The composer applies this filter. */
export function applyDecisions(
  output: ValidatedTailorOutput,
  decisions: readonly PlanRow[],
): ValidatedTailorOutput {
  if (decisions.length === 0) return output;
  const omit = new Set(decisions.filter((row) => row.use === "omit").map((row) => row.ref));
  const keep = new Set(
    decisions.filter((row) => row.use === "lead" || row.use === "support").map((row) => row.ref),
  );
  return {
    ...output,
    entries: output.entries.filter((entry) => !omit.has(entry.ref) && (keep.size === 0 || keep.has(entry.ref))),
  };
}

export function planRows(draft: TailorOutput): PlanRow[] {
  return (draft.plan?.evidence ?? [])
    .filter((row) => row.use === "lead" || row.use === "support" || row.use === "omit")
    .map((row) => ({
      ref: row.ref.trim(),
      use: row.use,
      bullets: row.bullets,
      because: row.because.trim(),
    }))
    .filter((row) => row.ref.length > 0);
}

export function revisionBrief(result: ModelLedResult): string {
  const lines = ["The resume failed a check. Change only what the check names. Keep every other grounded line."];
  if (result.reasons.includes("guard")) {
    const refs = result.guard.issues
      .filter((issue) => REPAIRABLE.has(issue.code))
      .map((issue) => `${issue.code} ${issue.ref}`)
      .join(", ");
    lines.push(`Unsupported claims were sent back to the source wording (${refs}). Rewrite only those lines from that source. Do not add a fact the source does not state.`);
  }
  for (const item of result.coverage) {
    lines.push(item.proposal);
  }
  if (result.reasons.includes("page")) {
    const dropped = result.page?.dropped.join(" | ") || "none recorded";
    lines.push(
      `The measured page count is ${result.page?.pages ?? "unknown"}. Shorten the resume by dropping the least necessary support line. Do not drop the only evidence for a requirement. The fitter had removed: ${dropped}.`,
    );
  }
  return lines.join("\n");
}

function headlineOf(draft: TailorOutput): string | null {
  const headline = draft.plan?.headline?.trim() ?? "";
  return headline.length > 0 ? headline.slice(0, 120) : null;
}

function profileContacts(snapshot: LibrarySnapshot): ResumeContact[] {
  const contacts: ResumeContact[] = [];
  for (const link of snapshot.profile.links) {
    const kind = classifyLink(link.label, link.url);
    if (kind === "invalid" || kind === "not_contact") continue;
    contacts.push({
      label: link.label.slice(0, 40),
      url: link.url.slice(0, 300),
      kind,
      reason: "Profile link.",
    });
  }
  return contacts;
}

function sequence(): () => string {
  let next = 1;
  return () => `model-led-${next++}`;
}
