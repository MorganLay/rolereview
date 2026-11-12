/**
 * Checks that a rewritten bullet stays inside its cited evidence,
 * and that near-duplicate bullets are not both kept.
 * docs/05-AI.md → The fabrication guard.
 */

import { parseResumeDate } from "@/features/library/dates";
import type { LibrarySnapshot } from "@/features/library/schemas";
import { KNOWN_TERMS } from "@/features/library/strength";

import { normalizeMatchText, termAppears } from "./keywords";

const EXTRA_TERMS = [
  "airflow",
  "alteryx",
  "cognos",
  "dbt",
  "elt",
  "etl",
  "ibm cognos",
  "power automate",
  "sharepoint",
  "ssas",
  "ssrs",
  "erp",
];

const TECH = new Set<string>([...KNOWN_TERMS, ...EXTRA_TERMS]);

const OVERCLAIM = [
  "production",
  "expert",
  "expertise",
  "proficient",
  "specialist",
  "architected",
  "etl",
  "elt",
  "pipeline",
  "senior",
  "erp",
] as const;

/** Kinds of work a rewrite must not invent from a nearby task. */
const INVENTED_WORK = [
  "help desk",
  "helpdesk",
  "service desk",
  "customer support",
  "on-call",
  "on call",
] as const;

const STOP = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "to",
  "of",
  "for",
  "in",
  "on",
  "with",
  "by",
  "from",
  "using",
  "used",
  "via",
  "into",
  "across",
  "that",
  "this",
  "their",
  "its",
  "as",
  "at",
  "per",
  "over",
  "under",
  "within",
  "through",
  "after",
  "before",
  "while",
  "than",
  "was",
  "were",
  "are",
  "is",
]);

/** Both sides need at least this many content words before one can be dropped. */
const REDUNDANT_MIN_TOKENS = 4;
const REDUNDANT_SIMILARITY = 0.75;

type SnapshotEntry = LibrarySnapshot["entries"][number];

export function sameWording(left: string, right: string): boolean {
  return normalizeMatchText(left) === normalizeMatchText(right);
}

/**
 * A tool, credential, or overclaim in `text` that the cited sources do not
 * support. Null when the wording stays inside that evidence.
 */
const LEADERSHIP = [
  "led",
  "lead",
  "directed",
  "direct",
  "managed",
  "manage",
  "supervised",
  "supervise",
  "spearheaded",
  "owned",
  "owns",
] as const;

const SUPPORT = ["helped", "assisted", "supported", "contributed", "aided"] as const;

const BUILD = ["developed", "develop", "architected", "architect", "engineered"] as const;

const BUILD_OK = [
  ...BUILD,
  "built",
  "build",
  "designed",
  "design",
  "created",
  "create",
] as const;

const SCOPE = ["infrastructure", "enterprise", "strategy"] as const;

const ENGINES = ["postgresql", "postgres", "mysql", "oracle", "snowflake"] as const;

const BUILD_VERB =
  /\b(built|build|building|developed|develop|developing|implemented|implement|implementing|engineered|engineering|architected|architecting|programmed|programming|tested|testing|integrated|integrating|deployed|deploying|debugged|debugging|designed|designing|created|creating)\b/gi;

const INSTRUMENT = /\b(used|using|use|with|via)\b/gi;

const FAMILIARITY =
  /\b(familiar(?:ity)?|exposure|introductory|basic)\b|\bintroduced to\b/i;

const COURSEWORK = /\b(coursework|courses?|academic|studied|introduction to)\b/i;

const PROFESSIONAL =
  /\b(professional|production|extensive|expert|proficient|advanced)\b|\bdevelopment experience\b/i;

type Proficiency = "familiarity" | "used" | "coursework" | "built" | "professional";

/**
 * Familiarity, use, coursework, a project built with a tool, and professional
 * experience are separate claims. A rewrite may restate a weaker claim that
 * the evidence already implies. It may not add a category the sources do not state.
 */
export function raisedProficiency(text: string, sources: readonly string[]): string | null {
  if (sources.length === 0) return "source";
  return proficiencyPromotion(text, sources);
}

/** Same category check for a summary sentence. Empty evidence supports no category. */
export function summaryProficiency(
  text: string,
  sources: readonly string[],
): string | null {
  return proficiencyPromotion(text, sources);
}

/**
 * A rewrite that raises the role or the tool past what the sources say.
 * "Helped coordinate" does not become "Led". "Used SQL" does not become
 * "Developed PostgreSQL infrastructure".
 */
