/**
 * Benchmark-only guard variants. Production validateTailorOutput is unchanged.
 * A uses that guard. B and C copy its checks with the experiment's exceptions.
 */
import type { LibrarySnapshot } from "@/features/library/schemas";
import type { JobAnalysis } from "@/features/jobs/schemas";
import { hasUnsupportedNumber } from "@/lib/ai/numbers";
import { chooseEducationKeepers } from "@/features/tailor/identity";
import {
  inflatedRole,
  raisedProficiency,
  summaryProficiency,
  unsupportedClaim,
} from "@/features/tailor/grounding";
import { RESUME_LIMITS, type TailorOutput, type ValidatedBullet, type ValidatedTailorOutput } from "@/features/tailor/schemas";
import { experienceGroups } from "@/features/tailor/stints";
import {
  hasOverstatedTenure,
  libraryNumberSources,
  snapshotTenure,
  stripEducationDurationPhrases,
} from "@/features/tailor/tenure";
import { validateTailorOutput } from "@/features/tailor/validate";

export type GuardMode = "A" | "B" | "C";

export type GuardFlag = {
  code: string;
  ref: string;
  token: string;
  text: string;
  home?: string;
};

const FLAG_ONLY = new Set(["G4", "G13", "G16", "G12"]);
const MAX_SOURCES = 5;

export function guardDraft(
  output: TailorOutput,
  snapshot: LibrarySnapshot,
  analysis: JobAnalysis,
  mode: GuardMode,
): { output: ValidatedTailorOutput; reverts: number; issues: { code: string; ref: string }[]; flags: GuardFlag[] } {
  if (mode === "A") {
    const guard = validateTailorOutput(output, snapshot, analysis);
    return {
      output: guard.output,
      reverts: guard.reverts,
      issues: guard.issues.map((issue) => ({ code: issue.code, ref: issue.ref })),
      flags: [],
    };
  }
  return reviewRelaxed(output, snapshot, mode === "C");
}

function reviewRelaxed(
  output: TailorOutput,
  snapshot: LibrarySnapshot,
  flagOnly: boolean,
): { output: ValidatedTailorOutput; reverts: number; issues: { code: string; ref: string }[]; flags: GuardFlag[] } {
  const issues: { code: string; ref: string }[] = [];
  const flags: GuardFlag[] = [];
  let reverts = 0;
  const groups = experienceGroups(snapshot.entries, snapshot.takenAt);
  const byRef = new Map(snapshot.entries.map((entry) => [entry.ref, entry]));
  const seen = new Set<string>();
  const cleaned: ValidatedTailorOutput["entries"] = [];

  for (const entry of output.entries) {
    const source = byRef.get(entry.ref);
    if (!source) {
      issues.push({ code: "G1", ref: entry.ref });
      continue;
    }
    if (seen.has(entry.ref)) {
      issues.push({ code: "G2", ref: entry.ref });
      continue;
    }
    seen.add(entry.ref);
    const owned = refsFor(entry.ref, snapshot, groups);
    const bullets: ValidatedBullet[] = [];
    for (const bullet of entry.bullets) {
      const cited = bullet.sourceRefs.filter((ref, index) => bullet.sourceRefs.indexOf(ref) === index);
      const known = cited.filter((ref) => owned.has(ref));
      for (const ref of cited) {
        if (!owned.has(ref)) issues.push({ code: "G3", ref });
      }
      if (known.length === 0) continue;
      if (known.length > MAX_SOURCES) {
        issues.push({ code: "G17", ref: known[0] ?? entry.ref });
        continue;
      }
      const evidence = evidenceFor(entry.ref, known, snapshot, byRef);
      const text = bullet.text;
      const problem = lineProblem(text, evidence, snapshot, entry.ref);
      if (text.trim().length === 0 || text.length > RESUME_LIMITS.bullet) {
        const replacement = firstBulletText(known, snapshot) ?? source.title;
        bullets.push({ sourceRefs: known.slice(0, 1), text: replacement, reverted: true });
        reverts += 1;
        issues.push({ code: "G5", ref: known[0] ?? entry.ref });
        continue;
      }
      if (problem && flagOnly && (FLAG_ONLY.has(problem.code) || problem.code === "wrong-entry")) {
        flags.push({ code: problem.code, ref: known[0] ?? entry.ref, token: problem.token, text, home: problem.home });
        bullets.push({ sourceRefs: known, text, reverted: false });
        continue;
      }
      if (problem) {
        const replacement = firstBulletText(known, snapshot) ?? source.title;
        bullets.push({ sourceRefs: known.slice(0, 1), text: replacement, reverted: true });
        reverts += 1;
        issues.push({ code: problem.code, ref: known[0] ?? entry.ref });
        continue;
      }
      bullets.push({ sourceRefs: known, text, reverted: false });
    }
    cleaned.push({ ref: entry.ref, bullets });
  }

  const education = applyEducation(cleaned, snapshot, issues);
  const summary = cleanSummary(output.summary, snapshot, flagOnly, issues, flags);
  reverts += summary.reverts;
  return {
    output: {
      summary: summary.text,
      ...(output.plan ? { plan: output.plan } : {}),
      entries: education,
      skills: cleanSkills(output.skills, snapshot, issues),
      requirementMatches: output.requirementMatches.map((match) => ({
        ...match,
        verdict: match.verdict,
      })),
    },
    reverts,
    issues,
    flags,
  };
}

