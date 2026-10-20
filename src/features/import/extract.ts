import "server-only";

import mammoth from "mammoth";

import { strings } from "@/copy/strings";
import type { ImportOutput } from "@/lib/ai/prompts/import";

import { parseResumeDate, resumeDatesInOrder } from "../library/dates";
import {
  BULLET_LIMITS,
  ENTRY_LIMITS,
  PROFILE_LIMITS,
  SKILL_LIMITS,
} from "../library/schemas";
import { skillNameKey } from "../library/skill-state";
import {
  DOCX_MIME,
  IMPORT_LIMITS,
  PDF_MIME,
} from "./schemas";

/**
 * File checks and IMPORT post-processing. Nothing here calls the model or
 * writes the library. docs/05-AI.md → IMPORT.
 */

const copy = strings.library.import;

export type UploadKind = "pdf" | "docx";

export type UploadRejection = "empty" | "too_large" | "not_resume";

export type ExtractedLink = { label: string; url: string };

export type ExtractedProfile = {
  fullName: string | null;
  headline: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  links: ExtractedLink[];
  summary: string | null;
};

export type ExtractedBullet = { text: string; long: boolean };

export type ExtractedEntry = {
  kind: ImportOutput["entries"][number]["kind"];
  title: string;
  organization: string | null;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  url: string | null;
  bullets: ExtractedBullet[];
};

export type ExtractedSkill = { name: string; category: string | null };

export type ExtractedResume = {
  profile: ExtractedProfile;
  entries: ExtractedEntry[];
  skills: ExtractedSkill[];
  warnings: string[];
};

const PRESENT_END = /^(present|current|now|ongoing)$/i;

export function classifyUpload(
  bytes: Uint8Array,
  declaredType: string,
): { ok: true; kind: UploadKind } | { ok: false; reason: UploadRejection } {
  if (bytes.byteLength === 0) return { ok: false, reason: "empty" };
  if (bytes.byteLength > IMPORT_LIMITS.fileBytes) {
    return { ok: false, reason: "too_large" };
  }
  const kind = sniff(bytes);
  if (!kind || !mimeAllows(declaredType, kind)) {
    return { ok: false, reason: "not_resume" };
  }
  return { ok: true, kind };
}

export function textBounds(text: string): "ok" | "short" | "long" {
  if (text.length < IMPORT_LIMITS.textMin) return "short";
  if (text.length > IMPORT_LIMITS.textMax) return "long";
  return "ok";
}

/** null when mammoth cannot read the buffer. An empty string is readable. */
export async function extractDocxText(bytes: Uint8Array): Promise<string | null> {
  try {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    return result.value;
  } catch {
    return null;
  }
}

export function postProcessImport(raw: ImportOutput): ExtractedResume {
  const warnings: string[] = [];
  for (const warning of raw.warnings) {
    const trimmed = warning.trim();
    if (trimmed.length === 0) continue;
    warnings.push(clipWarning(trimmed));
  }

  const profile = cleanProfile(raw.profile, warnings);
  const entries = cleanEntries(raw.entries, warnings);
  const skills = cleanSkills(raw.skills, warnings);

  const placed =
    entries.length > 0 ||
    skills.length > 0 ||
    profile.fullName !== null ||
    profile.headline !== null ||
    profile.email !== null ||
    profile.phone !== null ||
    profile.location !== null ||
    profile.summary !== null ||
    profile.links.length > 0;
  if (!placed) warnings.push(copy.warnings.nothing);

  return {
    profile,
    entries,
    skills,
    warnings: dedupeWarnings(warnings),
  };
}

/** http(s) only. A bare domain gets https://. Too long or not a host → null. */
export function normalizeWebUrl(raw: string, maxLength: number): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || /\s/.test(trimmed)) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname.includes(".")) return null;
  if (url.username !== "" || url.password !== "") return null;
  if (url.href.length > maxLength) return null;
  return url.href;
}

function sniff(bytes: Uint8Array): UploadKind | null {
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  ) {
    return "pdf";
  }
  if (bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b) {
    return "docx";
  }
  return null;
}

function mimeAllows(declaredType: string, kind: UploadKind): boolean {
  const type = declaredType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (type === "" || type === "application/octet-stream") return true;
  return kind === "pdf" ? type === PDF_MIME : type === DOCX_MIME;
}

function cleanProfile(
  profile: ImportOutput["profile"],
  warnings: string[],
): ExtractedProfile {
  return {
    fullName: clamp(profile.fullName, PROFILE_LIMITS.fullName, copy.warnings.name, warnings),
    headline: clamp(
      profile.headline,
      PROFILE_LIMITS.headline,
      copy.warnings.headline,
      warnings,
    ),
    email: clamp(profile.email, IMPORT_LIMITS.email, copy.warnings.email, warnings),
    phone: clamp(profile.phone, PROFILE_LIMITS.phone, copy.warnings.phone, warnings),
    location: clamp(
      profile.location,
      PROFILE_LIMITS.location,
      copy.warnings.location,
      warnings,
    ),
    summary: clamp(
      profile.summary,
      PROFILE_LIMITS.summary,
      copy.warnings.summary,
      warnings,
    ),
    links: cleanLinks(profile.links, warnings),
  };
}

