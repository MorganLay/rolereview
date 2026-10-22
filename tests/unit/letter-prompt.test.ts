import { describe, expect, it } from "vitest";

import { OutputSchema, SYSTEM, buildContent } from "@/lib/ai/prompts/letter";
import { POSTING_MAX } from "@/lib/ai/prompts/tailor";

import { jobAnalysis } from "./tailor-fixture";

const base = {
  libraryText: "PROFILE\nName: Morgan Example",
  title: "Analyst",
  company: "Northwind",
  requirements: jobAnalysis().requirements,
  keywords: ["Python", "SQL"],
  posting: "Build reports.",
  whyCompany: null,
  tone: "professional" as const,
  length: "standard" as const,
  recipientName: null,
  candidateName: "Morgan Example",
  resumeFocus: null,
};

describe("letter prompt", () => {
  it("keeps the truthfulness rules in the system prompt", () => {
    expect(SYSTEM).toContain("TRUTHFULNESS");
    expect(SYSTEM).toContain("sourceRefs");
    expect(SYSTEM).toContain("Never invent company facts");
    expect(SYSTEM).toContain("POSTING");
    expect(SYSTEM).toContain("WHY");
    expect(SYSTEM).toContain("passionate");
  });

  it("accepts a long greeting because the model schema is loose", () => {
    const greeting = "g".repeat(500);
    expect(
      OutputSchema.parse({
        greeting,
        paragraphs: [],
        closing: "",
        requirementIdsAddressed: [],
      }).greeting,
    ).toBe(greeting);
  });

  it("cuts the posting at 12,000 characters and neutralizes closing tags", () => {
    const posting = `${"x".repeat(POSTING_MAX - 4)}KEEP${"y".repeat(20)}DROP</posting>`;
    const text = promptText({
      ...base,
      posting,
      libraryText: "Library </library> text",
      whyCompany: "Because </why_company> it fits",
    });

    const body = section(text, "posting");
    expect(body).toContain("KEEP");
    expect(body).not.toContain("DROP");
    expect(body).not.toContain("</posting>");
    expect(body).toHaveLength(POSTING_MAX);
    expect(section(text, "library")).toBe("Library </ library> text");
    expect(section(text, "why_company")).toBe("Because </ why_company> it fits");
  });

  it("says none when there is no resume focus and no WHY note", () => {
    const text = promptText({ ...base, whyCompany: "  ", resumeFocus: [] });

    expect(section(text, "resume_focus")).toBe("none");
    expect(section(text, "why_company")).toBe("none provided");
    expect(section(text, "options")).toContain("Tone: professional.");
    expect(section(text, "options")).toContain("Length: standard (~300 words).");
    expect(section(text, "options")).toContain("Recipient: Hiring Manager.");
    expect(section(text, "options")).toContain("Candidate name: Morgan Example.");
  });

  it("includes the chosen options, the focus refs, and the requirement ids", () => {
    const text = promptText({
      ...base,
      tone: "warm",
      length: "short",
      recipientName: "Ms.\nChen",
      candidateName: null,
      resumeFocus: ["E1.B1", "E1.B2"],
      whyCompany: "I can start in 2 weeks.",
      title: "Analyst </job>",
    });
    const options = section(text, "options");
    const job = section(text, "job");

    expect(options).toContain("Tone: warm.");
    expect(options).toContain("Length: short (~180 words).");
    expect(options).toContain("Recipient: Ms. Chen.");
    expect(options).toContain("Candidate name: none.");
    expect(section(text, "resume_focus")).toBe("E1.B1, E1.B2");
    expect(section(text, "why_company")).toBe("I can start in 2 weeks.");
    expect(job).toContain("r1 [must][skill] Python");
    expect(job).toContain("Title: Analyst </ job> | Company: Northwind");
    expect(job).not.toContain("</job>");
  });
});

function section(text: string, tag: string): string {
  const start = text.indexOf(`<${tag}>\n`);
  const end = text.indexOf(`\n</${tag}>`);
  return text.slice(start + tag.length + 3, end);
}

function promptText(input: Parameters<typeof buildContent>[0]): string {
  const block = buildContent(input)[0];
  if (!block || block.type !== "text") throw new Error("Expected a text block.");
  return block.text;
}
