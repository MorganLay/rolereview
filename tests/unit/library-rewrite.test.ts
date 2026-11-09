import { describe, expect, it } from "vitest";

import {
  headlineShapeAllowed,
  reviewQuestions,
  reviewRewrite,
  reusableSummaryAllowed,
} from "@/features/library/rewrite-guard";
import { inflatedRole } from "@/features/tailor/grounding";

const evidence = [
  "Helped coordinate the lunch rush and cooked food.",
  "Used SQL for the weekly report.",
  "McDonald's",
  "Crew Member",
];

describe("reviewRewrite", () => {
  it("keeps a rewrite that only uses saved facts", () => {
    const result = reviewRewrite({
      text: "Coordinated the lunch rush and cooked food.",
      why: "Leads with the coordination already in the line.",
      question: null,
      original: "Helped coordinate the lunch rush and cooked food.",
      evidence,
    });
    expect(result.ok).toBe(true);
  });

  it("drops a rewrite that adds a number or a tool", () => {
    const number = reviewRewrite({
      text: "Coordinated the lunch rush for 200 guests.",
      why: "Adds scale.",
      question: null,
      original: "Helped coordinate the lunch rush and cooked food.",
      evidence,
    });
    expect(number).toEqual({ ok: false, reason: "number" });

    const tool = reviewRewrite({
      text: "Used PostgreSQL for the weekly report.",
      why: "Names the database.",
      question: null,
      original: "Used SQL for the weekly report.",
      evidence,
    });
    expect(tool.ok).toBe(false);
  });

  it("asks a question without putting a new digit in the suggestion", () => {
    const result = reviewRewrite({
      text: "Coordinated the lunch rush and cooked food.",
      why: "Clearer verb, same facts.",
      question: "About how many meals did that rush include?",
      original: "Helped coordinate the lunch rush and cooked food.",
      evidence,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.text).not.toMatch(/\d/);
    expect(result.question).toContain("?");
  });
});

describe("inflatedRole", () => {
  it("rejects a support line rewritten as leadership or a narrower database", () => {
    expect(
      inflatedRole("Led the lunch rush.", ["Helped coordinate the lunch rush and cooked food."]),
    ).toBe("led");
    expect(
      inflatedRole("Developed PostgreSQL infrastructure for the weekly report.", [
        "Used SQL for the weekly report.",
      ]),
    ).toBe("postgresql");
    expect(
      inflatedRole("Directed enterprise analytics strategy.", ["Assisted with reporting."]),
    ).toBe("directed");
  });

  it("allows the same role the source already states", () => {
    expect(inflatedRole("Led the lunch rush for the crew.", ["Led the lunch rush for the crew."])).toBe(
      null,
    );
  });
});

describe("reviewQuestions", () => {
  it("drops a question that asserts a number or is not a question", () => {
    expect(
      reviewQuestions(
        ["Did you work the lunch rush?", "You supervised 4 people.", "Opened the store"],
        evidence,
        6,
      ),
    ).toEqual(["Did you work the lunch rush?"]);
  });
});

describe("headlineShapeAllowed", () => {
  const titles = ["Junior Program Officer", "Full-Stack Developer Intern"];

  it("keeps a short focus and drops a bullet or a tool list", () => {
    expect(headlineShapeAllowed("Reporting analyst", titles)).toBe(true);
    expect(headlineShapeAllowed("Full-stack developer", titles)).toBe(true);
    expect(headlineShapeAllowed("Built and deployed a production web app", titles)).toBe(false);
    expect(
      headlineShapeAllowed(
        "Data and Reporting Professional | SQL, Python, TensorFlow | Automated Excel Reporting Delivery",
        titles,
      ),
    ).toBe(false);
    expect(headlineShapeAllowed("Junior Program Officer", titles)).toBe(false);
  });
});

describe("reusableSummaryAllowed", () => {
  it("rejects a classification code that is not a saved title", () => {
    expect(reusableSummaryAllowed("Seeking an IT Developer (CS-01) role.", ["Crew Member"])).toBe(
      false,
    );
    expect(reusableSummaryAllowed("Crew member who cooks and serves.", ["Crew Member"])).toBe(true);
  });
});
