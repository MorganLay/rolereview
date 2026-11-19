import { strings } from "@/copy/strings";

import { BULLET_LIMITS, ENTRY_LIMITS } from "../library/schemas";
import { IMPORT_LIMITS } from "./schemas";

/**
 * Source check for jobs the import model returns. A paragraph that names
 * several jobs is split only where each job has its own heading and duties.
 * A sentence that does not name one job stays on its own entry. Dates and
 * employers that are not in that job's source span are cleared.
 * docs/05-AI.md → IMPORT.
 */

const copy = strings.library.import.warnings;

export type CareerBullet = { text: string; long: boolean };

export type CareerEntry = {
  kind: "EXPERIENCE" | "PROJECT" | "EDUCATION" | "CERTIFICATION" | "VOLUNTEER" | "OTHER";
  title: string;
  organization: string | null;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  url: string | null;
  bullets: CareerBullet[];
};

export type CareerPiece = {
  title: string;
  duties: string;
  sourceSpan: string;
  unresolved: boolean;
  index: number;
};

export function normalizeCareerEntries<T extends CareerEntry>(
  entries: readonly T[],
  sourceText: string,
): { entries: T[]; warnings: string[] } {
  const warnings: string[] = [];
  if (sourceText.trim().length === 0) return { entries: [...entries], warnings };

  const pieces = careerPieces(sourceText);
  const experience = entries.filter((entry) => entry.kind === "EXPERIENCE");
  const reconciled =
    pieces && pieces.length > 1
      ? reconcileExperience(experience, pieces, sourceText, warnings)
      : collapseAmbiguous(experience, sourceText, warnings);

  let emitted = false;
  const result: T[] = [];
  for (const entry of entries) {
    if (entry.kind !== "EXPERIENCE") {
      result.push(entry);
      continue;
    }
    if (!emitted) {
      result.push(...(reconciled as T[]));
      emitted = true;
    }
  }
  if (!emitted) result.push(...(reconciled as T[]));
  return { entries: result, warnings };
}

/** Clear role headings in source order, or null when fewer than two are marked. */
export function careerPieces(body: string): CareerPiece[] | null {
  const headers = roleHeaders(body);
  if (headers.length < 2) return null;
  const pieces: CareerPiece[] = [];
  const first = headers[0];
  if (first && first.index > 0) {
    const lead = body.slice(0, first.index).replace(/\b(?:Experience|Employment|Work History):\s*$/i, "").trim();
    if (lead.length > 0 && !lead.includes("\n")) pieces.push(unresolvedPiece(lead, 0));
  }
  for (let index = 0; index < headers.length; index += 1) {
    const header = headers[index];
    const next = headers[index + 1];
    if (!header) continue;
    const regionEnd = next ? next.index : body.length;
    const middle = body.slice(header.headerEnd, regionEnd);
    const cut = cutAfterRole(middle);
    const sourceEnd = header.headerEnd + cut.dutyLength;
    const title = body.slice(header.index, header.headerEnd).replace(/\s*[:—]\s*$/, "").trim();
    pieces.push({
      title,
      duties: cut.duties,
      sourceSpan: body.slice(header.index, sourceEnd).trim(),
      unresolved: false,
      index: header.index,
    });
    if (cut.remainder.length > 0) {
      pieces.push(unresolvedPiece(cut.remainder, header.headerEnd + cut.dutyLength));
    }
  }
  return pieces.length > 1 ? pieces : null;
}

export function looksLikeRoleList(text: string): boolean {
  return /[A-Z][^.;\n]{2,80}\([^)]*\d[^)]*\)/.test(text);
}

function reconcileExperience<T extends CareerEntry>(
  entries: readonly T[],
  pieces: CareerPiece[],
  source: string,
  warnings: string[],
): CareerEntry[] {
  const blob = entries.some(
    (entry) => isBlob(entry.title, pieces) || entry.bullets.some((bullet) => isBlob(bullet.text, pieces)),
  );
  if (blob) {
    warnings.push(copy.careerSplit);
    return pieces.map((piece) => entryFromPiece(piece));
  }

  const moved = pieces.map(() => [] as CareerBullet[]);
  const built: CareerEntry[] = [];
  const used = new Set<number>();

  for (const entry of entries) {
    const kept: CareerBullet[] = [];
    for (const bullet of entry.bullets) {
      if (inventedNumber(bullet.text, source)) {
        warnings.push(copy.inventedLine);
        continue;
      }
      const pieceIndex = pieceFor(bullet.text, pieces);
      const piece = pieceIndex >= 0 ? pieces[pieceIndex] : undefined;
      if (piece && !sameRole(entry.title, piece.title)) {
        const bucket = moved[pieceIndex];
        if (bucket) bucket.push(bullet);
        warnings.push(copy.movedDuty);
        continue;
      }
      kept.push(bullet);
    }
    const matched = pieces.findIndex((piece) => sameRole(entry.title, piece.title));
    if (matched >= 0) {
      used.add(matched);
      const piece = pieces[matched];
      if (!piece) continue;
      built.push(
        groundEntry(
          entry,
          piece.sourceSpan,
          kept.length > 0 ? kept : sourceBullets(piece),
          warnings,
        ),
      );
      continue;
    }
    if (kept.length === 0) continue;
    if (!contains(source, entry.title) && !entry.bullets.some((bullet) => contains(source, bullet.text))) {
      warnings.push(copy.inventedLine);
      continue;
    }
    built.push(groundEntry(entry, source, kept, warnings));
  }

  for (let index = 0; index < pieces.length; index += 1) {
    const piece = pieces[index];
    const extra = moved[index] ?? [];
    if (!piece) continue;
    if (used.has(index)) {
      const target = built.find((entry) => sameRole(entry.title, piece.title));
      if (target && extra.length > 0) target.bullets.push(...extra);
      continue;
    }
    warnings.push(copy.omittedRole);
    built.push(entryFromPiece(piece, extra.length > 0 ? extra : sourceBullets(piece)));
  }

  return orderBySource(built, pieces);
}

