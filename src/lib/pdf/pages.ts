/** Page count for a PDF produced by react-pdf. */
export function pdfPageCount(pdf: Buffer): number {
  const text = pdf.toString("latin1");
  return text.match(/\/Type\s*\/Page(?!s)\b/g)?.length ?? 0;
}
