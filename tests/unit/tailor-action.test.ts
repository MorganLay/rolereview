import { beforeEach, describe, expect, it, vi } from "vitest";

const { checkQuota, runStructured, requireUserForAction, revalidatePath, getLibrary } =
  vi.hoisted(() => ({
    checkQuota: vi.fn(),
    runStructured: vi.fn(),
    requireUserForAction: vi.fn(),
    revalidatePath: vi.fn(),
    getLibrary: vi.fn(),
  }));

const { jobFindFirst, resumeFindFirst, resumeUpdate, txFindFirst, txCreate, txUpdate, eventCreate } =
  vi.hoisted(() => ({
    jobFindFirst: vi.fn(),
    resumeFindFirst: vi.fn(),
    resumeUpdate: vi.fn(),
    txFindFirst: vi.fn(),
    txCreate: vi.fn(),
    txUpdate: vi.fn(),
    eventCreate: vi.fn(),
  }));

vi.mock("next/cache", () => ({ revalidatePath }));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: async (run: (tx: unknown) => Promise<unknown>) =>
      run({
        tailoredResume: {
          findFirst: txFindFirst,
          create: txCreate,
          updateMany: txUpdate,
        },
        jobEvent: { create: eventCreate },
      }),
    job: { findFirst: jobFindFirst },
    tailoredResume: {
      findFirst: resumeFindFirst,
      updateMany: resumeUpdate,
    },
  },
}));

vi.mock("@/features/billing/quota", () => ({ checkQuota }));
vi.mock("@/lib/ai/run", () => ({ runStructured }));
vi.mock("@/lib/auth", () => ({ requireUserForAction }));
vi.mock("@/features/library/queries", () => ({ getLibrary }));

import { Prisma } from "@/generated/prisma/client";
import type { Library } from "@/features/library/types";
import { rateTailoredResume, tailorResume } from "@/features/tailor/actions";
import { TAILOR_STALE_MS, displayedTailorStatus } from "@/features/tailor/status";
import { jobAnalysis } from "./tailor-fixture";

const user = {
  id: "user-1",
  plan: "FREE" as const,
  email: "morgan@example.com",
  role: "USER" as const,
};
const jobId = "11111111-1111-4111-8111-111111111111";
const resumeId = "22222222-2222-4222-8222-222222222222";

function library(): Library {
  return {
    profile: {
      fullName: "Morgan Example",
      headline: "Analyst",
      email: "morgan@example.com",
      phone: null,
      location: null,
      links: [],
      summary: null,
    },
    entries: [
      {
        id: "entry-1",
        kind: "EXPERIENCE",
        title: "Officer",
        organization: "Agency",
        location: null,
        startDate: "2023-11",
        endDate: null,
        isCurrent: true,
        url: null,
        sortOrder: 0,
        bullets: [{ id: "b1", text: "Maintained 14 reports.", sortOrder: 0 }],
      },
      {
        id: "entry-2",
        kind: "EDUCATION",
        title: "B.CS.",
        organization: "Carleton",
        location: null,
        startDate: null,
        endDate: "2023",
        isCurrent: false,
        url: null,
        sortOrder: 0,
        bullets: [],
      },
    ],
    skills: [{ id: "s1", name: "Python", category: "Languages", sortOrder: 0 }],
  };
}

function modelOutput(bullet = "Maintained 14 reports.") {
  return {
    summary: "Analyst with reporting experience.",
    entries: [
      {
        ref: "E1",
        bullets: [{ sourceRefs: ["E1.B1"], text: bullet }],
      },
      { ref: "E2", bullets: [] },
    ],
    skills: [{ category: "Languages", refs: ["S1"] }],
    requirementMatches: [
      {
        requirementId: "r1",
        verdict: "met",
        evidenceRefs: ["S1"],
        note: "Python is listed.",
      },
      {
        requirementId: "r2",
        verdict: "missing",
        evidenceRefs: [],
        note: "No certification is listed.",
      },
    ],
  };
}