function applyEducation(
  entries: ValidatedTailorOutput["entries"],
  snapshot: LibrarySnapshot,
  issues: { code: string; ref: string }[],
): ValidatedTailorOutput["entries"] {
  const counts = new Map(entries.map((entry) => [entry.ref, entry.bullets.length]));
  const decision = chooseEducationKeepers(snapshot.entries, counts);
  const drop = new Set(decision.drop.map((item) => item.ref));
  const kept = entries.filter((entry) => {
    if (!drop.has(entry.ref)) return true;
    issues.push({ code: "G18", ref: entry.ref });
    return false;
  });
  const present = new Set(kept.map((entry) => entry.ref));
  for (const ref of decision.keep) {
    if (present.has(ref)) continue;
    kept.push({ ref, bullets: [] });
    issues.push({ code: "G11", ref });
  }
  return kept;
}

function cleanSummary(
  text: string,
  snapshot: LibrarySnapshot,
  flagOnly: boolean,
  issues: { code: string; ref: string }[],
  flags: GuardFlag[],
): { text: string; reverts: number } {
  const presence = libraryPresence(snapshot);
  const bullets = snapshot.entries.flatMap((entry) => entry.bullets.map((bullet) => bullet.text));
  const tenure = snapshotTenure(snapshot);
  const sources = libraryNumberSources(snapshot, tenure);
  const parts = text.split(/(?<=[.!?])\s+/).map((part) => part.trim()).filter((part) => part.length > 0);
  if (parts.length === 0) return { text, reverts: 0 };
  const kept: string[] = [];
  let dropped = false;
  for (const sentence of parts) {
    const problem = summaryProblem(sentence, presence, bullets, sources, tenure, snapshot);
    if (!problem) {
      kept.push(sentence);
      continue;
    }
    if (flagOnly) {
      flags.push({
        code: problem.startsWith("wrong-entry:") ? "wrong-entry" : "G12",
        ref: "summary",
        token: problem.startsWith("wrong-entry:") ? (problem.split(":")[1] ?? problem) : problem,
        text: sentence,
        home: problem.startsWith("wrong-entry:") ? problem.split(":")[2] : undefined,
      });
      kept.push(sentence);
      continue;
    }
    dropped = true;
  }
  if (!dropped) return { text: kept.join(" "), reverts: 0 };
  issues.push({ code: "G12", ref: "summary" });
  const fragment = kept.length === 1 && /^(also|and|additionally)\b/i.test(kept[0] ?? "");
  if (kept.length > 0 && !fragment) return { text: kept.join(" "), reverts: 1 };
  return { text: snapshot.profile.summary?.trim() ?? "", reverts: 1 };
}

function summaryProblem(
  sentence: string,
  presence: readonly string[],
  bullets: readonly string[],
  sources: readonly string[],
  tenure: ReturnType<typeof snapshotTenure>,
  snapshot: LibrarySnapshot,
): string | null {
  const forNumbers = stripEducationDurationPhrases(sentence);
  if (hasOverstatedTenure(sentence, tenure) && !tenureIsStated(sentence, snapshot)) return "tenure";
  const number = unsupportedNumberToken(forNumbers, sources);
  if (number) {
    const home = entryWithNumber(snapshot, number, null);
    if (home) return `wrong-entry:${number}:${home}`;
    return number;
  }
  const claim = firstRealClaim(sentence, presence);
  if (claim !== null) return claim;
  return inflatedRole(sentence, bullets) ?? summaryProficiency(sentence, bullets);
}

