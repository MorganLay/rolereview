/**
 * Turns a benchmark resume into a library snapshot.
 * Paragraph employment, credentials, and bullets stay as source text.
 * A Skills line becomes one skill per item. Achievement sentences stay one entry.
 * A heading that states one year range fills the date fields. No facts are added.
 */
import { careerPieces, looksLikeRoleList, normalizeCareerEntries } from "@/features/import/career";
import { LibrarySnapshot, type LibrarySnapshot as Snapshot } from "@/features/library/schemas";

const PREAMBLE = [
  /^Processed public example\b/i,
  /^CareerCorpus category\b/i,
  /^The dataset publisher\b/i,
  /^Contact details from the source\b/i,
];

export type FixtureSpan = {
  label: string;
  text: string;
  outcome: "preserved" | "transformed" | "unparsed";
  material: boolean;
  ref: string | null;
  note: string;
  /** Experience paragraph this span was cut from, when a line held more than one role. */
  paragraph: string | null;
  /** Exact slice of `paragraph` for this role, including its heading. */
  sourceSpan: string | null;
};

type Kind = Snapshot["entries"][number]["kind"];

export function adaptFixtureResume(resume: string): { snapshot: Snapshot; spans: FixtureSpan[] } {
  const lines = resume.split(/\r?\n/);
  const spans: FixtureSpan[] = [];
  const entries: Snapshot["entries"] = [];
  const skills: Snapshot["skills"] = [];
  let name: string | null = null;
  let named = false;
  let current: Snapshot["entries"][number] | null = null;
  let entryCount = 0;

  const push = () => {
    if (current && (current.bullets.length > 0 || current.title.trim().length > 0)) entries.push(current);
    current = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (line.length === 0) continue;
    if (PREAMBLE.some((pattern) => pattern.test(line))) {
      spans.push({
        label: "preamble",
        text: line,
        outcome: "unparsed",
        material: false,
        ref: null,
        note: "Fixture note. Not candidate evidence.",
        paragraph: null,
        sourceSpan: null,
      });
      continue;
    }
    const labelled = labelledSection(line);
    if (!named && !labelled && !line.startsWith("- ") && !line.includes("|")) {
      name = line;
      named = true;
      spans.push({
        label: "name",
        text: line,
        outcome: "preserved",
        material: false,
        ref: null,
        note: "Stored as the profile name.",
        paragraph: null,
        sourceSpan: null,
      });
      continue;
    }
    if (labelled) {
      push();
      if (labelled.label === "skills") {
        const parsed = parseSkillLine(labelled.body);
        const firstSkill = skills.length + 1;
        for (const skillName of parsed.skills) {
          const ref = `S${skills.length + 1}`;
          skills.push({ ref, id: ref, name: skillName, category: null });
        }
        let ref: string | null = parsed.skills.length > 0 ? `S${firstSkill}` : null;
        if (parsed.achievements.length > 0) {
          entryCount += 1;
          ref = `E${entryCount}`;
          entries.push(entry(ref, "OTHER", "", null, parsed.achievements, null));
        }
        spans.push({
          label: "skills",
          text: labelled.body,
          outcome: "transformed",
          material: true,
          ref,
          paragraph: null,
          sourceSpan: labelled.body,
          note:
            parsed.achievements.length > 0
              ? "Skill items are separate skills. Achievement sentences stayed one entry. No facts were added."
              : "One skill per item. Stated qualifiers stayed with the skill. No facts were added.",
        });
        continue;
      }
      if (labelled.kind === "EXPERIENCE") {
        const pieces = careerPieces(labelled.body);
        if (pieces && pieces.length > 1) {
          const normalized = normalizeCareerEntries(
            [
              {
                kind: "EXPERIENCE",
                title: labelled.body,
                organization: null,
                location: null,
                startDate: null,
                endDate: null,
                isCurrent: false,
                url: null,
                bullets: [{ text: labelled.body, long: false }],
              },
            ],
            labelled.body,
          );
          for (const item of normalized.entries) {
            const piece =
              pieces.find((candidate) => candidate.title === item.title) ??
              pieces.find((candidate) => candidate.title.startsWith(item.title));
            entryCount += 1;
            const ref = `E${entryCount}`;
            entries.push(
              entry(
                ref,
                "EXPERIENCE",
                item.title,
                null,
                item.bullets.map((bullet) => bullet.text),
                item.title,
              ),
            );
            spans.push({
              label: piece?.unresolved ? "employment-unresolved" : "employment",
              text: piece?.duties || item.title,
              outcome: "transformed",
              material: true,
              ref,
              paragraph: labelled.body,
              sourceSpan: piece?.sourceSpan ?? item.title,
              note: piece?.unresolved
                ? "Role boundary was not clear, so this text stayed one entry. No employers were added."
                : `Exact source span for one role. ${datesNote(item.title)}`,
            });
          }
          spans.push({
            label: "employment-paragraph",
            text: labelled.body,
            outcome: "transformed",
            material: false,
            ref: null,
            paragraph: labelled.body,
            sourceSpan: labelled.body,
            note: "Original paragraph. Clear roles are separate entries. Ambiguous text stayed one entry.",
          });
          continue;
        }
      }
      entryCount += 1;
      const ref = `E${entryCount}`;
      const title = headingClause(labelled.body, labelled.fallback);
      const extra = additionalText(labelled.body, title);
      const sharedRoles = labelled.kind === "EXPERIENCE" && extra.length > 0 && looksLikeRoleList(extra);
      const storedTitle = sharedRoles ? labelled.body : title;
      const bullets = sharedRoles || extra.length === 0 ? [] : additionalBullets(title, extra);
      current = entry(ref, labelled.kind, storedTitle, null, bullets, labelled.body);
      spans.push({
        label: labelled.label,
        text: labelled.body,
        outcome: storedTitle === labelled.body && bullets.length === 0 ? "preserved" : "transformed",
        material: true,
        ref,
        paragraph: null,
        sourceSpan: labelled.body,
        note: sharedRoles
          ? "Several titles share one duties clause, so they stayed one entry."
          : spanNote(labelled.label, storedTitle, bullets.length),
      });
      push();
      continue;
    }
    if (line.includes("|")) {
      push();
      entryCount += 1;
      const ref = `E${entryCount}`;
      const pipe = line.indexOf("|");
      const title = line.slice(0, pipe).trim() || line;
      const organization = line.slice(pipe + 1).trim() || null;
      current = entry(ref, "EXPERIENCE", title, organization, [], line);
      spans.push({
        label: "employment",
        text: line,
        outcome: "preserved",
        material: true,
        ref,
        note: `Title and organization were split on the bar. ${datesNote(line)}`,
        paragraph: null,
        sourceSpan: line,
      });
      continue;
    }
    if (line.startsWith("- ")) {
      const text = line.slice(2).trim();
      if (!current) {
        entryCount += 1;
        current = entry(`E${entryCount}`, "EXPERIENCE", "Experience", null, []);
      }
      const ref = `${current.ref}.B${current.bullets.length + 1}`;
      current.bullets.push({ ref, id: ref, text });
      spans.push({
        label: "bullet",
        text,
        outcome: "preserved",
        material: true,
        ref,
        note: "Kept as a bullet on the open entry.",
        paragraph: null,
        sourceSpan: text,
      });
      continue;
    }
    if (isPlaceLine(line)) {
      spans.push({
        label: "location",
        text: line,
        outcome: "unparsed",
        material: false,
        ref: null,
        note: "Left unparsed. It was not turned into a job.",
        paragraph: null,
        sourceSpan: null,
      });
      continue;
    }
    const pieces = chunks(line);
    if (!current) {
      entryCount += 1;
      const ref = `E${entryCount}`;
      current = entry(ref, "EXPERIENCE", headingClause(line, "Experience"), null, pieces, line);
      spans.push({
        label: "employment",
        text: line,
        outcome: "transformed",
        material: true,
        ref,
        note: "Stored as one employment entry. Dates stay in the text.",
        paragraph: null,
        sourceSpan: line,
      });
      push();
      continue;
    }
    for (const piece of pieces) {
      const ref = `${current.ref}.B${current.bullets.length + 1}`;
      current.bullets.push({ ref, id: ref, text: piece });
    }
    spans.push({
      label: "employment",
      text: line,
      outcome: pieces.length > 1 ? "transformed" : "preserved",
      material: true,
      ref: current.ref,
      note: "Attached to the open role. No words were added.",
      paragraph: null,
      sourceSpan: line,
    });
  }
  push();

  const snapshot = LibrarySnapshot.parse({
    takenAt: "2026-11-12T00:00:00.000Z",
    profile: {
      fullName: name,
      headline: null,
      email: "",
      phone: null,
      location: null,
      links: [],
      summary: null,
    },
    entries,
    skills,
  });
  return { snapshot, spans };
}