export function inflatedRole(text: string, sources: readonly string[]): string | null {
  const evidence = sources.join("\n");
  if (sources.length === 0) return "source";
  if (sources.some((source) => sameWording(text, source))) return null;

  const textLead = firstMatch(text, LEADERSHIP);
  const evidenceLead = firstMatch(evidence, LEADERSHIP);
  const evidenceSupport = firstMatch(evidence, SUPPORT);
  if (textLead && !evidenceLead && evidenceSupport) return textLead;

  for (const engine of ENGINES) {
    if (mentions(text, engine) && !mentions(evidence, engine)) return engine;
  }

  for (const word of SCOPE) {
    if (mentions(text, word) && !mentions(evidence, word)) return word;
  }

  const textBuild = firstMatch(text, BUILD);
  const evidenceBuild = firstMatch(evidence, BUILD_OK);
  const evidenceUsed = firstMatch(evidence, ["used", "using", "use"]);
  if (textBuild && evidenceUsed && !evidenceBuild) return textBuild;

  return null;
}

export function unsupportedClaim(
  text: string,
  sources: readonly string[],
): string | null {
  const evidence = sources.join("\n");
  if (sources.length === 0) return "source";
  if (sources.some((source) => sameWording(text, source))) return null;
  if (unsupportedDeployment(text, evidence)) return "deployed";

  for (const phrase of lexiconPhrases(text)) {
    if (!supported(phrase, evidence)) return phrase;
  }
  for (const phrase of INVENTED_WORK) {
    if (mentions(text, phrase) && !mentions(evidence, phrase)) return phrase;
  }
  for (const word of OVERCLAIM) {
    if (mentions(text, word) && !mentions(evidence, word)) return word;
  }
  for (const token of tokens(text)) {
    if (!isDistinctive(token)) continue;
    if (!supported(token, evidence)) return token;
  }
  return null;
}

/**
 * True when `later` repeats `earlier` closely enough that the resume should
 * keep only the earlier line.
 */
export function isRedundantBullet(earlier: string, later: string): boolean {
  const left = contentTokens(earlier);
  const right = contentTokens(later);
  if (left.size < REDUNDANT_MIN_TOKENS || right.size < REDUNDANT_MIN_TOKENS) {
    return false;
  }
  return jaccard(left, right) >= REDUNDANT_SIMILARITY;
}

/**
 * A "met" verdict overstates the requirement when the evidence is only adjacent.
 * Excel joins do not meet five years of production ETL.
 */
export function requirementOverstated(input: {
  requirement: string;
  evidence: string;
  yearsAvailable: number;
}): boolean {
  const asked = input.requirement.match(/(\d+)\s*\+?\s*years?/i);
  if (asked) {
    const years = Number(asked[1]);
    const stated = mentionedYears(input.evidence);
    const yearsKnown = (stated !== null && stated >= years) || input.yearsAvailable >= years;
    if (!yearsKnown) return true;
  }
  if (/\bproduction\b/i.test(input.requirement) && !mentions(input.evidence, "production")) {
    return true;
  }
  if (
    /\betl\b/i.test(input.requirement) &&
    !/\b(etl|elt|pipeline|pipelines|airflow|spark|dbt|warehouse)\b/i.test(input.evidence)
  ) {
    return true;
  }
  for (const phrase of INVENTED_WORK) {
    if (mentions(input.requirement, phrase) && !mentions(input.evidence, phrase)) return true;
  }
  return knownToolMissing(input.requirement, input.evidence);
}

/** Whole years of cited EXPERIENCE entries. Projects and education do not count. */
export function citedExperienceYears(
  refs: readonly string[],
  snapshot: LibrarySnapshot,
): number {
  let best = 0;
  const wanted = new Set(refs);
  for (const entry of snapshot.entries) {
    if (entry.kind !== "EXPERIENCE") continue;
    const cited =
      wanted.has(entry.ref) || entry.bullets.some((bullet) => wanted.has(bullet.ref));
    if (!cited) continue;
    best = Math.max(best, wholeYears(entry, snapshot.takenAt));
  }
  return best;
}

export function evidenceText(
  refs: readonly string[],
  snapshot: LibrarySnapshot,
): string {
  const wanted = new Set(refs);
  const parts: string[] = [];
  for (const entry of snapshot.entries) {
    if (wanted.has(entry.ref)) parts.push(entry.title);
    for (const bullet of entry.bullets) {
      if (wanted.has(bullet.ref)) parts.push(bullet.text);
    }
  }
  for (const skill of snapshot.skills) {
    if (wanted.has(skill.ref)) parts.push(skill.name);
  }
  return parts.join("\n");
}

