import { beforeEach, describe, expect, it, vi } from "vitest";

const { checkQuota, releaseUnsavedAnalysis, runStructured, requireUserForAction, revalidatePath } =
  vi.hoisted(() => ({
    checkQuota: vi.fn(),
    releaseUnsavedAnalysis: vi.fn(),
    runStructured: vi.fn(),
    requireUserForAction: vi.fn(),
    revalidatePath: vi.fn(),
  }));

const { jobCreate, jobEventCreate, reminderCreate, reminderUpdateMany, jobUpdateMany, jobFindFirst } =
  vi.hoisted(() => ({
    jobCreate: vi.fn(),
    jobEventCreate: vi.fn(),
    reminderCreate: vi.fn(),
    reminderUpdateMany: vi.fn(),
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
    reminder: { updateMany: reminderUpdateMany },
  },
}));

vi.mock("@/features/billing/quota", () => ({
  checkQuota,
  releaseUnsavedAnalysis,
}));

vi.mock("@/lib/ai/run", () => ({
  runStructured,
}));

vi.mock("@/lib/auth", () => ({
  requireUserForAction,
}));

import { strings } from "@/copy/strings";
import { normalizeAnalyzeOutput } from "@/features/jobs/analyze";
import { createJob, retryAnalysis } from "@/features/jobs/actions";
import { deadlineReminderTitle } from "@/features/tracking/reminders";
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
  reminderUpdateMany.mockResolvedValue({ count: 1 });
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
        title: deadlineReminderTitle(placeholders.company),
        dueAt: new Date("2026-02-26T00:00:00.000Z"),
        autoCreated: true,
      },
    });
    expect(jobUpdateMany).toHaveBeenCalledWith({
      where: { id: jobId, userId: user.id },
      data: { analysisStatus: "FAILED" },
    });
    expect(jobCreate).toHaveBeenCalledTimes(1);
    expect(releaseUnsavedAnalysis).not.toHaveBeenCalled();
    expect(runStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "ANALYZE",
        userId: user.id,
        refId: jobId,
        normalize: normalizeAnalyzeOutput,
      }),
    );
  });

  it("analyzes a plain-text description when every optional field is blank", async () => {
    const rawText = posting("Hybrid role in Toronto. Job ID 15. Pay is CA$90,000–CA$110,000.");
    runStructured.mockResolvedValue({ ok: true, data: analyzed() });
    const result = await createJob({
      rawText,
      url: "",
      deadline: "",
      source: null,
      priority: null,
    });

    expect(result).toEqual({
      ok: true,
      data: { jobId, analysisStatus: "READY" },
    });
    expect(jobCreate).toHaveBeenCalledTimes(1);
    expect(jobCreate.mock.calls[0]?.[0].data.rawText).toBe(rawText);
    expect(jobCreate.mock.calls[0]?.[0].data.url).toBeNull();
    expect(jobUpdateMany).toHaveBeenCalledWith({
      where: { id: jobId, userId: user.id },
      data: expect.objectContaining({
        analysisStatus: "READY",
        title: "Data analyst",
        company: "Acme",
        location: "Ottawa",
      }),
    });
    expect(jobUpdateMany.mock.calls[0]?.[0].data.url).toBeUndefined();
    expect(releaseUnsavedAnalysis).not.toHaveBeenCalled();
  });

  it("keeps markdown and fills a blank URL from the apply link", async () => {
    const rawText = posting(
      "\n## Software developer\n\n[Apply](https://jobs.example.com/15)\n\nhttps://example.com/privacy",
    );
    runStructured.mockResolvedValue({ ok: true, data: analyzed() });
    const result = await createJob(input({ rawText, url: "" }));

    expect(result).toEqual({
      ok: true,
      data: { jobId, analysisStatus: "READY" },
    });
    expect(jobCreate).toHaveBeenCalledTimes(1);
    expect(jobCreate.mock.calls[0]?.[0].data.rawText).toContain("## Software developer");
    expect(jobUpdateMany.mock.calls[0]?.[0].data.url).toBe("https://jobs.example.com/15");
  });

  it("keeps a URL the user typed", async () => {
    runStructured.mockResolvedValue({ ok: true, data: analyzed() });
    await createJob(
      input({
        rawText: posting("[Apply](https://jobs.example.com/15)"),
        url: "https://example.com/mine",
      }),
    );
    expect(jobCreate.mock.calls[0]?.[0].data.url).toBe("https://example.com/mine");
    expect(jobUpdateMany.mock.calls[0]?.[0].data.url).toBeUndefined();
  });

  it("saves the job when the model omits the company and salary", async () => {
    runStructured.mockResolvedValue({
      ok: true,
      data: analyzed({ company: " ", salary: null }),
    });
    const result = await createJob(input());
    expect(result).toEqual({
      ok: true,
      data: { jobId, analysisStatus: "READY" },
    });
    const saved = jobUpdateMany.mock.calls[0]?.[0].data;
    expect(saved.analysisStatus).toBe("READY");
    expect(saved.company).toBeUndefined();
    expect(saved.salaryMin).toBeUndefined();
    expect(saved.title).toBe("Data analyst");
    expect(jobCreate).toHaveBeenCalledTimes(1);
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
    expect(releaseUnsavedAnalysis).not.toHaveBeenCalled();
    expect(reminderUpdateMany).toHaveBeenCalledWith({
      where: {
        userId: user.id,
        jobId,
        kind: "DEADLINE",
        autoCreated: true,
        completedAt: null,
        dismissedAt: null,
      },
      data: { title: deadlineReminderTitle("Acme") },
    });
  });

  it("releases the charge when the model output cannot be saved", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    runStructured.mockResolvedValue({
      ok: true,
      data: {
        ...analyzed(),
        requirements: [{ text: null, kind: "skill", importance: "must" }],
      },
    });
    const result = await createJob(input());
    expect(result).toEqual({
      ok: true,
      data: { jobId, analysisStatus: "FAILED" },
    });
    expect(releaseUnsavedAnalysis).toHaveBeenCalledWith(user.id, jobId);
    expect(jobUpdateMany).toHaveBeenCalledWith({
      where: { id: jobId, userId: user.id },
      data: { analysisStatus: "FAILED" },
    });
    expect(runStructured).toHaveBeenCalledTimes(1);
    expect(jobCreate).toHaveBeenCalledTimes(1);
    expect(String(info.mock.calls[0]?.[0])).toContain('"stage":"extraction"');
    info.mockRestore();
  });

  it("releases the charge when the analysis cannot be stored", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    runStructured.mockResolvedValue({ ok: true, data: analyzed() });
    jobUpdateMany.mockRejectedValueOnce(new Error("db down"));
    const result = await createJob(input());
    expect(result).toEqual({
      ok: true,
      data: { jobId, analysisStatus: "FAILED" },
    });
    expect(jobCreate).toHaveBeenCalledTimes(1);
    expect(releaseUnsavedAnalysis).toHaveBeenCalledWith(user.id, jobId);
    expect(String(info.mock.calls[0]?.[0])).toContain('"stage":"persistence"');
    expect(String(info.mock.calls[0]?.[0])).not.toContain("db down");
    info.mockRestore();
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
    expect(releaseUnsavedAnalysis).not.toHaveBeenCalled();
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
    expect(releaseUnsavedAnalysis).toHaveBeenCalledWith(user.id, jobId);
    expect(jobCreate).not.toHaveBeenCalled();
  });

  it("retries the same failed job and does not insert another", async () => {
    runStructured.mockResolvedValueOnce({ ok: false, code: "AI_FAILED" });
    const created = await createJob(input());
    expect(created).toEqual({
      ok: true,
      data: { jobId, analysisStatus: "FAILED" },
    });
    expect(jobCreate).toHaveBeenCalledTimes(1);
    expect(releaseUnsavedAnalysis).not.toHaveBeenCalled();

    jobFindFirst.mockResolvedValue({
      ...failedJob,
      url: null,
      rawText: posting("[Apply](https://jobs.example.com/15)"),
    });
    runStructured.mockResolvedValueOnce({ ok: true, data: analyzed() });
    const retried = await retryAnalysis({ jobId });
    expect(retried).toEqual({
      ok: true,
      data: { jobId, analysisStatus: "READY" },
    });
    expect(jobCreate).toHaveBeenCalledTimes(1);
    expect(releaseUnsavedAnalysis).toHaveBeenCalledTimes(1);
    const saved = jobUpdateMany.mock.calls.at(-1)?.[0].data;
    expect(saved.url).toBe("https://jobs.example.com/15");
    expect(saved.title).toBeUndefined();
  });

  it("does not replace a URL saved on the job before retry", async () => {
    jobFindFirst.mockResolvedValue({
      ...failedJob,
      url: "https://example.com/mine",
      rawText: posting("[Apply](https://jobs.example.com/15)"),
    });
    runStructured.mockResolvedValue({ ok: true, data: analyzed() });
    await retryAnalysis({ jobId });
    expect(jobUpdateMany.mock.calls.at(-1)?.[0].data.url).toBeUndefined();
    expect(jobCreate).not.toHaveBeenCalled();
  });
});
