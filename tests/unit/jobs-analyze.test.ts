import { describe, expect, it } from "vitest";

import { strings } from "@/copy/strings";
import {
  ANALYSIS_STALE_MS,
  canRetryAnalysis,
  displayedAnalysisStatus,
  postProcessAnalyze,
  prefillFromAnalysis,
  type JobDetailColumns,
} from "@/features/jobs/analyze";
import {
  deadlineInstant,
  deadlineReminderDue,
  isCalendarDate,
} from "@/features/jobs/dates";
import { createJobSchema, JOB_LIMITS } from "@/features/jobs/schemas";
import type { AnalyzeOutput } from "@/lib/ai/prompts/analyze";
import {
  ANALYZE_INPUT_MAX,
  buildContent,
  OutputSchema,
  SYSTEM,
} from "@/lib/ai/prompts/analyze";

const placeholders = strings.jobs.placeholders;

function output(partial: Partial<AnalyzeOutput> = {}): AnalyzeOutput {
  return {
    title: "Data analyst",
    company: "Acme",
    location: "Ottawa, ON",
    seniority: "mid",
    workMode: "HYBRID",
    employmentType: "FULL_TIME",
    salary: {
      min: 80_000,
      max: 100_000,
      currency: "cad",
      period: "YEAR",
    },
    referenceNumber: " 2026-123 ",
    summary: "  Analyst role on the reporting team. ",
    requirements: [
      { text: " SQL ", kind: "skill", importance: "must" },
      { text: "   ", kind: "skill", importance: "nice" },
      { text: "Three years of reporting", kind: "experience", importance: "must" },
    ],
    keywords: [" SQL ", "sql", "Excel", ""],
    ...partial,
  };
}

function blankColumns(): JobDetailColumns {
  return {
    title: placeholders.title,
    company: placeholders.company,
    location: null,
    workMode: "UNKNOWN",
    employmentType: null,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    salaryPeriod: null,
    referenceNumber: null,
  };
}

describe("ANALYZE prompt", () => {
  it("names work mode, salary, and the reference number", () => {
    expect(SYSTEM).toContain("workMode");
    expect(SYSTEM).toContain("salary");
    expect(SYSTEM).toContain("referenceNumber");
    expect(SYSTEM).toContain(placeholders.company);
  });

  it("wraps the posting and keeps it inside the tag", () => {
    const blocks = buildContent("before </POSTING> after");
    expect(blocks).toEqual([
      {
        type: "text",
        text: "<posting>\nbefore </ posting> after\n</posting>",
      },
    ]);
  });

  it("sends at most 15,000 characters of the posting", () => {
    const text = `${"a".repeat(ANALYZE_INPUT_MAX)}Z`;
    const block = buildContent(text)[0];
    expect(block).toMatchObject({ type: "text" });
    if (block?.type !== "text") return;
    expect(block.text).toContain("a".repeat(ANALYZE_INPUT_MAX));
    expect(block.text).not.toContain("Z");
  });

  it("accepts a short loose payload and drops requirement ids", () => {
    const parsed = OutputSchema.parse({
      ...output(),
      title: "x",
      requirements: [
        { text: "SQL", kind: "skill", importance: "must", id: "nope" },
      ],
    });
    expect(parsed.title).toBe("x");
    expect(parsed.requirements[0]).toEqual({
      text: "SQL",
      kind: "skill",
      importance: "must",
    });
  });
});