function collapseAmbiguous<T extends CareerEntry>(
  entries: readonly T[],
  source: string,
  warnings: string[],
): CareerEntry[] {
  const line = source
    .split(/\n+/)
    .map((item) => item.trim())
    .find((item) => {
      if (careerPieces(item) !== null) return false;
      const hits = entries.filter((entry) => fold(item).includes(fold(entry.title)));
      return hits.length >= 2;
    });
  if (!line || entries.length < 2) {
    return entries.map((entry) => groundEntry(entry, source, entry.bullets, warnings));
  }
  warnings.push(copy.ambiguousRole);
  const title = line.length <= ENTRY_LIMITS.title ? line : line.slice(0, ENTRY_LIMITS.title);
  const duties = line.length <= ENTRY_LIMITS.title ? "" : line;
  return [
    {
      kind: "EXPERIENCE",
      title,
      organization: null,
      location: null,
      startDate: null,
      endDate: null,
      isCurrent: false,
      url: null,
      bullets: sourceBullets({ duties, title }),
    },
  ];
}

function entryFromPiece(piece: CareerPiece, bullets?: CareerBullet[]): CareerEntry {
  return {
    kind: "EXPERIENCE",
    title: clipTitle(piece.title),
    organization: null,
    location: null,
    startDate: null,
    endDate: null,
    isCurrent: false,
    url: null,
    bullets: bullets ?? sourceBullets(piece),
  };
}

function groundEntry(
  entry: CareerEntry,
  span: string,
  bullets: CareerBullet[],
  warnings: string[],
): CareerEntry {
  const organization =
    entry.organization && mentioned(span, entry.organization) ? entry.organization : null;
  if (entry.organization && organization === null) warnings.push(copy.organizationUnknown);
  const startDate = yearInSpan(entry.startDate, span) ? entry.startDate : null;
  const present = entry.isCurrent && /\b(present|current|now|ongoing)\b/i.test(span);
  const endDate = present || !yearInSpan(entry.endDate, span) ? null : entry.endDate;
  if ((entry.startDate && startDate === null) || (entry.endDate && endDate === null) || (entry.isCurrent && !present)) {
    warnings.push(copy.datesUnclear(entry.title));
  }
  return { ...entry, organization, startDate, endDate, isCurrent: present, bullets };
}

function sourceBullets(piece: Pick<CareerPiece, "duties" | "title">): CareerBullet[] {
  const text = piece.duties.trim();
  if (text.length === 0) return [];
  if (fold(text) === fold(piece.title)) return [];
  return [clipBullet(text)];
}

function orderBySource(entries: CareerEntry[], pieces: CareerPiece[]): CareerEntry[] {
  const rank = new Map<string, number>();
  pieces.forEach((piece, index) => {
    rank.set(fold(piece.title), index);
  });
  return [...entries].sort((left, right) => {
    const leftRank = rank.get(fold(left.title)) ?? pieces.length;
    const rightRank = rank.get(fold(right.title)) ?? pieces.length;
    return leftRank - rightRank;
  });
}

function isBlob(text: string, pieces: CareerPiece[]): boolean {
  const hits = pieces.filter((piece) => {
    const marker = (piece.duties || piece.title).trim();
    return marker.length > 12 && contains(text, marker.slice(0, 48));
  });
  return hits.length >= 2;
}

function pieceFor(text: string, pieces: CareerPiece[]): number {
  return pieces.findIndex(
    (piece) => contains(piece.sourceSpan, text) || contains(piece.duties, text),
  );
}

function sameRole(entryTitle: string, pieceTitle: string): boolean {
  const left = fold(entryTitle);
  const right = fold(pieceTitle);
  if (left.length === 0 || right.length === 0) return false;
  if (left === right) return true;
  const shorter = left.length < right.length ? left : right;
  if (shorter.length < 8) return false;
  return left.startsWith(right) || right.startsWith(left);
}