/**
 * "Deployed" is unsupported when the source never says the work shipped.
 * "Not deployed" does not license the rewrite to drop the negation.
 */
function unsupportedDeployment(text: string, evidence: string): boolean {
  return positivelyDeploys(text) && !positivelyDeploys(evidence);
}

function positivelyDeploys(text: string): boolean {
  for (const sentence of text.split(/(?<=[.!?])\s+|\n+/)) {
    const match = /\bdeploy(?:ed|ing|s)?\b/i.exec(sentence);
    if (!match || match.index === undefined) continue;
    const before = sentence.slice(0, match.index);
    if (/\b(?:not|never|no|isn'?t|wasn'?t|aren'?t|weren'?t|without|yet)\b/i.test(before)) {
      continue;
    }
    return true;
  }
  return false;
}

function proficiencyPromotion(text: string, sources: readonly string[]): string | null {
  if (sources.some((source) => sameWording(text, source))) return null;
  const evidence = sources.join("\n");
  for (const term of mentionedTerms(text)) {
    const claimed = categoriesFor(text, term);
    const supported = categoriesFor(evidence, term);
    for (const claim of claimed) {
      if (!categoryAllowed(claim, supported)) return term;
    }
  }
  return null;
}

function categoriesFor(text: string, term: string): Set<Proficiency> {
  const found = new Set<Proficiency>();
  for (const sentence of evidenceSentences(text)) {
    if (!mentions(sentence, term)) continue;
    if (FAMILIARITY.test(sentence)) found.add("familiarity");
    if (COURSEWORK.test(sentence)) found.add("coursework");
    if (professionalNear(sentence, term)) found.add("professional");
    const relation = toolRelation(sentence, term);
    if (relation === "built") found.add("built");
    if (relation === "used" || usedAfterTerm(sentence, term)) found.add("used");
  }
  return found;
}

/**
 * Built practice implies the person used the tool and is familiar with it.
 * Coursework implies familiarity only. Use does not imply a project, coursework,
 * or professional experience.
 */
function categoryAllowed(claim: Proficiency, evidence: Set<Proficiency>): boolean {
  if (evidence.has(claim)) return true;
  if (claim === "familiarity") {
    return (
      evidence.has("used") ||
      evidence.has("built") ||
      evidence.has("professional") ||
      evidence.has("coursework")
    );
  }
  if (claim === "used") return evidence.has("built") || evidence.has("professional");
  return false;
}

function professionalNear(sentence: string, term: string): boolean {
  const at = termIndex(sentence, term);
  if (at < 0) return false;
  const window = tokenWindow(sentence, at, 5);
  return PROFESSIONAL.test(window);
}

/** The verb nearest the tool. "Built a product using Java" is use, not a Java project. */
function toolRelation(sentence: string, term: string): "built" | "used" | "none" {
  const at = termIndex(sentence, term);
  if (at < 0) return "none";
  const before = sentence.slice(0, at);
  const practice = [...before.matchAll(BUILD_VERB)];
  const instrument = [...before.matchAll(INSTRUMENT)];
  const lastPractice = practice.at(-1);
  const lastInstrument = instrument.at(-1);
  if (!lastPractice && !lastInstrument) return "none";
  const practiceAt = lastPractice?.index ?? -1;
  const instrumentAt = lastInstrument?.index ?? -1;
  if (instrumentAt > practiceAt) {
    const word = lastInstrument?.[1]?.toLowerCase() ?? "";
    return word === "used" || word === "using" || word === "use" ? "used" : "none";
  }
  const between = before.slice(practiceAt).trim().split(/\s+/);
  if (between.length > 5) return "none";
  return "built";
}

/** "Familiar with Java and has used it" states use. "Used Excel and studied Java" does not. */
function usedAfterTerm(sentence: string, term: string): boolean {
  const at = termIndex(sentence, term);
  if (at < 0) return false;
  const after = looseText(sentence).slice(at + normalizeMatchText(term).length);
  const used = /\b(used|using|use)\b/i.exec(after);
  if (!used || used.index === undefined) return false;
  const rest = after.slice(used.index + used[0].length);
  return !mentionedTerms(rest).some((other) => other !== term);
}

function termIndex(sentence: string, term: string): number {
  return looseText(sentence).indexOf(normalizeMatchText(term));
}

function tokenWindow(sentence: string, at: number, radius: number): string {
  const haystack = looseText(sentence);
  const tokens = haystack.split(/\s+/);
  let cursor = 0;
  let index = 0;
  for (const token of tokens) {
    if (cursor + token.length > at) break;
    cursor += token.length + 1;
    index += 1;
  }
  return tokens.slice(Math.max(0, index - radius), index + radius + 1).join(" ");
}

