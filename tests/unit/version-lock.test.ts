import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUserForAction, revalidatePath, runStructured, checkQuota } = vi.hoisted(() => ({
  requireUserForAction: vi.fn(),
  revalidatePath: vi.fn(),
  runStructured: vi.fn(),
  checkQuota: vi.fn(),
}));

const db = vi.hoisted(() => ({
  resumeFindFirst: vi.fn(),
  resumeUpdateMany: vi.fn(),
  jobFindFirst: vi.fn(),
  txResumeFindFirst: vi.fn(),
  txResumeUpdateMany: vi.fn(),
  txResumeCreate: vi.fn(),
  txJobUpdateMany: vi.fn(),
  letterFindFirst: vi.fn(),
  letterUpdateMany: vi.fn(),
  txLetterFindFirst: vi.fn(),
  txLetterUpdateMany: vi.fn(),
  txLetterCreate: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/auth", () => ({ requireUserForAction }));
vi.mock("@/lib/ai/run", () => ({ runStructured }));
vi.mock("@/features/billing/quota", () => ({ checkQuota }));
vi.mock("@/lib/db", () => ({
  db: {
    $transaction: async (run: (tx: unknown) => Promise<unknown>) =>
      run({
        tailoredResume: {
          findFirst: db.txResumeFindFirst,
          updateMany: db.txResumeUpdateMany,
          create: db.txResumeCreate,
        },
        coverLetter: {
          findFirst: db.txLetterFindFirst,
          updateMany: db.txLetterUpdateMany,
          create: db.txLetterCreate,
        },
        job: { updateMany: db.txJobUpdateMany },
      }),
    tailoredResume: {
      findFirst: db.resumeFindFirst,
      updateMany: db.resumeUpdateMany,
    },
    coverLetter: {
      findFirst: db.letterFindFirst,
      updateMany: db.letterUpdateMany,
    },
    job: { findFirst: db.jobFindFirst },
  },
}));

import { createLetterRevision, saveLetterContent, setLetterLabel } from "@/features/letters/actions";
import {
  createResumeRevision,
  markResumeSubmitted,
  saveResumeContent,
  setResumeLabel,
  setResumeTemplate,
} from "@/features/tailor/actions";

const user = { id: "user-1", plan: "PRO" as const, email: "morgan@example.com", role: "USER" as const };
const jobId = "11111111-1111-4111-8111-111111111111";
const resumeId = "22222222-2222-4222-8222-222222222222";
const letterId = "33333333-3333-4333-8333-333333333333";
const content = {
  schemaVersion: 1 as const,
  summary: { text: "Analyst.", included: true },
  entries: [],
  skills: [],
};

describe("submitted resume lock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserForAction.mockResolvedValue(user);
  });

  it("refuses a content save and a template change", async () => {
    db.resumeFindFirst.mockResolvedValue({
      id: resumeId,
      submittedAt: new Date("2026-04-10T15:00:00.000Z"),
      content,
      librarySnapshot: {},
      aiOutput: null,
    });

    const saved = await saveResumeContent({ jobId, resumeId, content });
    const template = await setResumeTemplate({ jobId, resumeId, templateId: "compact" });

    expect(saved).toEqual({ ok: false, error: { code: "CONFLICT" } });
    expect(template).toEqual({ ok: false, error: { code: "CONFLICT" } });
    expect(db.resumeUpdateMany).not.toHaveBeenCalled();
    expect(runStructured).not.toHaveBeenCalled();
  });

  it("still saves a version name", async () => {
    db.resumeUpdateMany.mockResolvedValue({ count: 1 });

    const result = await setResumeLabel({ jobId, resumeId, label: "  Sent copy  " });

    expect(result).toEqual({ ok: true, data: { label: "Sent copy" } });
    expect(db.resumeUpdateMany).toHaveBeenCalledWith({
      where: { id: resumeId, jobId, userId: user.id, status: "READY" },
      data: { label: "Sent copy" },
    });
  });

  it("stores a blank name as null", async () => {
    db.resumeUpdateMany.mockResolvedValue({ count: 1 });
    const result = await setResumeLabel({ jobId, resumeId, label: "   " });
    expect(result).toEqual({ ok: true, data: { label: null } });
    expect(db.resumeUpdateMany.mock.calls[0]?.[0].data.label).toBeNull();
  });

  it("sets submittedAt once and does not overwrite it", async () => {
    db.resumeFindFirst.mockResolvedValue({ id: resumeId });
    db.jobFindFirst.mockResolvedValue({ status: "APPLIED" });
    db.txJobUpdateMany.mockResolvedValue({ count: 1 });
    db.txResumeUpdateMany.mockResolvedValue({ count: 0 });

    const result = await markResumeSubmitted({ jobId, resumeId });

    expect(result).toEqual({ ok: true, data: { submitted: true } });
    expect(db.txResumeUpdateMany.mock.calls[0]?.[0].where.submittedAt).toBeNull();
    expect(db.txJobUpdateMany.mock.calls[0]?.[0].data.submittedResumeId).toBe(resumeId);
    expect(runStructured).not.toHaveBeenCalled();
    expect(checkQuota).not.toHaveBeenCalled();
  });

  it("copies a submitted resume into the next version without an AI call", async () => {
    db.txResumeFindFirst.mockImplementation(
      (args: { select?: { version?: boolean } }) => {
        if (args.select?.version) return { version: 2 };
        return {
          submittedAt: new Date("2026-04-10T15:00:00.000Z"),
          targetProfileId: null,
          options: { length: 1 },
          librarySnapshot: { schemaVersion: 1 },
          aiOutput: { summary: "Analyst." },
          content,
          matchReport: { verdicts: [], score: 82 },
          matchScore: 82,
          guardReverts: 1,
          templateId: "classic",
        };
      },
    );
    db.txResumeCreate.mockResolvedValue({
      id: "44444444-4444-4444-8444-444444444444",
      version: 3,
    });

    const result = await createResumeRevision({ jobId, resumeId });

    expect(result).toEqual({
      ok: true,
      data: { id: "44444444-4444-4444-8444-444444444444", version: 3 },
    });
    const created = db.txResumeCreate.mock.calls[0]?.[0].data;
    expect(created.version).toBe(3);
    expect(created.status).toBe("READY");
    expect(created.content).toEqual(content);
    expect(created.librarySnapshot).toEqual({ schemaVersion: 1 });
    expect(created.aiOutput).toEqual({ summary: "Analyst." });
    expect(created.matchScore).toBe(82);
    expect(created.templateId).toBe("classic");
    expect(created.submittedAt).toBeUndefined();
    expect(created.label).toBeUndefined();
    expect(runStructured).not.toHaveBeenCalled();
    expect(checkQuota).not.toHaveBeenCalled();
  });

  it("refuses to copy a version that is still editable", async () => {
    db.txResumeFindFirst.mockResolvedValue({
      submittedAt: null,
      options: {},
      librarySnapshot: null,
      aiOutput: null,
      content: null,
      matchReport: null,
      matchScore: null,
      guardReverts: 0,
      templateId: "classic",
      targetProfileId: null,
    });

    const result = await createResumeRevision({ jobId, resumeId });

    expect(result).toEqual({ ok: false, error: { code: "CONFLICT" } });
    expect(db.txResumeCreate).not.toHaveBeenCalled();
  });
});