function inventedNumber(text: string, source: string): boolean {
  const numbers = text.match(/\d[\d,.%+]*/g) ?? [];
  const hay = source.toLowerCase();
  return numbers.some((number) => !hay.includes(number.toLowerCase()));
}

function yearInSpan(value: string | null, span: string): boolean {
  if (!value) return false;
  const year = /^(\d{4})/.exec(value)?.[1];
  return year !== undefined && span.includes(year);
}

function contains(haystack: string, needle: string): boolean {
  return mentioned(haystack, needle, 8);
}

function mentioned(haystack: string, needle: string, minimum = 3): boolean {
  const folded = fold(needle);
  if (folded.length < minimum) return false;
  return fold(haystack).includes(folded);
}

function fold(value: string): string {
  return value.toLowerCase().replace(/[\s–—.-]+/g, "");
}

function clipTitle(title: string): string {
  const trimmed = title.trim();
  return trimmed.length <= ENTRY_LIMITS.title ? trimmed : trimmed.slice(0, ENTRY_LIMITS.title);
}

function clipBullet(text: string): CareerBullet {
  const long = text.length > BULLET_LIMITS.text;
  const clipped =
    text.length > IMPORT_LIMITS.bulletHardMax ? text.slice(0, IMPORT_LIMITS.bulletHardMax) : text;
  return { text: clipped, long };
}

function unresolvedPiece(text: string, index: number): CareerPiece {
  const title = headingClause(text);
  return {
    title,
    duties: text.startsWith(title) ? text.slice(title.length).replace(/^[\s:;—–-]+/, "").trim() : text,
    sourceSpan: text,
    unresolved: true,
    index,
  };
}

type RoleHeader = { index: number; headerEnd: number };

function roleHeaders(body: string): RoleHeader[] {
  const found: RoleHeader[] = [];
  const dated = /([A-Z][^.;:\n]{1,100}?)\s*\(([^)]{1,50})\)\s*(:|—)\s*/g;
  const ranged =
    /([A-Z][^.:\n]{2,80}?),\s*((?:19|20)\d{2}\s*[–—-]\s*(?:(?:19|20)\d{2}|Present|Current|current))\s+—\s*/g;
  collectHeaders(body, dated, found, true);
  collectHeaders(body, ranged, found, false);
  found.sort((left, right) => left.index - right.index);
  const kept: RoleHeader[] = [];
  for (const header of found) {
    const previous = kept[kept.length - 1];
    if (previous && header.index < previous.headerEnd) continue;
    kept.push(header);
  }
  return kept;
}

function collectHeaders(
  body: string,
  pattern: RegExp,
  found: RoleHeader[],
  datedParen: boolean,
): void {
  for (const match of body.matchAll(pattern)) {
    const title = match[1]?.trim() ?? "";
    const parenOrYear = match[2]?.trim() ?? "";
    const index = match.index ?? 0;
    if (!boundaryAt(body, index)) continue;
    if (title.length < 3 || title.length > 100) continue;
    if (datedParen && !clearParen(parenOrYear, match[3] ?? "")) continue;
    const raw = match[0] ?? "";
    found.push({ index, headerEnd: index + raw.length });
  }
}

function boundaryAt(body: string, index: number): boolean {
  if (index === 0) return true;
  const before = body.slice(Math.max(0, index - 2), index);
  return before === ". " || before === "; " || before === ": ";
}

function clearParen(paren: string, separator: string): boolean {
  const dateLike = /\d/.test(paren) && /(?:–|—|-|\bto\b|\bpresent\b|\bcurrent\b|\bnow\b)/i.test(paren);
  if (dateLike) return true;
  return separator === ":" && paren.length <= 40 && !paren.includes(".");
}

function cutAfterRole(middle: string): { duties: string; dutyLength: number; remainder: string } {
  const sentence = nextSentence(middle);
  const titled = middle.search(/;\s+[A-Z][^.;\n]{1,80}\([^)]*\d[^)]*\)/);
  let end = middle.length;
  if (sentence >= 0) end = Math.min(end, sentence);
  if (titled >= 0) end = Math.min(end, titled);
  const duties = middle.slice(0, end).trim();
  const remainder = middle.slice(end).replace(/^[.;]\s*/, "").trim();
  return { duties, dutyLength: end, remainder };
}

function nextSentence(middle: string): number {
  for (let index = 0; index < middle.length - 2; index += 1) {
    if (middle[index] !== ".") continue;
    if (middle[index + 1] !== " ") continue;
    const next = middle[index + 2];
    if (!next || next !== next.toUpperCase() || next === next.toLowerCase()) continue;
    const word = middle.slice(0, index).trim().split(/\s+/).pop() ?? "";
    if (word.length <= 2) continue;
    return index;
  }
  return -1;
}

function headingClause(body: string): string {
  const cut = body.split(/:|;|—| - /)[0]?.trim() ?? "";
  if (cut.length >= 3 && cut.length <= 80 && cut.length < body.length) return cut;
  if (body.length > 0 && body.length <= 80) return body;
  return body;
}