function mentionedTerms(text: string): string[] {
  const haystack = looseText(text);
  const found: string[] = [];
  const terms = [...TECH].sort((left, right) => right.length - left.length);
  for (const term of terms) {
    if (term.length < 3 || !termAppears(haystack, term)) continue;
    found.push(term);
  }
  return found;
}

function evidenceSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

function supported(token: string, evidence: string): boolean {
  const haystack = looseText(evidence);
  const needle = normalizeMatchText(token);
  return termAppears(haystack, needle);
}

function firstMatch(text: string, words: readonly string[]): string | null {
  for (const word of words) {
    if (mentions(text, word)) return word;
  }
  return null;
}

/** A known tool in the requirement that the cited evidence never names. */
function knownToolMissing(requirement: string, evidence: string): boolean {
  const asked = toolsNamed(requirement);
  if (asked.length === 0) return false;
  const haystack = normalizeMatchText(evidence);
  return asked.some((term) => !termAppears(haystack, term));
}

function toolsNamed(text: string): string[] {
  const haystack = normalizeMatchText(text);
  const found: string[] = [];
  const terms = [...KNOWN_TERMS].filter(toolTerm).sort((left, right) => right.length - left.length);
  for (const term of terms) {
    if (!termAppears(haystack, term)) continue;
    if (found.some((longer) => longer.includes(term))) continue;
    found.push(term);
  }
  return found;
}

function toolTerm(term: string): boolean {
  if (term.length >= 3) return true;
  return /[^a-z0-9]/.test(term);
}

function mentions(text: string, word: string): boolean {
  const haystack = looseText(text);
  return termAppears(haystack, word) || termAppears(haystack, `${word}s`);
}

/** Sentence periods are boundaries. A dot inside `.net` or `node.js` stays. */
function looseText(text: string): string {
  return normalizeMatchText(text).replace(/\.+(?![a-z0-9])/g, " ");
}

function lexiconPhrases(text: string): string[] {
  const haystack = looseText(text);
  const found: string[] = [];
  for (const term of TECH) {
    if (!term.includes(" ")) continue;
    if (termAppears(haystack, term)) found.push(term);
  }
  return found;
}

function tokens(text: string): string[] {
  const raw = text.match(/\.?[A-Za-z0-9][A-Za-z0-9+#.]*/g) ?? [];
  return raw
    .map((token) => token.replace(/\.+$/g, ""))
    .filter((token) => token.length > 0);
}

function isDistinctive(token: string): boolean {
  if (/^\d+(?:\.\d+)?%?\+?$/.test(token)) return false;
  if (/[0-9+#.]/.test(token)) return true;
  if (/^[A-Z]{2,8}$/.test(token)) return true;
  if (/[A-Z]/.test(token.slice(1))) return true;
  const key = token.toLowerCase();
  return TECH.has(key) && key.length >= 3;
}

function contentTokens(text: string): Set<string> {
  const words = normalizeMatchText(text).split(/[^a-z0-9+#.]/);
  const tokens = new Set<string>();
  for (const word of words) {
    if (word.length < 3 || STOP.has(word)) continue;
    tokens.add(word);
  }
  return tokens;
}

function jaccard(left: Set<string>, right: Set<string>): number {
  let shared = 0;
  for (const token of left) {
    if (right.has(token)) shared += 1;
  }
  const union = left.size + right.size - shared;
  return union === 0 ? 0 : shared / union;
}

function mentionedYears(evidence: string): number | null {
  const matches = evidence.matchAll(/(\d+)\s*\+?\s*-?\s*years?/gi);
  let best: number | null = null;
  for (const match of matches) {
    const value = Number(match[1]);
    if (best === null || value > best) best = value;
  }
  return best;
}

function wholeYears(entry: SnapshotEntry, takenAt: string): number {
  const start = entry.startDate ? parseResumeDate(entry.startDate) : null;
  if (!start) return 0;
  const startMonth = start.month ?? 1;
  let endYear: number;
  let endMonth: number;
  if (entry.isCurrent) {
    const taken = new Date(takenAt);
    if (Number.isNaN(taken.getTime())) return 0;
    endYear = taken.getUTCFullYear();
    endMonth = taken.getUTCMonth() + 1;
  } else if (entry.endDate) {
    const end = parseResumeDate(entry.endDate);
    if (!end) return 0;
    endYear = end.year;
    endMonth = end.month ?? 12;
  } else {
    return 0;
  }
  const months = (endYear - start.year) * 12 + (endMonth - startMonth);
  return months > 0 ? Math.floor(months / 12) : 0;
}
