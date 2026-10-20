import { beforeEach, describe, expect, it, vi } from "vitest";

const { checkQuota, runStructured, requireUserForAction, revalidatePath } =
  vi.hoisted(() => ({
    checkQuota: vi.fn(),
    runStructured: vi.fn(),
    requireUserForAction: vi.fn(),
    revalidatePath: vi.fn(),
  }));

const { jobCreate, jobEventCreate, reminderCreate, jobUpdateMany, jobFindFirst } =
  vi.hoisted(() => ({
    jobCreate: vi.fn(),
    jobEventCreate: vi.fn(),
    reminderCreate: vi.fn(),
    jobUpdateMany: vi.fn(),
    jobFindFirst: vi.fn(),
  }));

vi.mock("next/cache", () => ({
  revalidatePath,
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: async (run: (tx: unknown) => Promise<unknown>) =>
      run({
        job: { create: jobCreate },
        jobEvent: { create: jobEventCreate },
        reminder: { create: reminderCreate },
      }),
    job: {
      updateMany: jobUpdateMany,
      findFirst: jobFindFirst,
    },
  },
}));

vi.mock("@/features/billing/quota", () => ({
  checkQuota,
}));

vi.mock("@/lib/ai/run", () => ({
  runStructured,
}));

vi.mock("@/lib/auth", () => ({
  requireUserForAction,
}));

import { strings } from "@/copy/strings";
import { createJob, retryAnalysis } from "@/features/jobs/actions";
import type { AnalyzeOutput } from "@/lib/ai/prompts/analyze";

const user = { id: "user-1", plan: "FREE" as const, email: "a@b.c", role: "USER" as const };
const jobId = "11111111-1111-4111-8111-111111111111";
const placeholders = strings.jobs.placeholders;

function posting(extra = ""): string {
  return `${"Role details. ".repeat(20)}${extra}`;
}

function input(partial: Record<string, unknown> = {}) {
  return {
    rawText: posting(),
    url: "",
    deadline: "",
    source: null,
    priority: null,
    ...partial,
  };
}

function analyzed(partial: Partial<AnalyzeOutput> = {}): AnalyzeOutput {
  return {
    title: "Data analyst",
    company: "Acme",
    location: "Ottawa",
    seniority: "mid",
    workMode: "HYBRID",
    employmentType: "FULL_TIME",
    salary: { min: 80_000, max: 90_000, currency: "CAD", period: "YEAR" },
    referenceNumber: "REF-9",
    summary: "A reporting role.",
    requirements: [{ text: "SQL", kind: "skill", importance: "must" }],
    keywords: ["SQL"],
    ...partial,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  requireUserForAction.mockResolvedValue(user);
  checkQuota.mockResolvedValue({ allowed: true, useBonus: false });
  jobCreate.mockResolvedValue({ id: jobId });
  jobEventCreate.mockResolvedValue({ id: "event-1" });
  reminderCreate.mockResolvedValue({ id: "reminder-1" });
  jobUpdateMany.mockResolvedValue({ count: 1 });
});

