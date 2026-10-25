import { beforeEach, describe, expect, it, vi } from "vitest";

import { strings } from "@/copy/strings";
import type { JobStatus } from "@/generated/prisma/enums";

const { transaction, jobFindFirst, jobUpdateMany, jobEventCreate, reminderCreate, reminderUpdateMany, resumeFindFirst, resumeUpdateMany } =
  vi.hoisted(() => ({
    transaction: vi.fn(),
    jobFindFirst: vi.fn(),
    jobUpdateMany: vi.fn(),
    jobEventCreate: vi.fn(),
    reminderCreate: vi.fn(),
    reminderUpdateMany: vi.fn(),
    resumeFindFirst: vi.fn(),
    resumeUpdateMany: vi.fn(),
  }));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: async (run: (tx: unknown) => Promise<unknown>) => {
      transaction();
      return run({
        job: { findFirst: jobFindFirst, updateMany: jobUpdateMany },
        jobEvent: { create: jobEventCreate },
        reminder: { create: reminderCreate, updateMany: reminderUpdateMany },
        tailoredResume: { findFirst: resumeFindFirst, updateMany: resumeUpdateMany },
      });
    },
  },
}));

import {
  applyStatusChange,
  planStatusChange,
  type PipelineJob,
} from "@/features/jobs/pipeline";

const NOW = new Date("2026-04-10T15:00:00.000Z");
const WEEK = 7 * 24 * 60 * 60 * 1000;
const APPLIED_AT = new Date("2026-04-01T12:00:00.000Z");
const RESPONSE_AT = new Date("2026-04-05T12:00:00.000Z");
const CLOSED_AT = new Date("2026-04-08T12:00:00.000Z");
const userId = "user-1";
const jobId = "11111111-1111-4111-8111-111111111111";

const STATUSES = [
  "SAVED",
  "APPLIED",
  "SCREENING",
  "INTERVIEWING",
  "OFFER",
  "ACCEPTED",
  "REJECTED",
  "WITHDRAWN",
  "NO_RESPONSE",
] as const satisfies readonly JobStatus[];

function job(partial: Partial<PipelineJob> = {}): PipelineJob {
  return {
    status: "SAVED",
    appliedAt: null,
    firstResponseAt: null,
    closedAt: null,
    submittedResumeId: null,
    ...partial,
  };
}

function appliedJob(partial: Partial<PipelineJob> = {}): PipelineJob {
  return job({ status: "APPLIED", appliedAt: APPLIED_AT, ...partial });
}