function lineProblem(
  text: string,
  evidence: readonly string[],
  snapshot: LibrarySnapshot,
  entryRef: string,
): { code: "G4" | "G13" | "G16" | "wrong-entry"; token: string; home?: string } | null {
  const source = snapshot.entries.find((entry) => entry.ref === entryRef);
  if (hasUnsupportedNumber(text, evidence)) {
    const token = unsupportedNumberToken(text, evidence) ?? "number";
    const home = entryWithNumber(snapshot, token, entryRef);
    if (home) return { code: "wrong-entry", token, home };
    return { code: "G4", token };
  }
  const claim = firstRealClaim(text, evidence);
  if (claim !== null) {
    if (source && termInTitleOrOrg(claim, source)) return null;
    if (snapshot.skills.some((skill) => looseTokenSupported(claim, [skill.name]))) return null;
    if (isNamedCredential(claim)) {
      const home = entryWithToken(snapshot, claim, entryRef);
      if (home) return { code: "wrong-entry", token: claim, home };
    }
    return { code: "G13", token: claim };
  }
  const inflated = inflatedRole(text, evidence) ?? raisedProficiency(text, evidence);
  if (inflated !== null) return { code: "G16", token: inflated };
  return null;
}

function unsupportedNumberToken(text: string, sources: readonly string[]): string | null {
  const allowed = new Set(sources.flatMap((source) => numberTokens(source).map(normalizeNumber)));
  for (const token of numberTokens(text)) {
    if (!allowed.has(normalizeNumber(token))) return token;
  }
  return null;
}

function numberTokens(text: string): string[] {
  return [...text.matchAll(/(?:\$(?:\s*)(?:\d{1,3}(?:[, ]\d{3})+|\d+)(?:\.\d+)?)|(?:\d{1,3}(?:[, ]\d{3})+(?:\.\d+)?(?:\s*%)?)|(?:\d+(?:\.\d+)?(?:\s*%)?)/g)]
    .map((match) => match[0])
    .filter((token): token is string => token !== undefined);
}

function normalizeNumber(raw: string): string {
  const digits = raw.replace(/[^0-9.]/g, "");
  if (raw.includes("$")) return `$${digits}`;
  if (raw.includes("%")) return `${digits}%`;
  return digits;
}

function firstRealClaim(text: string, evidence: readonly string[]): string | null {
  let current = text;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const claim = unsupportedClaim(current, evidence);
    if (claim === null) return null;
    if (!looseTokenSupported(claim, evidence)) return claim;
    current = current.replace(claim, " ");
  }
  return null;
}

/**
 * Case, spacing, hyphens, and a trailing plural s do not make a token unsupported.
 * "MAS 200" matches "MAS200", "kWh" matches "kwh", and "70E" matches "70Es".
 */
export function looseTokenSupported(token: string, evidence: readonly string[]): boolean {
  const needle = alnum(token);
  if (needle.length < 2) return false;
  const hay = alnum(evidence.join("\n"));
  if (hay.includes(needle)) return true;
  if (needle.endsWith("s") && hay.includes(needle.slice(0, -1))) return true;
  return hay.includes(`${needle}s`);
}

function alnum(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const TENURE_CLAIM =
  /\b(\d+(?:\.\d+)?)\s*(\+|plus)?\s*(?:~\s*)?(?:years?|yrs)\b|~\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs)\b/gi;

/** A tenure the library already states, or that the dated roles already span. */
export function tenureIsStated(sentence: string, snapshot: LibrarySnapshot): boolean {
  const claims = [...sentence.matchAll(TENURE_CLAIM)];
  if (claims.length === 0) return false;
  const blob = alnum(libraryPresence(snapshot).join("\n"));
  const spanned = snapshotTenure(snapshot).experienceYears;
  return claims.every((match) => {
    const years = Number(match[1] ?? match[3]);
    if (!Number.isFinite(years)) return false;
    const plus = Boolean(match[2]);
    const stated = blob.includes(alnum(`${years}+ yrs`)) || blob.includes(alnum(`${years}+ years`)) || blob.includes(alnum(`${years} years`)) || blob.includes(alnum(`${years} yrs`)) || blob.includes(alnum(`~${years} years`));
    if (stated) return true;
    if (plus && spanned >= years) return true;
    return spanned >= years && !plus;
  });
}

