/**
 * Text the library already stores. Rewrites may use this and nothing else.
 */

import type { Library, LibraryEntry } from "./types";

const CONTEXT_MAX = 8_000;

export function libraryEvidence(library: Library): string[] {
  const parts: string[] = [];
  const profile = library.profile;
  push(parts, profile.fullName);
  push(parts, profile.headline);
  push(parts, profile.summary);
  push(parts, profile.location);
  for (const entry of library.entries) {
    push(parts, entry.title);
    push(parts, entry.organization);
    push(parts, entry.location);
    for (const bullet of entry.bullets) push(parts, bullet.text);
  }
  for (const skill of library.skills) push(parts, skill.name);
  return parts;
}

export function entryTitles(library: Library): string[] {
  return library.entries.map((entry) => entry.title);
}

/** The entry in full, then the rest of the library, capped for the prompt. */
export function libraryContext(library: Library, entryId: string): string {
  const focus = library.entries.find((entry) => entry.id === entryId);
  const lines: string[] = [];
  if (focus) lines.push(entryBlock(focus));
  lines.push("OTHER SAVED MATERIAL");
  for (const entry of library.entries) {
    if (entry.id === entryId) continue;
    lines.push(entryBlock(entry));
  }
  for (const skill of library.skills) lines.push(`Skill: ${oneLine(skill.name)}`);
  const profile = library.profile;
  if (profile.headline) lines.push(`Headline: ${oneLine(profile.headline)}`);
  if (profile.summary) lines.push(`Summary: ${oneLine(profile.summary)}`);
  return clip(lines.join("\n"), CONTEXT_MAX);
}

function entryBlock(entry: LibraryEntry): string {
  const place = [entry.organization, entry.title].filter(Boolean).join(" — ");
  const lines = [place.length > 0 ? place : "Untitled"];
  for (const bullet of entry.bullets) lines.push(`- ${oneLine(bullet.text)}`);
  return lines.join("\n");
}

function push(parts: string[], value: string | null): void {
  const trimmed = value?.trim() ?? "";
  if (trimmed.length > 0) parts.push(trimmed);
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function clip(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}