describe("submitted letter lock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserForAction.mockResolvedValue(user);
  });

  it("refuses a content save", async () => {
    db.letterFindFirst.mockResolvedValue({
      id: letterId,
      submittedAt: new Date("2026-04-10T15:00:00.000Z"),
      content: { greeting: "Hello," },
      aiOutput: null,
    });

    const saved = await saveLetterContent({
      jobId,
      letterId,
      content: {
        schemaVersion: 1,
        greeting: "Hello,",
        paragraphs: [],
        closing: "Sincerely,",
        signature: "Morgan",
        requirementIdsAddressed: [],
      },
    });

    expect(saved).toEqual({ ok: false, error: { code: "CONFLICT" } });
    expect(db.letterUpdateMany).not.toHaveBeenCalled();
    expect(runStructured).not.toHaveBeenCalled();
  });

  it("copies a submitted letter into the next version", async () => {
    const letterContent = { greeting: "Hello," };
    db.txLetterFindFirst.mockImplementation(
      (args: { select?: { version?: boolean } }) => {
        if (args.select?.version) return { version: 1 };
        return {
          submittedAt: new Date("2026-04-10T15:00:00.000Z"),
          options: { tone: "warm" },
          librarySnapshot: { schemaVersion: 1 },
          aiOutput: { closing: "Sincerely," },
          content: letterContent,
          guardReverts: 0,
          templateId: "classic",
        };
      },
    );
    db.txLetterCreate.mockResolvedValue({
      id: "55555555-5555-4555-8555-555555555555",
      version: 2,
    });

    const result = await createLetterRevision({ jobId, letterId });

    expect(result).toEqual({
      ok: true,
      data: { id: "55555555-5555-4555-8555-555555555555", version: 2 },
    });
    const created = db.txLetterCreate.mock.calls[0]?.[0].data;
    expect(created.version).toBe(2);
    expect(created.content).toEqual(letterContent);
    expect(created.submittedAt).toBeUndefined();
    expect(runStructured).not.toHaveBeenCalled();
    expect(checkQuota).not.toHaveBeenCalled();
  });

  it("saves a letter name after it is submitted", async () => {
    db.letterUpdateMany.mockResolvedValue({ count: 1 });
    const result = await setLetterLabel({ jobId, letterId, label: "Warm note" });
    expect(result).toEqual({ ok: true, data: { label: "Warm note" } });
  });
});