function termInTitleOrOrg(token: string, entry: LibrarySnapshot["entries"][number]): boolean {
  return looseTokenSupported(token, [entry.title, entry.organization ?? ""]);
}

function entryWithNumber(snapshot: LibrarySnapshot, token: string, exceptRef: string | null): string | null {
  const wanted = normalizeNumber(token);
  for (const entry of snapshot.entries) {
    if (entry.ref === exceptRef) continue;
    const blob = [entry.title, ...entry.bullets.map((bullet) => bullet.text)].join(" ");
    if (numberTokens(blob).some((item) => normalizeNumber(item) === wanted)) return entry.ref;
  }
  return null;
}

function isNamedCredential(token: string): boolean {
  if (/\d/.test(token)) return true;
  if ((token.match(/[A-Z]/g) ?? []).length >= 2) return true;
  return /licen[cs]e|certif/i.test(token);
}

function entryWithToken(snapshot: LibrarySnapshot, token: string, exceptRef: string): string | null {
  for (const entry of snapshot.entries) {
    if (entry.ref === exceptRef) continue;
    const blob = [entry.title, entry.organization ?? "", ...entry.bullets.map((bullet) => bullet.text)];
    if (looseTokenSupported(token, blob)) return entry.ref;
  }
  return null;
}

function refsFor(
  entryRef: string,
  snapshot: LibrarySnapshot,
  groups: readonly { members: readonly string[] }[],
): Set<string> {
  const group = groups.find((item) => item.members.includes(entryRef));
  const members = new Set(group?.members ?? [entryRef]);
  const refs = new Set<string>();
  for (const entry of snapshot.entries) {
    if (!members.has(entry.ref)) continue;
    refs.add(entry.ref);
    for (const bullet of entry.bullets) refs.add(bullet.ref);
  }
  return refs;
}

function evidenceFor(
  entryRef: string,
  cited: readonly string[],
  snapshot: LibrarySnapshot,
  byRef: ReadonlyMap<string, LibrarySnapshot["entries"][number]>,
): string[] {
  const texts: string[] = [];
  const addEntry = (entry: LibrarySnapshot["entries"][number] | undefined) => {
    if (!entry) return;
    if (entry.title.trim().length > 0) texts.push(entry.title);
    if (entry.organization) texts.push(entry.organization);
  };
  addEntry(byRef.get(entryRef));
  for (const ref of cited) {
    const entry = byRef.get(ref);
    if (entry) {
      addEntry(entry);
      for (const bullet of entry.bullets) texts.push(bullet.text);
      continue;
    }
    for (const item of snapshot.entries) {
      const bullet = item.bullets.find((candidate) => candidate.ref === ref);
      if (bullet) texts.push(bullet.text);
    }
  }
  return texts;
}

function firstBulletText(refs: readonly string[], snapshot: LibrarySnapshot): string | null {
  for (const ref of refs) {
    for (const entry of snapshot.entries) {
      const bullet = entry.bullets.find((candidate) => candidate.ref === ref);
      if (bullet) return bullet.text;
    }
  }
  return null;
}

function libraryPresence(snapshot: LibrarySnapshot): string[] {
  const parts: string[] = [];
  if (snapshot.profile.headline) parts.push(snapshot.profile.headline);
  if (snapshot.profile.summary) parts.push(snapshot.profile.summary);
  for (const entry of snapshot.entries) {
    if (entry.title.trim().length > 0) parts.push(entry.title);
    if (entry.organization) parts.push(entry.organization);
    for (const bullet of entry.bullets) parts.push(bullet.text);
  }
  for (const skill of snapshot.skills) parts.push(skill.name);
  return parts;
}

function cleanSkills(
  groups: readonly { category: string | null; refs: string[] }[],
  snapshot: LibrarySnapshot,
  issues: { code: string; ref: string }[],
): { category: string | null; refs: string[] }[] {
  const known = new Set(snapshot.skills.map((skill) => skill.ref));
  const cleaned: { category: string | null; refs: string[] }[] = [];
  for (const group of groups) {
    const refs: string[] = [];
    for (const ref of group.refs) {
      if (!known.has(ref)) {
        issues.push({ code: "G7", ref });
        continue;
      }
      refs.push(ref);
    }
    if (refs.length === 0) continue;
    cleaned.push({ category: group.category, refs });
  }
  return cleaned;
}
