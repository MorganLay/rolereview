/**
 * Download names: First-Last-Company-Title.pdf and …-Letter.pdf.
 * docs/02-USER-FLOWS.md → Resume workspace → Export, Cover letter workspace.
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

export function letterPdfFilename(
  fullName: string | null,
  company: string,
  title: string,
): string {
  const parts = [fullName, company, title].map(slugPart).filter((part) => part.length > 0);
  const stem = parts.length > 0 ? `${parts.join("-")}-Letter` : "Letter";
  return `${stem.slice(0, FILENAME_MAX)}.pdf`;
}

export function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/** Prefer the UTF-8 filename from a Content-Disposition download header. */
export function filenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (encoded?.[1]) {
    try {
      return decodeURIComponent(encoded[1].trim());
    } catch {
      return null;
    }
  }
  const quoted = /filename="([^"]*)"/.exec(header);
  return quoted?.[1] ? quoted[1] : null;
}

function slugPart(value: string | null): string {
  if (!value) return "";
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}
