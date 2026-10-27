import { inflateSync } from "node:zlib";

/**
 * Text from a resume PDF.
 * Embedded fonts store glyph ids. A ToUnicode map makes those ids searchable.
 * Returns null when the file has no usable map, so the caller can fall back.
 */

type PdfObject = {
  dict: string;
  stream: Buffer | null;
};

type Token =
  | { kind: "name"; value: string }
  | { kind: "hex"; value: string }
  | { kind: "literal"; value: string }
  | { kind: "number" }
  | { kind: "word"; value: string }
  | { kind: "array-start" }
  | { kind: "array-end" };

export function pdfPlainText(pdf: Uint8Array): string | null {
  const file = Buffer.from(pdf).toString("latin1");
  const objects = indexObjects(file);
  const cmaps = new Map<string, Map<number, string>>();
  for (const [id, object] of objects) {
    const text = decodeObjectStream(object);
    if (!text.includes("beginbfchar") && !text.includes("beginbfrange")) continue;
    const map = parseToUnicode(text);
    if (map.size > 0) cmaps.set(id, map);
  }
  if (cmaps.size === 0) return null;

  const fontCmaps = new Map<string, Map<number, string>>();
  for (const [id, object] of objects) {
    const ref = /\/ToUnicode\s+(\d+)\s+\d+\s+R/.exec(object.dict);
    const cmapId = ref?.[1];
    if (!cmapId) continue;
    const map = cmaps.get(cmapId);
    if (map) fontCmaps.set(id, map);
  }
  if (fontCmaps.size === 0) return null;

  let text = "";
  let found = false;
  for (const pageId of pageIds(objects)) {
    const page = objects.get(pageId);
    if (!page) continue;
    const fonts = fontNames(page, objects, fontCmaps);
    const decoded = decodeContent(pageStream(objects, pageId), fonts);
    if (decoded.length === 0) continue;
    found = true;
    text += decoded;
  }
  return found ? text : null;
}

function fontNames(
  page: PdfObject,
  objects: Map<string, PdfObject>,
  fontCmaps: Map<string, Map<number, string>>,
): Map<string, Map<number, string>> {
  const names = new Map<string, Map<number, string>>();
  const resources = resourcesDict(page, objects);
  const fontDict = nestedDict(resources, "/Font");
  if (!fontDict) return names;
  for (const match of fontDict.matchAll(/\/([A-Za-z0-9]+)\s+(\d+)\s+\d+\s+R/g)) {
    const name = match[1];
    const id = match[2];
    if (!name || !id) continue;
    const map = fontCmaps.get(id);
    if (map) names.set(name, map);
  }
  return names;
}

function resourcesDict(page: PdfObject, objects: Map<string, PdfObject>): string {
  const own = lookupDict(page.dict, "/Resources", objects);
  if (own && /\/Font\b/.test(own)) return own;
  const parentRef = /\/Parent\s+(\d+)\s+\d+\s+R/.exec(page.dict);
  const parentId = parentRef?.[1];
  if (!parentId) return own ?? "";
  const parent = objects.get(parentId);
  if (!parent) return own ?? "";
  return lookupDict(parent.dict, "/Resources", objects) ?? own ?? "";
}

function lookupDict(
  source: string,
  key: string,
  objects: Map<string, PdfObject>,
): string | null {
  const at = source.search(new RegExp(`${key}\\b`));
  if (at < 0) return null;
  let index = at + key.length;
  while (index < source.length && isSpace(source[index] ?? "")) index += 1;
  if (source.startsWith("<<", index)) return readDict(source, index);
  const ref = /^(\d+)\s+\d+\s+R/.exec(source.slice(index));
  const id = ref?.[1];
  if (!id) return null;
  return objects.get(id)?.dict ?? null;
}

function nestedDict(source: string, key: string): string | null {
  const at = source.search(new RegExp(`${key}\\b`));
  if (at < 0) return null;
  let index = at + key.length;
  while (index < source.length && isSpace(source[index] ?? "")) index += 1;
  if (source.startsWith("<<", index)) return readDict(source, index);
  return null;
}

function readDict(source: string, start: number): string {
  let depth = 0;
  let index = start;
  while (index < source.length) {
    if (source.startsWith("<<", index)) {
      depth += 1;
      index += 2;
      continue;
    }
    if (source.startsWith(">>", index)) {
      depth -= 1;
      index += 2;
      if (depth === 0) return source.slice(start, index);
      continue;
    }
    index += 1;
  }
  return source.slice(start);
}

