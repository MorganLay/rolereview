import { describe, expect, it } from "vitest";

import { strings } from "@/copy/strings";
import { parseBulletLines } from "@/features/marketing/tools/bullets";
import {
  isKeywordCheckerLimited,
  KEYWORD_CHECKER_DAILY_LIMIT,
  topMustHaveTexts,
} from "@/features/marketing/tools/limit";
import { checkKeywordSchema } from "@/features/marketing/tools/schemas";

const token = "turnstile-token";

describe("isKeywordCheckerLimited", () => {
  it("allows two runs and blocks the fourth", () => {
    expect(isKeywordCheckerLimited(0)).toBe(false);
    expect(isKeywordCheckerLimited(2)).toBe(false);
    expect(isKeywordCheckerLimited(3)).toBe(true);
    expect(isKeywordCheckerLimited(4)).toBe(true);
    expect(KEYWORD_CHECKER_DAILY_LIMIT).toBe(3);
  });
});

describe("topMustHaveTexts", () => {
  it("keeps the first five must-haves and skips nice-to-haves", () => {
    const requirements = [
      { text: "SQL", importance: "must" },
      { text: "Nice Python", importance: "nice" },
      { text: "  Tableau  ", importance: "must" },
      { text: "", importance: "must" },
      { text: "Excel", importance: "must" },
      { text: "R", importance: "must" },
      { text: "Power BI", importance: "must" },
      { text: "Sixth must", importance: "must" },
    ];
    expect(topMustHaveTexts(requirements)).toEqual([
      "SQL",
      "Tableau",
      "Excel",
      "R",
      "Power BI",
    ]);
  });

  it("returns nothing when there are no must-haves", () => {
    expect(
      topMustHaveTexts([{ text: "Nice to have", importance: "nice" }]),
    ).toEqual([]);
  });
});

describe("parseBulletLines", () => {
  it("drops blank lines and list markers", () => {
    const text = [
      "  • Led a team of 8 analysts.",
      "",
      "- Built weekly reports in SQL.",
      "*   Owned the dashboard.",
    ].join("\n");
    expect(parseBulletLines(text)).toEqual({
      bullets: [
        "Led a team of 8 analysts.",
        "Built weekly reports in SQL.",
        "Owned the dashboard.",
      ],
      extra: 0,
    });
  });

  it("keeps the first 10 lines and counts extras", () => {
    const lines = Array.from({ length: 12 }, (_, index) => `Bullet ${index + 1}`);
    const parsed = parseBulletLines(lines.join("\n"));
    expect(parsed.bullets).toHaveLength(10);
    expect(parsed.bullets[0]).toBe("Bullet 1");
    expect(parsed.bullets[9]).toBe("Bullet 10");
    expect(parsed.extra).toBe(2);
  });

  it("treats empty paste as no bullets", () => {
    expect(parseBulletLines("  \n\n  ")).toEqual({ bullets: [], extra: 0 });
  });
});

describe("checkKeywordSchema", () => {
  it("requires posting, resume, and a captcha token", () => {
    expect(checkKeywordSchema.safeParse({}).success).toBe(false);
    expect(
      checkKeywordSchema.safeParse({
        posting: "   ",
        resume: "Analyst resume text.",
        turnstileToken: token,
      }).success,
    ).toBe(false);
  });

  it("trims inputs and accepts a short posting", () => {
    const parsed = checkKeywordSchema.parse({
      posting: "  Need SQL and Excel.  ",
      resume: "  Used SQL weekly.  ",
      turnstileToken: token,
    });
    expect(parsed.posting).toBe("Need SQL and Excel.");
    expect(parsed.resume).toBe("Used SQL weekly.");
  });

  it("rejects a posting over 30,000 characters", () => {
    const parsed = checkKeywordSchema.safeParse({
      posting: "a".repeat(30_001),
      resume: "Used SQL weekly.",
      turnstileToken: token,
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.flatten().fieldErrors.posting).toEqual([
      strings.marketing.tools.keyword.errors.postingLong,
    ]);
  });
});