/** Material source text that the snapshot does not contain. */
export function evidenceGaps(snapshot: Snapshot, spans: readonly FixtureSpan[]): FixtureSpan[] {
  const haystack = compact(snapshotText(snapshot));
  const gaps: FixtureSpan[] = [];
  for (const span of spans) {
    if (span.label === "employment-paragraph") {
      const missing = contentWords(span.text).filter((word) => !haystack.includes(compact(word)));
      if (missing.length > 0) {
        gaps.push({
          ...span,
          outcome: "unparsed",
          note: "A word from the original paragraph is not in the library.",
        });
      }
      continue;
    }
    if (!span.material) continue;
    if (span.outcome === "unparsed" || !wordsCovered(haystack, span.text)) {
      gaps.push(
        span.outcome === "unparsed"
          ? span
          : { ...span, outcome: "unparsed", note: "Source text is not in the library." },
      );
    }
  }
  return gaps;
}

function additionalText(body: string, title: string): string {
  if (body === title) return "";
  if (!body.startsWith(title)) return body;
  return body.slice(title.length).replace(/^[\s:;—–-]+/, "").trim();
}

function additionalBullets(title: string, text: string): string[] {
  const bullet = text.trim();
  if (bullet.length === 0) return [];
  if (compact(bullet) === compact(title)) return [];
  if (compact(title).includes(compact(bullet))) return [];
  return [bullet];
}