function cleanEntries(
  entries: ImportOutput["entries"],
  warnings: string[],
): ExtractedEntry[] {
  const cleaned: ExtractedEntry[] = [];
  let droppedUntitled = false;
  for (const entry of entries) {
    const title = clamp(entry.title, ENTRY_LIMITS.title, copy.warnings.title, warnings);
    if (title === null) {
      droppedUntitled = true;
      continue;
    }
    const start = cleanDate(entry.startDate, "start");
    const end = cleanDate(entry.endDate, "end");
    const startDate = start.date;
    let endDate = end.present ? null : end.date;
    const isCurrent = entry.isCurrent || end.present;
    let dateProblem = start.invalid || end.invalid;
    if (isCurrent) endDate = null;
    if (
      !dateProblem &&
      !isCurrent &&
      !resumeDatesInOrder(startDate, endDate)
    ) {
      endDate = null;
      dateProblem = true;
    }
    if (dateProblem) warnings.push(copy.warnings.datesUnclear(title));

    const urlRaw = entry.url?.trim() ?? "";
    const url =
      urlRaw.length === 0 ? null : normalizeWebUrl(urlRaw, ENTRY_LIMITS.url);
    if (urlRaw.length > 0 && url === null) {
      warnings.push(copy.warnings.entryLink(title));
    }

    cleaned.push({
      kind: entry.kind,
      title,
      organization: clamp(
        entry.organization,
        ENTRY_LIMITS.organization,
        copy.warnings.organization,
        warnings,
      ),
      location: clamp(
        entry.location,
        ENTRY_LIMITS.location,
        copy.warnings.entryLocation,
        warnings,
      ),
      startDate,
      endDate,
      isCurrent,
      url,
      bullets: cleanBullets(entry.bullets, warnings),
    });
  }
  if (droppedUntitled) warnings.push(copy.warnings.untitled);
  return cleaned;
}

function cleanDate(
  value: string | null,
  role: "start" | "end",
): { date: string | null; present: boolean; invalid: boolean } {
  if (value === null) return { date: null, present: false, invalid: false };
  const trimmed = value.trim();
  if (trimmed.length === 0) return { date: null, present: false, invalid: false };
  if (role === "end" && PRESENT_END.test(trimmed)) {
    return { date: null, present: true, invalid: false };
  }
  if (parseResumeDate(trimmed) === null) {
    return { date: null, present: false, invalid: true };
  }
  return { date: trimmed, present: false, invalid: false };
}

function cleanBullets(bullets: string[], warnings: string[]): ExtractedBullet[] {
  const cleaned: ExtractedBullet[] = [];
  let cut = false;
  for (const bullet of bullets) {
    const trimmed = bullet.trim();
    if (trimmed.length === 0) continue;
    const long = trimmed.length > BULLET_LIMITS.text;
    let text = trimmed;
    if (text.length > IMPORT_LIMITS.bulletHardMax) {
      text = text.slice(0, IMPORT_LIMITS.bulletHardMax);
      cut = true;
    }
    cleaned.push({ text, long });
  }
  if (cut) warnings.push(copy.warnings.bulletCut);
  return cleaned;
}

function cleanSkills(
  skills: ImportOutput["skills"],
  warnings: string[],
): ExtractedSkill[] {
  const seen = new Set<string>();
  const cleaned: ExtractedSkill[] = [];
  let droppedLong = false;
  let shortenedCategory = false;
  for (const skill of skills) {
    const name = skill.name.trim();
    if (name.length === 0) continue;
    if (name.length > SKILL_LIMITS.name) {
      droppedLong = true;
      continue;
    }
    const key = skillNameKey(name);
    if (seen.has(key)) continue;
    seen.add(key);
    const category = clampCategory(skill.category);
    if (category.shortened) shortenedCategory = true;
    cleaned.push({ name, category: category.value });
  }
  if (droppedLong) warnings.push(copy.warnings.skillLong);
  if (shortenedCategory) warnings.push(copy.warnings.category);
  return cleaned;
}

function clampCategory(value: string | null): {
  value: string | null;
  shortened: boolean;
} {
  const trimmed = value?.trim() ?? "";
  if (trimmed.length === 0) return { value: null, shortened: false };
  if (trimmed.length <= SKILL_LIMITS.category) {
    return { value: trimmed, shortened: false };
  }
  return { value: trimmed.slice(0, SKILL_LIMITS.category), shortened: true };
}

function cleanLinks(
  links: ImportOutput["profile"]["links"],
  warnings: string[],
): ExtractedLink[] {
  const cleaned: ExtractedLink[] = [];
  let bad = false;
  let shortenedLabel = false;
  let extra = false;
  for (const link of links) {
    const labelRaw = link.label.trim();
    const urlRaw = link.url.trim();
    const url = normalizeWebUrl(urlRaw, PROFILE_LIMITS.linkUrl);
    if (labelRaw.length === 0 || url === null) {
      if (labelRaw.length > 0 || urlRaw.length > 0) bad = true;
      continue;
    }
    if (cleaned.length >= PROFILE_LIMITS.links) {
      extra = true;
      continue;
    }
    let label = labelRaw;
    if (label.length > PROFILE_LIMITS.linkLabel) {
      label = label.slice(0, PROFILE_LIMITS.linkLabel);
      shortenedLabel = true;
    }
    cleaned.push({ label, url });
  }
  if (bad) warnings.push(copy.warnings.linkBad);
  if (shortenedLabel) warnings.push(copy.warnings.linkLabel);
  if (extra) warnings.push(copy.warnings.linksKept);
  return cleaned;
}

function clamp(
  value: string | null,
  max: number,
  warning: string,
  warnings: string[],
): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length <= max) return trimmed;
  warnings.push(warning);
  return trimmed.slice(0, max);
}

function clipWarning(warning: string): string {
  if (warning.length <= IMPORT_LIMITS.warningLength) return warning;
  return `${warning.slice(0, IMPORT_LIMITS.warningLength - 1)}…`;
}

function dedupeWarnings(warnings: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const warning of warnings) {
    if (seen.has(warning)) continue;
    seen.add(warning);
    unique.push(warning);
    if (unique.length >= IMPORT_LIMITS.warningsMax) break;
  }
  return unique;
}