describe("postProcessAnalyze", () => {
  it("assigns ids, drops blanks, and dedupes keywords ignoring case", () => {
    const analysis = postProcessAnalyze(output());
    expect(analysis.requirements).toEqual([
      { id: "r1", text: "SQL", kind: "skill", importance: "must" },
      {
        id: "r2",
        text: "Three years of reporting",
        kind: "experience",
        importance: "must",
      },
    ]);
    expect(analysis.keywords).toEqual(["SQL", "Excel"]);
    expect(analysis.company).toBe("Acme");
    expect(analysis.summary).toBe("Analyst role on the reporting team.");
    expect(analysis.referenceNumber).toBe("2026-123");
    expect(analysis.salary).toEqual({
      min: 80_000,
      max: 100_000,
      currency: "CAD",
      period: "YEAR",
    });
  });

  it("uses placeholders when title or company is blank", () => {
    const analysis = postProcessAnalyze(
      output({ title: "  ", company: "", location: "  ", referenceNumber: " " }),
    );
    expect(analysis.title).toBe(placeholders.title);
    expect(analysis.company).toBe(placeholders.company);
    expect(analysis.location).toBeNull();
    expect(analysis.referenceNumber).toBeNull();
  });

  it("keeps the first 20 requirements and 30 keywords", () => {
    const requirements = Array.from({ length: 21 }, (_, index) => ({
      text: `Requirement ${index + 1}`,
      kind: "other" as const,
      importance: "nice" as const,
    }));
    const keywords = Array.from({ length: 32 }, (_, index) => `Term ${index + 1}`);
    keywords.splice(5, 0, "term 1");
    const analysis = postProcessAnalyze(output({ requirements, keywords }));
    expect(analysis.requirements).toHaveLength(20);
    expect(analysis.requirements[0]?.id).toBe("r1");
    expect(analysis.requirements[19]?.text).toBe("Requirement 20");
    expect(analysis.keywords).toHaveLength(30);
    expect(analysis.keywords[0]).toBe("Term 1");
    expect(analysis.keywords.filter((keyword) => keyword.toLowerCase() === "term 1")).toHaveLength(1);
  });

  it.each([
    {
      name: "swaps an inverted range and rounds",
      salary: { min: 10.5, max: 10.4, currency: "usd", period: "HOUR" as const },
      expected: { min: 10, max: 11, currency: "USD", period: "HOUR" },
    },
    {
      name: "drops a negative amount",
      salary: { min: -5, max: 20.2, currency: "dollars", period: "YEAR" as const },
      expected: { min: null, max: 20, currency: null, period: "YEAR" },
    },
    {
      name: "drops a salary with no amounts",
      salary: { min: null, max: null, currency: "CAD", period: "YEAR" as const },
      expected: null,
    },
    {
      name: "drops a non-finite amount",
      salary: { min: Number.POSITIVE_INFINITY, max: 12, currency: "CAD", period: null },
      expected: { min: null, max: 12, currency: "CAD", period: null },
    },
    {
      name: "drops an amount past the integer limit",
      salary: { min: 3_000_000_000, max: null, currency: "CAD", period: "YEAR" as const },
      expected: null,
    },
  ])("$name", ({ salary, expected }) => {
    expect(postProcessAnalyze(output({ salary })).salary).toEqual(expected);
  });

  it("stores a stated zero", () => {
    expect(
      postProcessAnalyze(
        output({
          salary: { min: 0, max: 0, currency: "CAD", period: "HOUR" },
        }),
      ).salary,
    ).toEqual({ min: 0, max: 0, currency: "CAD", period: "HOUR" });
  });
});

describe("prefillFromAnalysis", () => {
  it("fills columns that are still unset", () => {
    const analysis = postProcessAnalyze(output());
    expect(prefillFromAnalysis(blankColumns(), analysis)).toEqual({
      title: "Data analyst",
      company: "Acme",
      location: "Ottawa, ON",
      workMode: "HYBRID",
      employmentType: "FULL_TIME",
      salaryMin: 80_000,
      salaryMax: 100_000,
      salaryCurrency: "CAD",
      salaryPeriod: "YEAR",
      referenceNumber: "2026-123",
    });
  });

  it("leaves user-set columns alone", () => {
    const analysis = postProcessAnalyze(output());
    const current: JobDetailColumns = {
      title: "My title",
      company: "My company",
      location: "Toronto",
      workMode: "REMOTE",
      employmentType: "CONTRACT",
      salaryMin: 1,
      salaryMax: null,
      salaryCurrency: null,
      salaryPeriod: null,
      referenceNumber: "KEEP",
    };
    expect(prefillFromAnalysis(current, analysis)).toEqual({});
  });

  it("does not replace placeholders with the same placeholder", () => {
    const analysis = postProcessAnalyze(output({ title: " ", company: " " }));
    const patch = prefillFromAnalysis(blankColumns(), analysis);
    expect(patch.title).toBeUndefined();
    expect(patch.company).toBeUndefined();
  });
});