function labelledSection(line: string): { kind: Kind; body: string; label: string; fallback: string } | null {
  const match = /^(Education|Certification|Certifications|Skills|Experience):\s*(.*)$/i.exec(line);
  if (!match) return null;
  const word = match[1]?.toLowerCase() ?? "";
  const body = match[2]?.trim() ?? "";
  if (body.length === 0) return null;
  if (word === "education") return { kind: "EDUCATION", body, label: "education", fallback: "Education" };
  if (word.startsWith("cert")) return { kind: "CERTIFICATION", body, label: "certification", fallback: "Certification" };
  if (word === "skills") return { kind: "OTHER", body, label: "skills", fallback: "Skills" };
  return { kind: "EXPERIENCE", body, label: "employment", fallback: "Experience" };
}

const ACHIEVEMENT =
  /\b(ranked|ranking|ranks|award|awards|nominee|recognition|recognitions|recognized)\b|#\s*\d|\btop\s+(rep|producer|performer)\b/i;
const ACHIEVEMENT_START =
  /^(ranked|recognized|recognitions|drove|led|built|scaled|expanded|maintained|raised|generated|improved|supported|top\b|#)/i;
const RESULT_VERB =
  /\b(drove|led|built|scaled|expanded|maintained|raised|generated|improved|saved|cut|grew|oversaw|oversee|supported)\b/i;
function parseSkillLine(body: string): { skills: string[]; achievements: string[] } {
  const skills: string[] = [];
  const achievements: string[] = [];
  for (const clause of splitOutside(body, /[;.]/)) {
    const items = splitOutside(clause, /,/);
    for (const item of items.length > 0 ? items : [clause]) {
      if (isAchievement(item)) achievements.push(item);
      else if (item.length > 0) skills.push(item);
    }
  }
  if (skills.length === 0 && achievements.length === 0 && body.trim().length > 0) {
    skills.push(body.trim());
  }
  return { skills, achievements };
}

function isAchievement(clause: string): boolean {
  const text = clause.trim();
  if (ACHIEVEMENT.test(text) || ACHIEVEMENT_START.test(text)) return true;
  return /\d/.test(text) && RESULT_VERB.test(text);
}

/** Splits on a separator that sits outside parentheses. Decimal points stay put. */
function splitOutside(text: string, separator: RegExp): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index] ?? "";
    if (char === "(") depth += 1;
    else if (char === ")" && depth > 0) depth -= 1;
    const previous = text[index - 1] ?? "";
    const next = text[index + 1];
    const decimal = char === "." && /\d/.test(previous);
    const boundary =
      depth === 0 && !decimal && separator.test(char) && (char !== "." || next === undefined || next === " ");
    if (boundary) {
      const piece = current.trim().replace(/^[;,.\s]+|[;,.\s]+$/g, "");
      if (piece.length > 0) parts.push(piece);
      current = "";
      continue;
    }
    current += char;
  }
  const tail = current.trim().replace(/^[;,.\s]+|[;,.\s]+$/g, "");
  if (tail.length > 0) parts.push(tail);
  return parts;
}

