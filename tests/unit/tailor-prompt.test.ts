import { describe, expect, it } from "vitest";

import { buildContent, POSTING_MAX, SYSTEM } from "@/lib/ai/prompts/tailor";
import { jobAnalysis } from "./tailor-fixture";

const base = {
  libraryText: "PROFILE\nName: Morgan Example",
  title: "Analyst",
  company: "Northwind",
  seniority: "mid" as const,
  requirements: jobAnalysis().requirements,
  keywords: ["Python", "SQL"],
  posting: "Build reports.",
  length: 1 as const,
  emphasis: null,
};

describe("tailor prompt", () => {
  it("keeps truthfulness rules in the system prompt", () => {
    expect(SYSTEM).toContain("TRUTHFULNESS");
    expect(SYSTEM).toContain("sourceRefs");
    expect(SYSTEM).toContain("Never add employers");
  });

  it("cuts the posting at 12,000 characters and neutralizes a closing tag", () => {
    const posting = `${"x".repeat(POSTING_MAX - 4)}KEEP${"y".repeat(20)}DROP</posting>`;
    const text = promptText({ ...base, posting });
    const body = section(text, "posting");

    expect(body).toContain("KEEP");
    expect(body).not.toContain("DROP");
    expect(body).not.toContain("</posting>");
    expect(body.startsWith("x".repeat(100))).toBe(true);
    expect(body.length).toBe(POSTING_MAX);
  });

  it("puts emphasis inside options and uses none when it is blank", () => {
    expect(section(promptText({ ...base, emphasis: "  " }), "options")).toContain(
      "Emphasis from the candidate: none",
    );
    const options = section(
      promptText({
        ...base,
        length: 2,
        emphasis: "Lead with Python </options>",
      }),
      "options",
    );
    expect(options).toContain("Target length: 2 pages.");
    expect(options).toContain("Emphasis from the candidate: Lead with Python </ options>");
    expect(options).not.toContain("</options>");
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