describe("createJob", () => {
  it("does not create a job when the daily analysis quota is used up", async () => {
    checkQuota.mockResolvedValue({ allowed: false, useBonus: false });
    const result = await createJob(input());
    expect(result).toEqual({ ok: false, error: { code: "QUOTA_EXCEEDED" } });
    expect(jobCreate).not.toHaveBeenCalled();
    expect(runStructured).not.toHaveBeenCalled();
  });

  it("leaves a FAILED job when the model call fails", async () => {
    runStructured.mockResolvedValue({ ok: false, code: "AI_FAILED" });
    const result = await createJob(
      input({
        url: "https://example.com/jobs/1",
        deadline: "2026-03-01",
        source: "JOB_BANK",
        priority: 4,
      }),
    );

    expect(result).toEqual({
      ok: true,
      data: { jobId, analysisStatus: "FAILED" },
    });
    const created = jobCreate.mock.calls[0]?.[0].data;
    expect(created.status).toBeUndefined();
    expect(created).toMatchObject({
      userId: user.id,
      title: placeholders.title,
      company: placeholders.company,
      analysisStatus: "PENDING",
      url: "https://example.com/jobs/1",
      source: "JOB_BANK",
      priority: 4,
    });
    expect(created.deadline).toEqual(new Date("2026-03-01T00:00:00.000Z"));
    expect(jobEventCreate).toHaveBeenCalledWith({
      data: { userId: user.id, jobId, type: "CREATED" },
    });
    expect(reminderCreate).toHaveBeenCalledWith({
      data: {
        userId: user.id,
        jobId,
        kind: "DEADLINE",
        title: strings.jobs.reminder.deadline,
        dueAt: new Date("2026-02-26T00:00:00.000Z"),
        autoCreated: true,
      },
    });
    expect(jobUpdateMany).toHaveBeenCalledWith({
      where: { id: jobId, userId: user.id },
      data: { analysisStatus: "FAILED" },
    });
    expect(runStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "ANALYZE",
        userId: user.id,
        refId: jobId,
      }),
    );
  });

  it("fills unset columns from a successful analysis", async () => {
    runStructured.mockResolvedValue({ ok: true, data: analyzed() });
    const result = await createJob(input());
    expect(result).toEqual({
      ok: true,
      data: { jobId, analysisStatus: "READY" },
    });
    expect(jobUpdateMany).toHaveBeenCalledWith({
      where: { id: jobId, userId: user.id },
      data: expect.objectContaining({
        analysisStatus: "READY",
        title: "Data analyst",
        company: "Acme",
        location: "Ottawa",
        workMode: "HYBRID",
        employmentType: "FULL_TIME",
        salaryMin: 80_000,
        salaryMax: 90_000,
        salaryCurrency: "CAD",
        salaryPeriod: "YEAR",
        referenceNumber: "REF-9",
      }),
    });
    const saved = jobUpdateMany.mock.calls[0]?.[0].data;
    expect(saved.status).toBeUndefined();
    expect(saved.analysis.requirements[0].id).toBe("r1");
  });
});

describe("retryAnalysis", () => {
  const failedJob = {
    id: jobId,
    title: "Kept title",
    company: placeholders.company,
    location: null,
    rawText: posting(),
    workMode: "REMOTE",
    employmentType: null,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    salaryPeriod: null,
    referenceNumber: null,
    analysisStatus: "FAILED",
    updatedAt: new Date("2026-10-20T12:00:00.000Z"),
  };

  it("does not call the model again when analysis already succeeded", async () => {
    jobFindFirst.mockResolvedValue({ ...failedJob, analysisStatus: "READY" });
    const result = await retryAnalysis({ jobId });
    expect(result).toEqual({ ok: false, error: { code: "CONFLICT" } });
    expect(runStructured).not.toHaveBeenCalled();
    expect(jobUpdateMany).not.toHaveBeenCalled();
  });

  it("retries a FAILED job and still does not replace fields the user set", async () => {
    jobFindFirst.mockResolvedValue(failedJob);
    runStructured.mockResolvedValue({ ok: true, data: analyzed() });
    const result = await retryAnalysis({ jobId });
    expect(result).toEqual({
      ok: true,
      data: { jobId, analysisStatus: "READY" },
    });
    expect(jobUpdateMany).toHaveBeenNthCalledWith(1, {
      where: {
        id: jobId,
        userId: user.id,
        OR: [
          { analysisStatus: "FAILED" },
          {
            analysisStatus: "PENDING",
            updatedAt: { lte: expect.any(Date) },
          },
        ],
      },
      data: { analysisStatus: "PENDING" },
    });
    const saved = jobUpdateMany.mock.calls[1]?.[0].data;
    expect(saved.analysisStatus).toBe("READY");
    expect(saved.title).toBeUndefined();
    expect(saved.workMode).toBeUndefined();
    expect(saved.company).toBe("Acme");
    expect(saved.referenceNumber).toBe("REF-9");
  });
});
