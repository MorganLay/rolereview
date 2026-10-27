import { inflateSync } from "node:zlib";

/**
 * Lines of text that fall after page 1.
 * Counts text-showing operators (`Tj`, `TJ`) in each later page's content stream.
 * react-pdf draws one of those per line. Returns 0 when the streams cannot be read;
 * the fit ladder then estimates one line per extra page so the count stays positive.
 */

type PdfObject = {
  dict: string;
  stream: Buffer | null;
};

export function linesAfterFirstPage(pdf: Uint8Array): number {
  const pages = readPageStreams(pdf);
  if (pages.length <= 1) return 0;
  let lines = 0;
  for (const stream of pages.slice(1)) lines += countTextShows(stream);
  return lines;
}

function readPageStreams(pdf: Uint8Array): string[] {
  const file = Buffer.isBuffer(pdf) ? pdf.toString("latin1") : bufferFrom(pdf).toString("latin1");
  const objects = indexObjects(file);
  return pageIds(objects).map((id) => pageStream(objects, id));
}

function bufferFrom(pdf: Uint8Array): Buffer {
  return Buffer.from(pdf.buffer, pdf.byteOffset, pdf.byteLength);
}

function pageStream(objects: Map<string, PdfObject>, id: string): string {
  const page = objects.get(id);
  if (!page) return "";
  const parts: string[] = [];
  for (const contentId of contentObjectIds(page.dict)) {
    const text = decodeObjectStream(objects.get(contentId));
    if (text.length > 0) parts.push(text);
  }
  return parts.join("\n");
}

function contentObjectIds(dict: string): string[] {
  const list = /\/Contents\s*\[([^\]]*)\]/.exec(dict);
  if (list?.[1]) {
    return [...list[1].matchAll(/(\d+)\s+\d+\s+R/g)]
      .map((match) => match[1] ?? "")
      .filter((id) => id.length > 0);
  }
  const one = /\/Contents\s+(\d+)\s+\d+\s+R/.exec(dict);
  return one?.[1] ? [one[1]] : [];
}

function decodeObjectStream(object: PdfObject | undefined): string {
  if (!object?.stream) return "";
  const filter = /\/Filter\s*(?:\/([A-Za-z0-9]+)|\[\s*\/([A-Za-z0-9]+))/.exec(object.dict);
  const name = filter?.[1] ?? filter?.[2] ?? null;
  if (name && name !== "FlateDecode") return "";
  const bytes = name === "FlateDecode" ? inflateOrNull(object.stream) : object.stream;
  return bytes ? bytes.toString("latin1") : "";
}

function inflateOrNull(bytes: Buffer): Buffer | null {
  try {
    return inflateSync(bytes);
  } catch {
    return null;
  }
}

function pageIds(objects: Map<string, PdfObject>): string[] {
  const root = [...objects.entries()].find(([, object]) => /\/Type\s*\/Pages\b/.test(object.dict));
  if (!root) {
    return [...objects.entries()]
      .filter(([, object]) => /\/Type\s*\/Page(?!s)\b/.test(object.dict))
      .map(([id]) => id);
  }
  const ordered: string[] = [];
  walkPages(root[0], objects, ordered, new Set());
  return ordered;
}

function walkPages(
  id: string,
  objects: Map<string, PdfObject>,
  ordered: string[],
  seen: Set<string>,
) {
  if (seen.has(id)) return;
  seen.add(id);
  const object = objects.get(id);
  if (!object) return;
  if (/\/Type\s*\/Page(?!s)\b/.test(object.dict)) {
    ordered.push(id);
    return;
  }
  const kids = /\/Kids\s*\[([^\]]*)\]/.exec(object.dict);
  if (!kids?.[1]) return;
  for (const kid of kids[1].matchAll(/(\d+)\s+\d+\s+R/g)) {
    const child = kid[1];
    if (child) walkPages(child, objects, ordered, seen);
  }
}