function decodeContent(stream: string, fonts: Map<string, Map<number, string>>): string {
  const tokens = tokenize(stream);
  let font: Map<number, string> | undefined;
  let array: string[] | null = null;
  let last = "";
  let out = "";

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token) continue;
    const next = tokens[index + 1];
    const after = tokens[index + 2];
    if (
      token.kind === "name" &&
      next?.kind === "number" &&
      after?.kind === "word" &&
      after.value === "Tf"
    ) {
      font = fonts.get(token.value);
      index += 2;
      continue;
    }
    if (token.kind === "array-start") {
      array = [];
      last = "";
      continue;
    }
    if (token.kind === "hex" || token.kind === "literal") {
      const value =
        token.kind === "hex" ? decodeHexGlyphs(token.value, font) : decodeLiteral(token.value);
      if (array) array.push(value);
      else last = value;
      continue;
    }
    if (token.kind !== "word") continue;
    if (token.value === "Tj") out += last;
    if (token.value === "TJ" && array) out += array.join("");
    last = "";
    if (token.value === "TJ") array = null;
  }
  return out;
}

function decodeHexGlyphs(hex: string, font: Map<number, string> | undefined): string {
  if (!font) return "";
  const clean = hex.replace(/\s+/g, "");
  let out = "";
  for (let index = 0; index + 4 <= clean.length; index += 4) {
    const gid = Number.parseInt(clean.slice(index, index + 4), 16);
    if (!Number.isFinite(gid)) continue;
    out += font.get(gid) ?? "";
  }
  return out;
}

function tokenize(stream: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < stream.length) {
    const char = stream[index] ?? "";
    if (char === "%") {
      const newline = stream.indexOf("\n", index);
      index = newline < 0 ? stream.length : newline + 1;
      continue;
    }
    if (isSpace(char)) {
      index += 1;
      continue;
    }
    if (char === "(") {
      const literal = readLiteral(stream, index);
      tokens.push({ kind: "literal", value: literal.value });
      index = literal.next;
      continue;
    }
    if (char === "<") {
      if (stream[index + 1] === "<") {
        index += 2;
        continue;
      }
      const end = stream.indexOf(">", index + 1);
      tokens.push({
        kind: "hex",
        value: end < 0 ? "" : stream.slice(index + 1, end),
      });
      index = end < 0 ? stream.length : end + 1;
      continue;
    }
    if (char === "[") {
      tokens.push({ kind: "array-start" });
      index += 1;
      continue;
    }
    if (char === "]") {
      tokens.push({ kind: "array-end" });
      index += 1;
      continue;
    }
    if (char === "/") {
      index += 1;
      const start = index;
      while (index < stream.length && isNameChar(stream[index] ?? "")) index += 1;
      tokens.push({ kind: "name", value: stream.slice(start, index) });
      continue;
    }
    if (isNumberStart(char)) {
      index += 1;
      while (index < stream.length && isNumberChar(stream[index] ?? "")) index += 1;
      tokens.push({ kind: "number" });
      continue;
    }
    if (isIdentStart(char)) {
      const start = index;
      index += 1;
      while (index < stream.length && isIdent(stream[index] ?? "")) index += 1;
      tokens.push({ kind: "word", value: stream.slice(start, index) });
      continue;
    }
    index += 1;
  }
  return tokens;
}

function readLiteral(stream: string, start: number): { value: string; next: number } {
  let index = start + 1;
  let value = "";
  while (index < stream.length) {
    const char = stream[index] ?? "";
    if (char === "\\") {
      value += char;
      const escaped = stream[index + 1];
      if (escaped !== undefined) {
        value += escaped;
        index += 2;
        continue;
      }
      index += 1;
      continue;
    }
    if (char === ")") return { value, next: index + 1 };
    value += char;
    index += 1;
  }
  return { value, next: index };
}

function decodeLiteral(raw: string): string {
  let out = "";
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index] ?? "";
    if (char !== "\\") {
      out += char;
      continue;
    }
    const next = raw[index + 1];
    if (next === undefined) break;
    if (next === "n") {
      out += "\n";
      index += 1;
      continue;
    }
    if (next === "r") {
      out += "\r";
      index += 1;
      continue;
    }
    if (next === "t") {
      out += "\t";
      index += 1;
      continue;
    }
    if (next === "b") {
      out += "\b";
      index += 1;
      continue;
    }
    if (next === "f") {
      out += "\f";
      index += 1;
      continue;
    }
    if (next === "(" || next === ")" || next === "\\") {
      out += next;
      index += 1;
      continue;
    }
    if (next === "\n") {
      index += 1;
      continue;
    }
    if (next === "\r") {
      index += raw[index + 2] === "\n" ? 2 : 1;
      continue;
    }
    if (next >= "0" && next <= "7") {
      let octal = next;
      let cursor = index + 2;
      for (let extra = 0; extra < 2 && cursor < raw.length; extra += 1) {
        const digit = raw[cursor] ?? "";
        if (digit < "0" || digit > "7") break;
        octal += digit;
        cursor += 1;
      }
      out += String.fromCharCode(Number.parseInt(octal, 8));
      index = cursor - 1;
      continue;
    }
    out += next;
    index += 1;
  }
  return out;
}

