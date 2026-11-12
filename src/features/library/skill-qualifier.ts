/**
 * A stated level stays on the skill name. "basic SQL" is not stored as "SQL",
 * and "Excel (coursework)" is not stored as "Excel". Nothing here invents a level
 * the source did not write.
 */

const LEADING =
  /^(basic|introductory|beginner|familiarity with|familiar with|exposure to)\s+(.+)$/i;
const PAREN = /^(.+?)\s*\((coursework|academic|familiar|introductory|basic|beginner)\)\s*$/i;

export type SkillLevel = "basic" | "coursework";

export type ParsedSkill = {
  /** Name to store, including a level the source stated. */
  name: string;
  /** The tool or skill without that level. */
  tool: string;
  qualifier: SkillLevel | null;
};

export function parseSkillQualifier(name: string): ParsedSkill {
  const trimmed = name.replace(/\s+/g, " ").trim();
  const paren = PAREN.exec(trimmed);
  if (paren?.[1] && paren[2]) {
    const kind = paren[2].toLowerCase();
    return {
      name: trimmed,
      tool: paren[1].trim(),
      qualifier: kind === "coursework" || kind === "academic" ? "coursework" : "basic",
    };
  }
  const leading = LEADING.exec(trimmed);
  if (leading?.[1] && leading[2]) {
    return { name: trimmed, tool: leading[2].trim(), qualifier: "basic" };
  }
  return { name: trimmed, tool: trimmed, qualifier: null };
}

/**
 * When the extracted name dropped a level that the resume text still states,
 * put that level back on the name. A skill with no stated level is left as it is.
 */
export function restoreSkillQualifiers<T extends { name: string }>(
  skills: readonly T[],
  corpus: string,
): T[] {
  const haystack = corpus.replace(/\s+/g, " ");
  return skills.map((skill) => {
    const parsed = parseSkillQualifier(skill.name);
    if (parsed.qualifier || parsed.tool.length < 2) return skill;
    const qualified = qualifierInText(haystack, parsed.tool);
    if (!qualified || qualified.length > 50) return skill;
    return { ...skill, name: qualified };
  });
}

/** Printable runs from a PDF, so a level written in the file can be kept. */
export function visibleFileText(bytes: Uint8Array): string {
  const text = Buffer.from(bytes).toString("latin1");
  return (text.match(/[\x20-\x7E]{4,}/g) ?? []).join("\n");
}

function qualifierInText(haystack: string, tool: string): string | null {
  const escaped = tool.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const coursework = new RegExp(`${escaped}\\s*\\(\\s*(?:coursework|academic)\\s*\\)`, "i").exec(
    haystack,
  );
  if (coursework) return `${tool} (coursework)`;
  const basic = new RegExp(
    `\\b(?:basic|introductory|beginner|familiarity with|familiar with|exposure to)\\s+${escaped}\\b`,
    "i",
  ).exec(haystack);
  if (!basic) return null;
  const word = basic[0].toLowerCase();
  if (word.startsWith("familiarity with")) return `familiarity with ${tool}`;
  if (word.startsWith("familiar with")) return `familiar with ${tool}`;
  if (word.startsWith("exposure to")) return `exposure to ${tool}`;
  if (word.startsWith("introductory")) return `introductory ${tool}`;
  if (word.startsWith("beginner")) return `beginner ${tool}`;
  return `basic ${tool}`;
}