describe("planStatusChange", () => {
  it.each(STATUSES)("staying on %s writes nothing", (status) => {
    expect(
      planStatusChange(
        job({
          status,
          appliedAt: APPLIED_AT,
          firstResponseAt: RESPONSE_AT,
          closedAt: CLOSED_AT,
        }),
        status,
        { now: NOW, closeReason: "ignored" },
      ),
    ).toEqual({ changed: false });
  });

  it("records the first move to APPLIED", () => {
    expect(planStatusChange(job(), "APPLIED", { now: NOW })).toEqual({
      changed: true,
      patch: { status: "APPLIED", appliedAt: NOW },
      events: [
        { type: "STATUS_CHANGED", fromStatus: "SAVED", toStatus: "APPLIED" },
        { type: "APPLIED" },
      ],
      followUpDueAt: new Date(NOW.getTime() + WEEK),
      completeAutoFollowUps: false,
      dismissOpenReminders: false,
      selectSubmittedResume: true,
    });
  });

  it("uses exactly 7×24 hours for the follow-up across a daylight-saving jump", () => {
    const spring = new Date("2026-03-08T06:30:00.000Z");
    const plan = planStatusChange(job(), "APPLIED", { now: spring });
    expect(plan.changed && plan.followUpDueAt?.toISOString()).toBe(
      "2026-03-15T06:30:00.000Z",
    );
  });

  it("does not look up a resume when one is already submitted", () => {
    const plan = planStatusChange(
      job({ submittedResumeId: "resume-9" }),
      "APPLIED",
      { now: NOW },
    );
    expect(plan.changed && plan.selectSubmittedResume).toBe(false);
    expect(plan.changed && plan.patch.appliedAt).toEqual(NOW);
  });

  it("does not set appliedAt or another follow-up when returning to APPLIED", () => {
    expect(
      planStatusChange(
        job({
          status: "SCREENING",
          appliedAt: APPLIED_AT,
          firstResponseAt: RESPONSE_AT,
          submittedResumeId: null,
        }),
        "APPLIED",
        { now: NOW },
      ),
    ).toEqual({
      changed: true,
      patch: { status: "APPLIED" },
      events: [
        {
          type: "STATUS_CHANGED",
          fromStatus: "SCREENING",
          toStatus: "APPLIED",
        },
      ],
      followUpDueAt: null,
      completeAutoFollowUps: false,
      dismissOpenReminders: false,
      selectSubmittedResume: false,
    });
  });

  it("leaves appliedAt alone when it was already stored before the first APPLIED status", () => {
    const plan = planStatusChange(job({ appliedAt: APPLIED_AT }), "APPLIED", {
      now: NOW,
    });
    expect(plan.changed && plan.patch).toEqual({ status: "APPLIED" });
    expect(plan.changed && plan.followUpDueAt).toBeNull();
    expect(plan.changed && plan.selectSubmittedResume).toBe(false);
  });

  it.each(["SCREENING", "INTERVIEWING", "OFFER"] as const)(
    "first leave from APPLIED to %s records the response and completes the follow-up",
    (toStatus) => {
      expect(planStatusChange(appliedJob(), toStatus, { now: NOW })).toEqual({
        changed: true,
        patch: { status: toStatus, firstResponseAt: NOW },
        events: [
          { type: "STATUS_CHANGED", fromStatus: "APPLIED", toStatus },
          { type: "RESPONSE_RECEIVED" },
        ],
        followUpDueAt: null,
        completeAutoFollowUps: true,
        dismissOpenReminders: false,
        selectSubmittedResume: false,
      });
    },
  );

  it("treats APPLIED to REJECTED as both a response and a close", () => {
    expect(planStatusChange(appliedJob(), "REJECTED", { now: NOW })).toEqual({
      changed: true,
      patch: {
        status: "REJECTED",
        firstResponseAt: NOW,
        closedAt: NOW,
      },
      events: [
        {
          type: "STATUS_CHANGED",
          fromStatus: "APPLIED",
          toStatus: "REJECTED",
        },
        { type: "RESPONSE_RECEIVED" },
      ],
      followUpDueAt: null,
      completeAutoFollowUps: true,
      dismissOpenReminders: true,
      selectSubmittedResume: false,
    });
  });

  it.each(["ACCEPTED", "WITHDRAWN", "NO_RESPONSE"] as const)(
    "APPLIED to %s closes without counting a response",
    (toStatus) => {
      expect(planStatusChange(appliedJob(), toStatus, { now: NOW })).toEqual({
        changed: true,
        patch: { status: toStatus, closedAt: NOW },
        events: [
          { type: "STATUS_CHANGED", fromStatus: "APPLIED", toStatus },
        ],
        followUpDueAt: null,
        completeAutoFollowUps: false,
        dismissOpenReminders: true,
        selectSubmittedResume: false,
      });
    },
  );

  it("does not record a response when the job never left APPLIED", () => {
    const plan = planStatusChange(job(), "INTERVIEWING", { now: NOW });
    expect(plan.changed && plan.patch).toEqual({ status: "INTERVIEWING" });
    expect(plan.changed && plan.events).toEqual([
      {
        type: "STATUS_CHANGED",
        fromStatus: "SAVED",
        toStatus: "INTERVIEWING",
      },
    ]);
    expect(plan.changed && plan.completeAutoFollowUps).toBe(false);
  });

  it("closes from SAVED without a response date", () => {
    expect(planStatusChange(job(), "REJECTED", { now: NOW })).toEqual({
      changed: true,
      patch: { status: "REJECTED", closedAt: NOW },
      events: [
        { type: "STATUS_CHANGED", fromStatus: "SAVED", toStatus: "REJECTED" },
      ],
      followUpDueAt: null,
      completeAutoFollowUps: false,
      dismissOpenReminders: true,
      selectSubmittedResume: false,
    });
  });

  it("closes from SCREENING without treating it as the first response", () => {
    const plan = planStatusChange(
      job({
        status: "SCREENING",
        appliedAt: APPLIED_AT,
        firstResponseAt: RESPONSE_AT,
      }),
      "REJECTED",
      { now: NOW },
    );
    expect(plan.changed && plan.patch).toEqual({
      status: "REJECTED",
      closedAt: NOW,
    });
    expect(plan.changed && plan.completeAutoFollowUps).toBe(false);
    expect(plan.changed && plan.dismissOpenReminders).toBe(true);
  });

  it("does not repeat the response when firstResponseAt is already set", () => {
    const plan = planStatusChange(
      appliedJob({ firstResponseAt: RESPONSE_AT }),
      "SCREENING",
      { now: NOW },
    );
    expect(plan.changed && plan.patch).toEqual({ status: "SCREENING" });
    expect(plan.changed && plan.events.map((event) => event.type)).toEqual([
      "STATUS_CHANGED",
    ]);
    expect(plan.changed && plan.completeAutoFollowUps).toBe(false);
  });

  it("does not overwrite closedAt on a later close", () => {
    const plan = planStatusChange(
      job({ status: "REJECTED", closedAt: CLOSED_AT, appliedAt: APPLIED_AT }),
      "WITHDRAWN",
      { now: NOW },
    );
    expect(plan.changed && plan.patch).toEqual({ status: "WITHDRAWN" });
    expect(plan.changed && plan.dismissOpenReminders).toBe(true);
  });

  it("stores a trimmed close reason only when closing", () => {
    const closed = planStatusChange(appliedJob(), "WITHDRAWN", {
      now: NOW,
      closeReason: "  Took another offer  ",
    });
    expect(closed.changed && closed.patch.closeReason).toBe(
      "Took another offer",
    );

    const blank = planStatusChange(appliedJob(), "WITHDRAWN", {
      now: NOW,
      closeReason: "   ",
    });
    expect(blank.changed && blank.patch.closeReason).toBeNull();

    const open = planStatusChange(job(), "SCREENING", {
      now: NOW,
      closeReason: "not a close",
    });
    expect(open.changed && open.patch).toEqual({ status: "SCREENING" });
  });

  it("moving backward does not clear applied or response dates", () => {
    const plan = planStatusChange(
      job({
        status: "OFFER",
        appliedAt: APPLIED_AT,
        firstResponseAt: RESPONSE_AT,
      }),
      "SAVED",
      { now: NOW },
    );
    expect(plan.changed && plan.patch).toEqual({ status: "SAVED" });
    expect(plan.changed && plan.dismissOpenReminders).toBe(false);
  });
});

