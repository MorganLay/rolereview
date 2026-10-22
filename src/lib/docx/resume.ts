/**
 * Resume DOCX from the same model as the PDF. No tables, no RoleRefine branding.
 * docs/03-ARCHITECTURE.md → Exports.
 */

import { HeadingLevel, Paragraph, TextRun, type FileChild } from "docx";

import type { ResumePdfModel } from "@/lib/pdf/model";

import { packDocx } from "./file";

export async function renderResumeDocx(model: ResumePdfModel): Promise<Buffer> {
  return packDocx(resumeDocxChildren(model), {
    top: 0.5,
    bottom: 0.5,
    left: 0.65,
    right: 0.65,
  });
}

function resumeDocxChildren(model: ResumePdfModel): FileChild[] {
  const children: FileChild[] = [];

  if (model.name) {
    children.push(
      new Paragraph({
        spacing: { after: 40 },
        children: [new TextRun({ text: model.name, bold: true, size: 32 })],
      }),
    );
  }
  if (model.headline) {
    children.push(bodyParagraph(model.headline, { after: 40 }));
  }
  if (model.contact) {
    children.push(bodyParagraph(model.contact, { after: 40, size: 20 }));
  }
  for (const link of model.links) {
    children.push(bodyParagraph(link, { after: 20, size: 20 }));
  }
  if (model.summary) {
    children.push(sectionHeading("Summary"));
    children.push(bodyParagraph(model.summary, { after: 80 }));
  }
  for (const section of model.sections) {
    children.push(sectionHeading(section.heading));
    for (const entry of section.entries) {
      if (entry.title) {
        children.push(
          new Paragraph({
            spacing: { before: 80, after: 20 },
            children: [new TextRun({ text: entry.title, bold: true })],
          }),
        );
      }
      if (entry.meta) {
        children.push(bodyParagraph(entry.meta, { after: 20, size: 20 }));
      }
      if (entry.url) {
        children.push(bodyParagraph(entry.url, { after: 20, size: 20 }));
      }
      for (const bullet of entry.bullets) {
        children.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 40 },
            children: [new TextRun(bullet)],
          }),
        );
      }
    }
  }
  if (model.skills.length > 0) {
    children.push(sectionHeading("Skills"));
    for (const line of model.skills) {
      children.push(bodyParagraph(line, { after: 40 }));
    }
  }
  return children;
}

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text, bold: true, size: 22 })],
  });
}

function bodyParagraph(
  text: string,
  opts: { after: number; size?: number },
): Paragraph {
  return new Paragraph({
    spacing: { after: opts.after },
    children: [new TextRun({ text, size: opts.size })],
  });
}
