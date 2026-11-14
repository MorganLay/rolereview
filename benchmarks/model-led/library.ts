/**
 * Full-library input for model-led-v1.
 * Every entry and skill is listed. Nothing is dropped for a keyword score.
 */
import type { LibrarySnapshot } from "@/features/library/schemas";
import { libraryPromptText } from "@/features/library/serialize";

/** Planning budget for the library block. The posting and the instructions sit beside it. */
export const LIBRARY_TOKEN_BUDGET = 80_000;

export type LibraryReport = {
  entries: number;
  bullets: number;
  skills: number;
  characters: number;
  approximateTokens: number;
  fitsBudget: boolean;
  note: string;
};

export function careerLibraryInput(
  snapshot: LibrarySnapshot,
  structured = true,
): { text: string; report: LibraryReport } {
  const text = structured ? libraryPromptText(snapshot) : unstructuredLibrary(snapshot);
  const report = inspectLibrary(text, snapshot);
  return { text, report };
}

export function inspectLibrary(text: string, snapshot: LibrarySnapshot): LibraryReport {
  const approximateTokens = Math.ceil(text.length / 4);
  const fitsBudget = approximateTokens <= LIBRARY_TOKEN_BUDGET;
  return {
    entries: snapshot.entries.length,
    bullets: snapshot.entries.reduce((sum, entry) => sum + entry.bullets.length, 0),
    skills: snapshot.skills.length,
    characters: text.length,
    approximateTokens,
    fitsBudget,
    note: fitsBudget
      ? "The normalized library fits the planning budget. Every entry and skill is in the prompt."
      : `About ${approximateTokens} tokens. The planning budget is ${LIBRARY_TOKEN_BUDGET}. Do not send this library as if the model had seen all of it.`,
  };
}

function unstructuredLibrary(snapshot: LibrarySnapshot): string {
  const lines: string[] = [];
  for (const entry of snapshot.entries) {
    lines.push(
      [entry.kind, entry.title, entry.organization ?? "", entry.location ?? ""].filter((part) => part.length > 0).join(" | "),
    );
    for (const bullet of entry.bullets) lines.push(bullet.text);
  }
  if (snapshot.skills.length > 0) {
    lines.push("Skills");
    for (const skill of snapshot.skills) lines.push(skill.name);
  }
  return lines.join("\n");
}
