/**
 * Download name: First-Last-Company-Title.pdf.
 * docs/02-USER-FLOWS.md → Resume workspace → Export.
 */

const FILENAME_MAX = 120;

export function resumePdfFilename(
  fullName: string | null,
  company: string,
  title: string,
): string {
  const parts = [fullName, company, title].map(slugPart).filter((part) => part.length > 0);
  const base = (parts.length > 0 ? parts.join("-") : "Resume").slice(0, FILENAME_MAX);
  return `${base}.pdf`;
}

export function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function slugPart(value: string | null): string {
  if (!value) return "";
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}