function readyJob(rawText = "Paste the full posting here. ".repeat(12)) {
  return {
    id: jobId,
    title: "Analyst",
    company: "Northwind",
    rawText,
    analysisStatus: "READY" as const,
    analysis: jobAnalysis(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  requireUserForAction.mockResolvedValue(user);
  checkQuota.mockResolvedValue({ allowed: true, useBonus: false });
  getLibrary.mockResolvedValue(library());
  jobFindFirst.mockResolvedValue(readyJob());
  txFindFirst.mockImplementation(async (args: { where: { status?: string } }) => {
    if (args.where.status === "PENDING") return null;
    return { version: 1 };
  });
  txCreate.mockResolvedValue({ id: resumeId });
  txUpdate.mockResolvedValue({ count: 1 });
  resumeUpdate.mockResolvedValue({ count: 1 });
  eventCreate.mockResolvedValue({ id: "event-1" });
  runStructured.mockResolvedValue({ ok: true, data: modelOutput() });
});

describe("tailorResume", () => {
  it("saves a ready resume and records the timeline event", async () => {
    checkQuota.mockResolvedValue({ allowed: true, useBonus: true });

    const result = await tailorResume({
      jobId,
      length: 1,
      emphasis: "Bring forward reporting",
    });

    expect(result).toEqual({ ok: true, data: { resumeId } });
    const pendingWhere = txFindFirst.mock.calls[0]?.[0].where;
    expect(pendingWhere.status).toBe("PENDING");
    expect(Date.now() - pendingWhere.updatedAt.gt.getTime()).toBeGreaterThan(4 * 60 * 1000);
    expect(Date.now() - pendingWhere.updatedAt.gt.getTime()).toBeLessThan(6 * 60 * 1000);
    expect(txCreate.mock.calls[0]?.[0].data).toMatchObject({
      userId: user.id,
      jobId,
      version: 2,
      status: "PENDING",
      templateId: "classic",
      options: { length: 1, emphasis: "Bring forward reporting" },
    });
    const saved = txUpdate.mock.calls[0]?.[0];
    expect(saved.where).toEqual({ id: resumeId, userId: user.id, status: "PENDING" });
    expect(saved.data.status).toBe("READY");
    expect(saved.data.matchScore).toBe(67);
    expect(saved.data.guardReverts).toBe(0);
    expect(saved.data.error).toBeNull();
    expect(saved.data.content.summary.text).toBe("Analyst with reporting experience.");
    expect(eventCreate).toHaveBeenCalledWith({
      data: { userId: user.id, jobId, type: "RESUME_TAILORED" },
    });
    expect(runStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "TAILOR",
        userId: user.id,
        usedBonusCredit: true,
        refId: resumeId,
      }),
    );
    const prompt = runStructured.mock.calls[0]?.[0].content[0].text as string;
    expect(prompt).toContain("Target length: 1 page (about 450\u2013600 words of content).");
    expect(prompt).toContain("Emphasis from the candidate: Bring forward reporting");
    expect(prompt).toContain("<library>");
    expect(revalidatePath).toHaveBeenCalledWith(`/jobs/${jobId}`);
    expect(revalidatePath).toHaveBeenCalledWith("/jobs");
  });

  it("reverts a new number before saving", async () => {
    runStructured.mockResolvedValue({
      ok: true,
      data: modelOutput("Maintained 99 reports."),
    });

    const result = await tailorResume({ jobId, length: 2 });

    expect(result.ok).toBe(true);
    const saved = txUpdate.mock.calls[0]?.[0].data;
    expect(saved.guardReverts).toBe(1);
    const bullet = saved.content.entries
      .flatMap((entry: { bullets: { text: string; included: boolean }[] }) => entry.bullets)
      .find((item: { text: string; included: boolean }) => item.included);
    expect(bullet.text).toBe("Maintained 14 reports.");
    expect(runStructured.mock.calls[0]?.[0].content[0].text).toContain("Target length: 2 pages.");
    expect(runStructured.mock.calls[0]?.[0].content[0].text).not.toContain("450\u2013600");
  });

  it("returns CONFLICT while a tailor for this job is still running", async () => {
    txFindFirst.mockResolvedValue({ id: "pending-resume" });

    const result = await tailorResume({ jobId, length: 1 });

    expect(result).toEqual({ ok: false, error: { code: "CONFLICT" } });
    expect(txCreate).not.toHaveBeenCalled();
    expect(runStructured).not.toHaveBeenCalled();
  });

  it("marks the version FAILED when the model call fails and does not write content", async () => {
    runStructured.mockResolvedValue({ ok: false, code: "AI_FAILED" });

    const result = await tailorResume({ jobId, length: 1 });

    expect(result).toEqual({ ok: false, error: { code: "AI_FAILED" } });
    expect(resumeUpdate).toHaveBeenCalledWith({
      where: { id: resumeId, userId: user.id, status: "PENDING" },
      data: { status: "FAILED", error: "AI_FAILED" },
    });
    expect(txUpdate).not.toHaveBeenCalled();
    expect(eventCreate).not.toHaveBeenCalled();
  });

  it("stores a refusal code and still returns AI_FAILED", async () => {
    runStructured.mockResolvedValue({ ok: false, code: "AI_REFUSED" });

    const result = await tailorResume({ jobId, length: 1 });

    expect(result).toEqual({ ok: false, error: { code: "AI_FAILED" } });
    expect(resumeUpdate.mock.calls[0]?.[0].data.error).toBe("AI_REFUSED");
  });

  it("does not call the model when the library has no entries or skills", async () => {
    getLibrary.mockResolvedValue({ ...library(), entries: [], skills: [] });

    const result = await tailorResume({ jobId, length: 1 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION");
    expect(checkQuota).not.toHaveBeenCalled();
    expect(runStructured).not.toHaveBeenCalled();
  });

  it("does not call the model when analysis is not ready", async () => {
    jobFindFirst.mockResolvedValue({ ...readyJob(), analysisStatus: "FAILED" });

    const result = await tailorResume({ jobId, length: 1 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.fields?.job?.[0]).toMatch(/analysis/i);
    }
    expect(getLibrary).not.toHaveBeenCalled();
    expect(runStructured).not.toHaveBeenCalled();
  });

  it("returns QUOTA_EXCEEDED before creating a version", async () => {
    checkQuota.mockResolvedValue({ allowed: false, useBonus: false });

    const result = await tailorResume({ jobId, length: 1 });

    expect(result).toEqual({ ok: false, error: { code: "QUOTA_EXCEEDED" } });
    expect(txCreate).not.toHaveBeenCalled();
    expect(runStructured).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND for a job the user does not own", async () => {
    jobFindFirst.mockResolvedValue(null);

    const result = await tailorResume({ jobId, length: 1 });

    expect(result).toEqual({ ok: false, error: { code: "NOT_FOUND" } });
    expect(runStructured).not.toHaveBeenCalled();
  });

  it("returns CONFLICT when the next version number is taken", async () => {
    txCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    const result = await tailorResume({ jobId, length: 1 });

    expect(result).toEqual({ ok: false, error: { code: "CONFLICT" } });
    expect(runStructured).not.toHaveBeenCalled();
  });
});

describe("rateTailoredResume", () => {
  it("clears the rating when the same choice is sent again", async () => {
    resumeFindFirst.mockResolvedValue({
      id: resumeId,
      jobId,
      rating: 1,
    });

    const result = await rateTailoredResume({ resumeId, rating: 1 });

    expect(result).toEqual({ ok: true, data: { rating: null } });
    expect(resumeUpdate).toHaveBeenCalledWith({
      where: { id: resumeId, userId: user.id },
      data: { rating: null, ratingReason: null },
    });
  });

  it("stores not helpful on a ready resume", async () => {
    resumeFindFirst.mockResolvedValue({ id: resumeId, jobId, rating: null });

    const result = await rateTailoredResume({ resumeId, rating: -1 });

    expect(result).toEqual({ ok: true, data: { rating: -1 } });
    expect(resumeUpdate.mock.calls[0]?.[0].data.rating).toBe(-1);
  });

  it("returns NOT_FOUND when the resume is missing", async () => {
    resumeFindFirst.mockResolvedValue(null);

    const result = await rateTailoredResume({ resumeId, rating: 1 });

    expect(result).toEqual({ ok: false, error: { code: "NOT_FOUND" } });
    expect(resumeUpdate).not.toHaveBeenCalled();
  });
});

describe("displayedTailorStatus", () => {
  const now = new Date("2026-10-20T12:00:00.000Z");

  it("treats a pending resume older than 5 minutes as failed", () => {
    expect(
      displayedTailorStatus("PENDING", new Date(now.getTime() - TAILOR_STALE_MS), now),
    ).toBe("FAILED");
    expect(
      displayedTailorStatus(
        "PENDING",
        new Date(now.getTime() - TAILOR_STALE_MS + 1),
        now,
      ),
    ).toBe("PENDING");
    expect(displayedTailorStatus("READY", new Date(now.getTime() - TAILOR_STALE_MS), now)).toBe(
      "READY",
    );
  });
});
