/**
 * Shared DOCX packing. Single column, Arial, no headers or branding.
 * docs/03-ARCHITECTURE.md → Exports. docs/10-BRAND.md → Exported documents.
 */

import {
  convertInchesToTwip,
  Document,
  Packer,
  Paragraph,
  type FileChild,
} from "docx";

import { stampDocx } from "./stamp";

export const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const LETTER_WIDTH = convertInchesToTwip(8.5);
const LETTER_HEIGHT = convertInchesToTwip(11);

export async function packDocx(
  children: FileChild[],
  margins: { top: number; bottom: number; left: number; right: number },
  producedAt?: Date,
): Promise<Buffer> {
  const body = children.length > 0 ? children : [new Paragraph("")];
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: "Arial",
            size: 22,
            color: "000000",
          },
        },
        heading1: {
          run: {
            font: "Arial",
            size: 22,
            bold: true,
            color: "000000",
          },
          paragraph: {
            spacing: { before: 200, after: 80 },
          },
        },
        listParagraph: {
          run: {
            font: "Arial",
            size: 22,
            color: "000000",
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: LETTER_WIDTH, height: LETTER_HEIGHT },
            margin: {
              top: convertInchesToTwip(margins.top),
              bottom: convertInchesToTwip(margins.bottom),
              left: convertInchesToTwip(margins.left),
              right: convertInchesToTwip(margins.right),
            },
          },
        },
        children: body,
      },
    ],
  });
  const packed = Buffer.from(await Packer.toBuffer(doc));
  return producedAt ? stampDocx(packed, producedAt) : packed;
}
