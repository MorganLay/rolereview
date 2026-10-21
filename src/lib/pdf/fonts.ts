import path from "node:path";

import { Font } from "@react-pdf/renderer";

let registered = false;

/** Embed Inter and Source Serif 4. No hyphenation, so copied text stays whole words. */
export function ensurePdfFonts(): void {
  if (registered) return;
  const dir = path.join(process.cwd(), "src/lib/pdf/fonts");
  Font.register({
    family: "Inter",
    fonts: [
      { src: path.join(dir, "Inter-Regular.ttf"), fontWeight: 400 },
      { src: path.join(dir, "Inter-SemiBold.ttf"), fontWeight: 600 },
    ],
  });
  Font.register({
    family: "Source Serif 4",
    src: path.join(dir, "SourceSerif4-Semibold.ttf"),
    fontWeight: 600,
  });
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}
