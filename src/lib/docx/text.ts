/**
 * Reading order of a DOCX, from word/document.xml inside the zip.
 * List items keep the same "- " prefix the PDF lines use.
 */

import { readDocxPart } from "./stamp";

export function docxDocumentText(zip: Buffer): string {
  const xml = readDocxPart(zip, "word/document.xml");
  if (!xml) return "";
  return paragraphLines(xml.toString("utf8")).join("\n");
}

function paragraphLines(xml: string): string[] {
  const lines: string[] = [];
  for (const match of xml.matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g)) {
    const body = match[1] ?? "";
    const text = [...body.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)]
      .map((item) => decodeXml(item[1] ?? ""))
      .join("");
    if (text.length === 0) continue;
    const bullet = /<w:numPr\b/.test(body);
    lines.push(bullet ? `- ${text}` : text);
  }
  return lines;
}

function decodeXml(value: string): string {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, digits: string) => String.fromCodePoint(Number(digits)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