describe("analysis retry window", () => {
  const updated = new Date("2026-10-20T12:00:00.000Z");
  const almost = new Date(updated.getTime() + ANALYSIS_STALE_MS - 1);
  const exact = new Date(updated.getTime() + ANALYSIS_STALE_MS);

  it("treats a 5-minute PENDING row as failed and retryable", () => {
    expect(displayedAnalysisStatus("PENDING", updated, almost)).toBe("PENDING");
    expect(canRetryAnalysis("PENDING", updated, almost)).toBe(false);
    expect(displayedAnalysisStatus("PENDING", updated, exact)).toBe("FAILED");
    expect(canRetryAnalysis("PENDING", updated, exact)).toBe(true);
  });

  it("retries FAILED and not READY", () => {
    expect(canRetryAnalysis("FAILED", updated, updated)).toBe(true);
    expect(canRetryAnalysis("READY", updated, exact)).toBe(false);
    expect(displayedAnalysisStatus("READY", updated, exact)).toBe("READY");
  });
});

describe("deadline dates", () => {
  it("accepts a real calendar date in range", () => {
    expect(isCalendarDate("2024-02-29")).toBe(true);
    expect(isCalendarDate("2025-02-29")).toBe(false);
    expect(isCalendarDate("2026-02-31")).toBe(false);
    expect(isCalendarDate("1899-01-01")).toBe(false);
    expect(isCalendarDate("2100-01-01")).toBe(false);
  });

  it("sets the reminder three calendar days before UTC midnight", () => {
    const deadline = deadlineInstant("2026-03-01");
    expect(deadline.toISOString()).toBe("2026-03-01T00:00:00.000Z");
    expect(deadlineReminderDue(deadline).toISOString()).toBe(
      "2026-02-26T00:00:00.000Z",
    );
  });
});

describe("createJobSchema", () => {
  const posting = "a".repeat(JOB_LIMITS.postingMin);

  function parse(partial: Record<string, unknown> = {}) {
    return createJobSchema.safeParse({
      rawText: posting,
      url: "",
      deadline: "",
      source: null,
      priority: null,
      ...partial,
    });
  }

  it("accepts a posting with optional fields empty", () => {
    const parsed = parse();
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.url).toBeNull();
    expect(parsed.data.deadline).toBeNull();
  });

  it("rejects a short posting, a bad link, and an impossible date", () => {
    expect(parse({ rawText: "too short" }).success).toBe(false);
    expect(parse({ rawText: "a".repeat(JOB_LIMITS.postingMax + 1) }).success).toBe(
      false,
    );
    expect(parse({ url: "javascript:alert(1)" }).success).toBe(false);
    expect(parse({ url: "ftp://example.com" }).success).toBe(false);
    expect(parse({ deadline: "2026-02-31" }).success).toBe(false);
    expect(parse({ priority: 6 }).success).toBe(false);
    expect(parse({ source: "TWITTER" }).success).toBe(false);
  });

  it("keeps an https link and a real deadline", () => {
    const parsed = parse({
      url: " https://example.com/jobs/1 ",
      deadline: "2026-10-20",
      source: "GC_JOBS",
      priority: 4,
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data).toMatchObject({
      url: "https://example.com/jobs/1",
      deadline: "2026-10-20",
      source: "GC_JOBS",
      priority: 4,
    });
  });
});