function parseToUnicode(cmap: string): Map<number, string> {
  const map = new Map<number, string>();
  for (const section of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    const body = section[1] ?? "";
    for (const pair of body.matchAll(/<([0-9A-Fa-f\s]+)>\s*<([0-9A-Fa-f\s]+)>/g)) {
      const source = firstCode(pair[1] ?? "");
      const dest = pair[2];
      if (source === null || dest === undefined) continue;
      map.set(source, decodeUtf16Hex(dest));
    }
  }
  for (const section of cmap.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    parseBfRange(section[1] ?? "", map);
  }
  return map;
}

function parseBfRange(body: string, map: Map<number, string>) {
  const tokens = [...body.matchAll(/<([0-9A-Fa-f\s]+)>|\[|\]/g)];
  let index = 0;
  while (index < tokens.length) {
    const startTok = tokens[index];
    const endTok = tokens[index + 1];
    const destTok = tokens[index + 2];
    if (!startTok || !endTok || !destTok) break;
    const start = firstCode(startTok[1] ?? "");
    const end = firstCode(endTok[1] ?? "");
    if (start === null || end === null || end < start) {
      index += 1;
      continue;
    }
    if (destTok[0] === "[") {
      index += 3;
      let offset = 0;
      while (index < tokens.length && tokens[index]?.[0] !== "]") {
        const hex = tokens[index]?.[1];
        if (hex) {
          map.set(start + offset, decodeUtf16Hex(hex));
          offset += 1;
        }
        index += 1;
      }
      index += 1;
      continue;
    }
    const base = codesOf(destTok[1] ?? "");
    if (base.length === 0) {
      index += 1;
      continue;
    }
    for (let code = start; code <= end; code += 1) {
      map.set(code, incrementUtf16(base, code - start));
    }
    index += 3;
  }
}

function decodeUtf16Hex(hex: string): string {
  const codes = codesOf(hex);
  let out = "";
  for (let index = 0; index < codes.length; index += 1) {
    const unit = codes[index];
    if (unit === undefined) continue;
    const low = codes[index + 1];
    if (unit >= 0xd800 && unit <= 0xdbff && low !== undefined && low >= 0xdc00 && low <= 0xdfff) {
      out += String.fromCodePoint(((unit - 0xd800) << 10) + (low - 0xdc00) + 0x10000);
      index += 1;
      continue;
    }
    if (unit === 0) continue;
    out += String.fromCodePoint(unit);
  }
  return out;
}

function incrementUtf16(base: readonly number[], offset: number): string {
  if (base.length === 0 || offset === 0) return codesToString(base);
  const next = base.slice();
  const last = next.length - 1;
  const current = next[last];
  if (current === undefined) return codesToString(base);
  next[last] = (current + offset) & 0xffff;
  return codesToString(next);
}

function codesToString(codes: readonly number[]): string {
  return decodeUtf16Hex(codes.map((code) => code.toString(16).padStart(4, "0")).join(""));
}

function codesOf(hex: string): number[] {
  const clean = hex.replace(/\s+/g, "");
  const codes: number[] = [];
  for (let index = 0; index + 4 <= clean.length; index += 4) {
    const code = Number.parseInt(clean.slice(index, index + 4), 16);
    if (Number.isFinite(code)) codes.push(code);
  }
  return codes;
}

function firstCode(hex: string): number | null {
  return codesOf(hex)[0] ?? null;
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

function isSpace(char: string): boolean {
  return char === " " || char === "\n" || char === "\r" || char === "\t" || char === "\f";
}

function isNameChar(char: string): boolean {
  return (
    char !== " " &&
    char !== "\n" &&
    char !== "\r" &&
    char !== "\t" &&
    char !== "\f" &&
    char !== "/" &&
    char !== "(" &&
    char !== ")" &&
    char !== "<" &&
    char !== ">" &&
    char !== "[" &&
    char !== "]" &&
    char !== "%"
  );
}

function isNumberStart(char: string): boolean {
  return (char >= "0" && char <= "9") || char === "+" || char === "-" || char === ".";
}

function isNumberChar(char: string): boolean {
  return isNumberStart(char);
}

function isIdentStart(char: string): boolean {
  return (char >= "A" && char <= "Z") || (char >= "a" && char <= "z") || char === "*";
}

function isIdent(char: string): boolean {
  return isIdentStart(char) || (char >= "0" && char <= "9");
}