function indexObjects(file: string): Map<string, PdfObject> {
  const objects = new Map<string, PdfObject>();
  const start = /(\d+)\s+\d+\s+obj\b/g;
  let match: RegExpExecArray | null;
  while ((match = start.exec(file))) {
    const id = match[1];
    if (!id) continue;
    const bodyAt = match.index + match[0].length;
    const streamWord = indexOfWord(file, "stream", bodyAt);
    const endObjEarly = indexOfWord(file, "endobj", bodyAt);
    const hasStream = streamWord >= 0 && (endObjEarly < 0 || streamWord < endObjEarly);
    if (!hasStream) {
      if (endObjEarly < 0) break;
      objects.set(id, { dict: file.slice(bodyAt, endObjEarly), stream: null });
      start.lastIndex = endObjEarly + "endobj".length;
      continue;
    }
    const dict = file.slice(bodyAt, streamWord);
    const dataAt = streamDataOffset(file, streamWord);
    const length = directLength(dict);
    let after = dataAt;
    let stream: Buffer | null = null;
    if (length !== null) {
      after = dataAt + length;
      stream = Buffer.from(file.slice(dataAt, after), "latin1");
    }
    const endStream = indexOfWord(file, "endstream", after);
    const endObj = indexOfWord(file, "endobj", endStream >= 0 ? endStream : after);
    if (endObj < 0) break;
    if (length === null && endStream > dataAt) {
      stream = Buffer.from(trimStreamTail(file.slice(dataAt, endStream)), "latin1");
    }
    objects.set(id, { dict, stream });
    start.lastIndex = endObj + "endobj".length;
  }
  return objects;
}

/** `stream` is a prefix of `endstream`, so a bare indexOf would match the wrong word. */
function indexOfWord(file: string, word: string, from: number): number {
  let index = file.indexOf(word, from);
  while (index >= 0) {
    const before = index === 0 ? undefined : file[index - 1];
    if (isKeywordBoundary(before)) return index;
    index = file.indexOf(word, index + word.length);
  }
  return -1;
}

function isKeywordBoundary(char: string | undefined): boolean {
  if (char === undefined) return true;
  return (
    char === " " ||
    char === "\n" ||
    char === "\r" ||
    char === "\t" ||
    char === ">" ||
    char === "/" ||
    char === "[" ||
    char === "]"
  );
}

function directLength(dict: string): number | null {
  const match = /\/Length\s+(\d+)\b/.exec(dict);
  if (!match?.[1]) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function streamDataOffset(file: string, streamAt: number): number {
  const index = streamAt + "stream".length;
  if (file.charCodeAt(index) === 13 && file.charCodeAt(index + 1) === 10) return index + 2;
  if (file.charCodeAt(index) === 10 || file.charCodeAt(index) === 13) return index + 1;
  return index;
}

function trimStreamTail(raw: string): string {
  if (raw.endsWith("\r\n")) return raw.slice(0, -2);
  if (raw.endsWith("\n") || raw.endsWith("\r")) return raw.slice(0, -1);
  return raw;
}

function countTextShows(stream: string): number {
  let count = 0;
  let index = 0;
  while (index < stream.length) {
    const char = stream[index];
    if (char === "(") {
      index = skipLiteral(stream, index);
      continue;
    }
    if (char === "<") {
      if (stream[index + 1] === "<") {
        index += 2;
        continue;
      }
      index = skipHex(stream, index);
      continue;
    }
    if (char === "%") {
      const newline = stream.indexOf("\n", index);
      index = newline < 0 ? stream.length : newline + 1;
      continue;
    }
    if (char === "/") {
      index += 1;
      while (index < stream.length && isNameChar(stream[index] ?? "")) index += 1;
      continue;
    }
    if (char !== undefined && isIdentStart(char)) {
      const from = index;
      index += 1;
      while (index < stream.length && isIdent(stream[index] ?? "")) index += 1;
      const word = stream.slice(from, index);
      if (word === "Tj" || word === "TJ") count += 1;
      continue;
    }
    index += 1;
  }
  return count;
}

function skipLiteral(stream: string, start: number): number {
  let index = start + 1;
  while (index < stream.length) {
    const char = stream[index];
    if (char === "\\") {
      index += 2;
      continue;
    }
    if (char === ")") return index + 1;
    index += 1;
  }
  return index;
}

function skipHex(stream: string, start: number): number {
  const end = stream.indexOf(">", start + 1);
  return end < 0 ? stream.length : end + 1;
}

function isIdentStart(char: string): boolean {
  return (char >= "A" && char <= "Z") || (char >= "a" && char <= "z");
}

function isIdent(char: string): boolean {
  return isIdentStart(char) || (char >= "0" && char <= "9");
}

function isNameChar(char: string): boolean {
  return /[A-Za-z0-9+_.-]/.test(char);
}
