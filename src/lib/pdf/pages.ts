/** Page count for a PDF produced by react-pdf. Safe to run on the preview bytes in the browser. */
export function pdfPageCount(pdf: Uint8Array): number {
  return decodeLatin1(pdf).match(/\/Type\s*\/Page(?!s)\b/g)?.length ?? 0;
}

function decodeLatin1(pdf: Uint8Array): string {
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(pdf)) {
    return pdf.toString("latin1");
  }
  const parts: string[] = [];
  const size = 4096;
  for (let index = 0; index < pdf.length; index += size) {
    parts.push(String.fromCharCode(...pdf.subarray(index, index + size)));
  }
  return parts.join("");
}