function datesFromHeading(text: string): { startDate: string | null; endDate: string | null; isCurrent: boolean } {
  const yearRange =
    /(?:(\d{1,2})\/)?((?:19|20)\d{2})\s*[–—-]\s*(?:(\d{1,2})\/)?((?:19|20)\d{2}|present|current)/gi;
  const matches = [...text.matchAll(yearRange)];
  if (matches.length !== 1) return emptyDates();
  const match = matches[0];
  const startYear = match?.[2];
  const endRaw = match?.[4];
  if (!match || !startYear || !endRaw) return emptyDates();
  const startDate = isoDate(startYear, match[1]);
  if (!startDate) return emptyDates();
  if (/^(present|current)$/i.test(endRaw)) return { startDate, endDate: null, isCurrent: true };
  const endDate = isoDate(endRaw, match[3]);
  if (!endDate) return emptyDates();
  return { startDate, endDate, isCurrent: false };
}

function isoDate(year: string, month: string | undefined): string | null {
  if (!month) return year;
  const value = Number(month);
  if (!Number.isInteger(value) || value < 1 || value > 12) return null;
  return `${year}-${String(value).padStart(2, "0")}`;
}

function emptyDates(): { startDate: string | null; endDate: string | null; isCurrent: boolean } {
  return { startDate: null, endDate: null, isCurrent: false };
}

function datesNote(heading: string): string {
  const dates = datesFromHeading(heading);
  if (!dates.startDate) return "No single year range was stated, so date fields were left empty.";
  return "The heading's year range was copied into the date fields. No other date was added.";
}

function headingClause(body: string, fallback: string): string {
  const cut = body.split(/:|;|—| - /)[0]?.trim() ?? "";
  if (cut.length >= 3 && cut.length <= 80 && cut.length < body.length) return cut;
  if (body.length > 0 && body.length <= 80) return body;
  return fallback;
}

function spanNote(label: string, title: string, pieces: number): string {
  const split = pieces > 1 ? " Split on whitespace. No words were added." : "";
  if (label === "employment") {
    return `The full paragraph is in the bullets. The heading is "${title}". ${datesNote(title)}${split}`;
  }
  if (label === "skills") {
    return `Stored as one skills entry so the paragraph is not dropped.${split}`;
  }
  return `Stored as one ${label} entry.${split}`;
}

function chunks(text: string): string[] {
  const body = text.trim();
  return body.length > 0 ? [body] : [];
}

function entry(
  ref: string,
  kind: Kind,
  title: string,
  organization: string | null,
  bullets: string[],
  heading: string | null = null,
): Snapshot["entries"][number] {
  const dates = heading && kind !== "OTHER" ? datesFromHeading(heading) : emptyDates();
  return {
    ref,
    id: ref,
    kind,
    title,
    organization,
    location: null,
    startDate: dates.startDate,
    endDate: dates.endDate,
    isCurrent: dates.isCurrent,
    url: null,
    bullets: bullets.map((text, index) => {
      const bulletRef = `${ref}.B${index + 1}`;
      return { ref: bulletRef, id: bulletRef, text };
    }),
  };
}

function isPlaceLine(line: string): boolean {
  return line.length <= 40 && !/\d/.test(line) && !line.includes(" ") && !line.includes("|") && !line.includes(":");
}

function snapshotText(snapshot: Snapshot): string {
  const parts = [
    snapshot.profile.fullName ?? "",
    ...snapshot.entries.flatMap((item) => [
      item.title,
      item.organization ?? "",
      ...item.bullets.map((bullet) => bullet.text),
    ]),
    ...snapshot.skills.map((skill) => skill.name),
  ];
  return parts.join(" ");
}

function compact(value: string): string {
  return value.toLowerCase().replace(/[\s|'"’“”]+/g, "");
}

/** Words in `text` that the snapshot does not contain. Same folding as evidenceGaps. */
export function uncoveredWords(snapshot: Snapshot, text: string): string[] {
  const haystack = compact(snapshotText(snapshot));
  return contentWords(text).filter((word) => !haystack.includes(compact(word)));
}

function contentWords(value: string): string[] {
  return value
    .split(/[\s–—-]+/)
    .map((word) => word.replace(/^[^A-Za-z0-9%$→]+|[^A-Za-z0-9%$→]+$/g, ""))
    .filter((word) => word.length > 0);
}

function wordsCovered(haystack: string, text: string): boolean {
  const words = contentWords(text);
  if (words.length === 0) return haystack.includes(compact(text));
  return words.every((word) => haystack.includes(compact(word)));
}