describe("applyStatusChange", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    jobFindFirst.mockResolvedValue(job());
    jobUpdateMany.mockResolvedValue({ count: 1 });
    jobEventCreate.mockResolvedValue({ id: "event-1" });
    reminderCreate.mockResolvedValue({ id: "reminder-1" });
    reminderUpdateMany.mockResolvedValue({ count: 1 });
    resumeFindFirst.mockResolvedValue(null);
    resumeUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("returns null when the job is not owned", async () => {
    jobFindFirst.mockResolvedValue(null);
    await expect(applyStatusChange(userId, jobId, "APPLIED", { now: NOW })).resolves.toBeNull();
    expect(jobFindFirst).toHaveBeenCalledWith({
      where: { id: jobId, userId },
      select: {
        status: true,
        appliedAt: true,
        firstResponseAt: true,
        closedAt: true,
        submittedResumeId: true,
      },
    });
    expect(jobUpdateMany).not.toHaveBeenCalled();
    expect(jobEventCreate).not.toHaveBeenCalled();
    expect(reminderCreate).not.toHaveBeenCalled();
  });

  it("applying twice does not duplicate the follow-up or overwrite appliedAt", async () => {
    jobFindFirst
      .mockResolvedValueOnce(job())
      .mockResolvedValueOnce(appliedJob({ appliedAt: NOW }));

    const first = await applyStatusChange(userId, jobId, "APPLIED", { now: NOW });
    const second = await applyStatusChange(userId, jobId, "APPLIED", {
      now: new Date("2026-04-20T15:00:00.000Z"),
    });

    expect(first).toEqual({ jobId, status: "APPLIED", changed: true });
    expect(second).toEqual({ jobId, status: "APPLIED", changed: false });
    expect(transaction).toHaveBeenCalledTimes(2);
    expect(reminderCreate).toHaveBeenCalledTimes(1);
    expect(reminderCreate).toHaveBeenCalledWith({
      data: {
        userId,
        jobId,
        kind: "FOLLOW_UP",
        title: strings.jobs.reminder.followUp,
        dueAt: new Date(NOW.getTime() + WEEK),
        autoCreated: true,
      },
    });
    expect(jobUpdateMany).toHaveBeenCalledTimes(1);
    expect(jobUpdateMany.mock.calls[0]?.[0]).toEqual({
      where: { id: jobId, userId },
      data: { status: "APPLIED", appliedAt: NOW },
    });
    expect(jobEventCreate).toHaveBeenCalledTimes(2);
  });

  it("sets submittedResumeId to the resume the query returns", async () => {
    resumeFindFirst.mockResolvedValue({ id: "resume-new" });
    const result = await applyStatusChange(userId, jobId, "APPLIED", {
      now: NOW,
    });

    expect(result).toEqual({ jobId, status: "APPLIED", changed: true });
    expect(resumeFindFirst).toHaveBeenCalledWith({
      where: {
        userId,
        jobId,
        status: "READY",
        exportedAt: { not: null },
      },
      orderBy: [{ exportedAt: "desc" }, { version: "desc" }],
      select: { id: true },
    });
    expect(jobUpdateMany.mock.calls[0]?.[0].data.submittedResumeId).toBe(
      "resume-new",
    );
    expect(resumeUpdateMany).toHaveBeenCalledWith({
      where: { id: "resume-new", userId, submittedAt: null },
      data: { submittedAt: NOW },
    });
  });

  it("leaves submittedResumeId empty when nothing has been exported", async () => {
    await applyStatusChange(userId, jobId, "APPLIED", { now: NOW });
    expect(jobUpdateMany.mock.calls[0]?.[0].data.submittedResumeId).toBeUndefined();
    expect(resumeUpdateMany).not.toHaveBeenCalled();
  });

  it("does not look up a resume when one is already submitted", async () => {
    jobFindFirst.mockResolvedValue(job({ submittedResumeId: "resume-9" }));
    await applyStatusChange(userId, jobId, "APPLIED", { now: NOW });
    expect(resumeFindFirst).not.toHaveBeenCalled();
    expect(jobUpdateMany.mock.calls[0]?.[0].data.submittedResumeId).toBeUndefined();
  });

  it("writes no events when the update matches no row", async () => {
    jobUpdateMany.mockResolvedValue({ count: 0 });
    await expect(
      applyStatusChange(userId, jobId, "APPLIED", { now: NOW }),
    ).resolves.toBeNull();
    expect(jobEventCreate).not.toHaveBeenCalled();
    expect(reminderCreate).not.toHaveBeenCalled();
  });

  it("completes open auto follow-ups when a response is recorded", async () => {
    jobFindFirst.mockResolvedValue(appliedJob());
    await applyStatusChange(userId, jobId, "SCREENING", { now: NOW });

    expect(jobEventCreate.mock.calls.map((call) => call[0].data.type)).toEqual([
      "STATUS_CHANGED",
      "RESPONSE_RECEIVED",
    ]);
    expect(reminderUpdateMany).toHaveBeenCalledTimes(1);
    expect(reminderUpdateMany).toHaveBeenCalledWith({
      where: {
        userId,
        jobId,
        kind: "FOLLOW_UP",
        autoCreated: true,
        completedAt: null,
        dismissedAt: null,
      },
      data: { completedAt: NOW },
    });
    expect(reminderCreate).not.toHaveBeenCalled();
  });

  it("completes the follow-up before dismissing other open reminders on rejection", async () => {
    jobFindFirst.mockResolvedValue(appliedJob());
    await applyStatusChange(userId, jobId, "REJECTED", {
      now: NOW,
      closeReason: "  Not a fit  ",
    });

    expect(reminderUpdateMany.mock.calls.map((call) => call[0])).toEqual([
      {
        where: {
          userId,
          jobId,
          kind: "FOLLOW_UP",
          autoCreated: true,
          completedAt: null,
          dismissedAt: null,
        },
        data: { completedAt: NOW },
      },
      {
        where: {
          userId,
          jobId,
          completedAt: null,
          dismissedAt: null,
        },
        data: { dismissedAt: NOW },
      },
    ]);
    expect(jobUpdateMany.mock.calls[0]?.[0].data).toMatchObject({
      status: "REJECTED",
      firstResponseAt: NOW,
      closedAt: NOW,
      closeReason: "Not a fit",
    });
  });

  it("dismisses open reminders without completing them when the job is accepted", async () => {
    jobFindFirst.mockResolvedValue(appliedJob());
    await applyStatusChange(userId, jobId, "ACCEPTED", { now: NOW });

    expect(reminderUpdateMany).toHaveBeenCalledTimes(1);
    expect(reminderUpdateMany.mock.calls[0]?.[0].data).toEqual({
      dismissedAt: NOW,
    });
    expect(reminderUpdateMany.mock.calls[0]?.[0].where.kind).toBeUndefined();
    expect(jobEventCreate.mock.calls.map((call) => call[0].data.type)).toEqual([
      "STATUS_CHANGED",
    ]);
  });
});
