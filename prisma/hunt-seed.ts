/**
 * Dev-only jobs, tracking rows, and two READY resumes for SEED_USER_ID.
 * Re-running replaces that user's jobs and contacts. No model call.
 * Dates come from `seed-clock.ts`, so Today, the nudges, and this week stay filled in.
 */

import { strings } from "../src/copy/strings";
import { deadlineReminderTitle } from "../src/features/tracking/reminders";
import { Prisma, PrismaClient } from "../src/generated/prisma/client";
import { JobAnalysis } from "../src/features/jobs/schemas";
import { ProfileLinks, type LibrarySnapshot } from "../src/features/library/schemas";
import { serializeLibrary } from "../src/features/library/serialize";
import type { Library } from "../src/features/library/types";
import { assembleResumeContent } from "../src/features/tailor/assemble";
import {
  MatchReport,
  ResumeContent,
  type ValidatedTailorOutput,
} from "../src/features/tailor/schemas";

import { seedClock, type SeedClock } from "./seed-clock";

const reminderCopy = strings.jobs.reminder;

type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

type ResumeBundle = {
  snapshot: LibrarySnapshot;
  content: Prisma.InputJsonValue;
  output: Prisma.InputJsonValue;
  report: (score: number) => Prisma.InputJsonValue;
};

export async function replaceHunt(prisma: PrismaClient, userId: string) {
  try {
    return await writeHunt(prisma, userId);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2028") {
      return writeHunt(prisma, userId);
    }
    throw error;
  }
}

async function writeHunt(prisma: PrismaClient, userId: string) {
  return prisma.$transaction(
    async (tx) => {
      const owner = await tx.user.findFirst({
        where: { id: userId },
        select: {
          email: true,
          fullName: true,
          headline: true,
          phone: true,
          location: true,
          summary: true,
          links: true,
          timezone: true,
        },
      });
      if (!owner) throw new Error("Seed user is missing.");

      const timeZone = owner.timezone || "America/Toronto";
      const now = new Date();
      const clock = seedClock(now, timeZone);
      const bundle = await resumeBundle(tx, userId, owner, now.toISOString());

      await tx.job.updateMany({
        where: { userId },
        data: { submittedResumeId: null, submittedCoverLetterId: null },
      });
      await tx.job.deleteMany({ where: { userId } });
      await tx.contact.deleteMany({ where: { userId } });
      await tx.reminder.deleteMany({ where: { userId } });

      const mina = await tx.contact.create({
        data: {
          userId,
          name: "Mina Cho",
          title: "Recruiter",
          company: "Harbour Light",
          email: "mina.cho@harbourlight.example",
          lastContactedAt: clock.followUpAt,
        },
      });
      const sam = await tx.contact.create({
        data: {
          userId,
          name: "Sam Patel",
          title: "Hiring manager",
          company: "Civic Studio",
          email: "sam.patel@civicstudio.example",
        },
      });
      const ruth = await tx.contact.create({
        data: {
          userId,
          name: "Ruth Adeyemi",
          title: "Design director",
          company: "Lakeshore Civic",
          email: "ruth.adeyemi@lakeshore.example",
        },
      });
      const chris = await tx.contact.create({
        data: {
          userId,
          name: "Chris Nguyen",
          title: "Product designer",
          company: "North Archive",
          email: "chris.nguyen@northarchive.example",
        },
      });

      await insertSaved(tx, userId, clock, ruth.id);
      await insertStale(tx, userId, clock, chris.id);
      const applied = await insertApplied(tx, userId, clock);
      await insertScreening(tx, userId, clock);
      const interviewing = await insertInterviewing(tx, userId, clock, sam.id);
      await insertOffer(tx, userId, clock, mina.id);
      await insertAccepted(tx, userId, clock);
      await insertRejected(tx, userId, clock);

      const exported = await tx.tailoredResume.create({
        data: {
          ...resumeData(userId, applied.id, bundle, 82, now),
          submittedAt: now,
        },
      });
      await tx.tailoredResume.create({
        data: resumeData(userId, interviewing.id, bundle, 74, null),
      });
      await tx.job.update({
        where: { id: applied.id },
        data: { submittedResumeId: exported.id, updatedAt: clock.updated.applied },
      });
      await tx.jobEvent.create({
        data: {
          userId,
          jobId: applied.id,
          type: "RESUME_TAILORED",
          occurredAt: clock.appliedThisWeek,
        },
      });
      await tx.jobEvent.create({
        data: {
          userId,
          jobId: interviewing.id,
          type: "RESUME_TAILORED",
          occurredAt: clock.updated.interviewing,
        },
      });

      return { jobs: 8, contacts: 4, reminders: 5, interviews: 3, resumes: 2 };
    },
    { maxWait: 10_000, timeout: 30_000 },
  );
}

function resumeData(
  userId: string,
  jobId: string,
  bundle: ResumeBundle,
  score: number,
  exportedAt: Date | null,
) {
  return {
    userId,
    jobId,
    version: 1,
    status: "READY" as const,
    options: { length: 1 },
    librarySnapshot: bundle.snapshot as Prisma.InputJsonValue,
    aiOutput: bundle.output,
    content: bundle.content,
    matchReport: bundle.report(score),
    matchScore: score,
    guardReverts: 0,
    templateId: "classic",
    exportedAt,
  };
}

async function resumeBundle(
  tx: Tx,
  userId: string,
  owner: {
    email: string;
    fullName: string | null;
    headline: string | null;
    phone: string | null;
    location: string | null;
    summary: string | null;
    links: Prisma.JsonValue;
  },
  takenAt: string,
): Promise<ResumeBundle> {
  const [entries, skills] = await Promise.all([
    tx.entry.findMany({
      where: { userId },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      include: { bullets: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } },
    }),
    tx.skill.findMany({
      where: { userId },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    }),
  ]);

  const library: Library = {
    profile: {
      fullName: owner.fullName,
      headline: owner.headline,
      email: owner.email,
      phone: owner.phone,
      location: owner.location,
      links: ProfileLinks.parse(owner.links),
      summary: owner.summary,
    },
    entries: entries.map((entry) => ({
      id: entry.id,
      kind: entry.kind,
      title: entry.title,
      organization: entry.organization,
      location: entry.location,
      startDate: entry.startDate,
      endDate: entry.endDate,
      isCurrent: entry.isCurrent,
      url: entry.url,
      sortOrder: entry.sortOrder,
      bullets: entry.bullets.map((bullet) => ({
        id: bullet.id,
        text: bullet.text,
        sortOrder: bullet.sortOrder,
      })),
    })),
    skills: skills.map((skill) => ({
      id: skill.id,
      name: skill.name,
      category: skill.category,
      sortOrder: skill.sortOrder,
    })),
  };

  const { snapshot } = serializeLibrary(library, takenAt);
  const entry = snapshot.entries.find(
    (item) => item.kind === "EXPERIENCE" && item.bullets.length > 0,
  );
  const bullet = entry?.bullets[0];
  if (!entry || !bullet) {
    throw new Error("Seed library has no experience bullet to tailor from.");
  }

  const groups = new Map<string, { category: string | null; refs: string[] }>();
  for (const skill of snapshot.skills) {
    const key = skill.category ?? "";
    const group = groups.get(key) ?? { category: skill.category, refs: [] };
    group.refs.push(skill.ref);
    groups.set(key, group);
  }

  const validated: ValidatedTailorOutput = {
    summary: (snapshot.profile.summary ?? "").slice(0, 800),
    entries: [
      {
        ref: entry.ref,
        bullets: entry.bullets.slice(0, 3).map((item) => ({
          sourceRefs: [item.ref],
          text: item.text,
          reverted: false,
        })),
      },
    ],
    skills: [...groups.values()].map((group) => ({
      category: group.category,
      refs: group.refs,
    })),
    requirementMatches: [
      {
        requirementId: "r1",
        verdict: "met",
        evidenceRefs: [bullet.ref],
        note: "Shown in the library.",
      },
    ],
  };

  const content = ResumeContent.parse(assembleResumeContent(validated, snapshot));
  return {
    snapshot,
    content: content as Prisma.InputJsonValue,
    output: validated as Prisma.InputJsonValue,
    report: (score: number) =>
      MatchReport.parse({
        verdicts: validated.requirementMatches,
        score,
      }) as Prisma.InputJsonValue,
  };
}

async function insertSaved(tx: Tx, userId: string, clock: SeedClock, contactId: string) {
  return tx.job.create({
    data: {
      ...baseJob(userId, "Lakeshore Civic", "Product Designer", "lakeshore-civic", clock.updated.saved),
      source: "COMPANY_SITE",
      workMode: "HYBRID",
      status: "SAVED",
      priority: 3,
      deadline: clock.deadline,
      events: { create: [created(userId, clock.updated.saved)] },
      reminders: {
        create: {
          userId,
          kind: "DEADLINE",
          title: deadlineReminderTitle("Lakeshore Civic"),
          dueAt: clock.dueToday,
          autoCreated: true,
        },
      },
      contacts: { create: { userId, contactId, role: "REFERRER" } },
    },
  });
}

async function insertStale(tx: Tx, userId: string, clock: SeedClock, contactId: string) {
  return tx.job.create({
    data: {
      ...baseJob(userId, "North Archive", "Design Researcher", "north-archive", clock.updated.stale),
      source: "JOB_BANK",
      workMode: "REMOTE",
      status: "APPLIED",
      priority: 2,
      appliedAt: clock.staleAppliedAt,
      events: {
        create: [
          created(userId, clock.updated.stale),
          statusChanged(userId, "SAVED", "APPLIED", clock.staleAppliedAt),
          { userId, type: "APPLIED" as const, occurredAt: clock.staleAppliedAt },
        ],
      },
      contacts: { create: { userId, contactId, role: "PEER" } },
    },
  });
}

async function insertApplied(tx: Tx, userId: string, clock: SeedClock) {
  return tx.job.create({
    data: {
      ...baseJob(userId, "Bright Path", "Product Designer", "bright-path", clock.updated.applied),
      source: "LINKEDIN",
      workMode: "HYBRID",
      status: "APPLIED",
      priority: 4,
      boardOrder: 1,
      appliedAt: clock.appliedThisWeek,
      events: {
        create: [
          created(userId, clock.appliedThisWeek),
          statusChanged(userId, "SAVED", "APPLIED", clock.appliedThisWeek),
          { userId, type: "APPLIED" as const, occurredAt: clock.appliedThisWeek },
        ],
      },
      reminders: {
        create: {
          userId,
          kind: "FOLLOW_UP",
          title: reminderCopy.followUp,
          dueAt: clock.dueFollowUp,
          autoCreated: true,
        },
      },
    },
  });
}

async function insertScreening(tx: Tx, userId: string, clock: SeedClock) {
  return tx.job.create({
    data: {
      ...baseJob(
        userId,
        "Harbour & Field",
        "UX Designer",
        "harbour-field",
        clock.updated.screening,
      ),
      source: "INDEED",
      workMode: "ONSITE",
      status: "SCREENING",
      priority: 3,
      appliedAt: clock.screeningAppliedAt,
      firstResponseAt: clock.responseThisWeek,
      events: {
        create: [
          created(userId, clock.screeningAppliedAt),
          statusChanged(userId, "SAVED", "APPLIED", clock.screeningAppliedAt),
          { userId, type: "APPLIED" as const, occurredAt: clock.screeningAppliedAt },
          statusChanged(userId, "APPLIED", "SCREENING", clock.responseThisWeek),
          { userId, type: "RESPONSE_RECEIVED" as const, occurredAt: clock.responseThisWeek },
        ],
      },
      interviews: {
        create: { userId, round: 1, kind: "PHONE_SCREEN", outcome: "PENDING" },
      },
      reminders: {
        create: {
          userId,
          kind: "CUSTOM",
          title: "Send the portfolio",
          dueAt: clock.dueLater,
          autoCreated: false,
        },
      },
    },
  });
}

async function insertInterviewing(tx: Tx, userId: string, clock: SeedClock, contactId: string) {
  return tx.job.create({
    data: {
      ...baseJob(
        userId,
        "Civic Studio",
        "Product Designer",
        "civic-studio",
        clock.updated.interviewing,
      ),
      source: "REFERRAL",
      workMode: "HYBRID",
      status: "INTERVIEWING",
      priority: 5,
      appliedAt: daysFrom(clock.staleAppliedAt, 10),
      firstResponseAt: daysFrom(clock.staleAppliedAt, 21),
      events: {
        create: [
          created(userId, clock.updated.interviewing),
          statusChanged(userId, "SCREENING", "INTERVIEWING", clock.interviewPast),
          { userId, type: "INTERVIEW_SCHEDULED" as const, occurredAt: clock.interviewPast },
          { userId, type: "INTERVIEW_COMPLETED" as const, occurredAt: clock.interviewPast },
        ],
      },
      interviews: {
        create: [
          {
            userId,
            round: 1,
            kind: "HIRING_MANAGER",
            scheduledAt: clock.interviewSoon,
            durationMinutes: 45,
            locationOrLink: "https://meet.example/civic-studio",
            interviewers: "Sam Patel",
            outcome: "PENDING",
          },
          {
            userId,
            round: 2,
            kind: "PANEL",
            scheduledAt: clock.interviewPast,
            durationMinutes: 60,
            locationOrLink: "Civic Studio, Toronto",
            interviewers: "Sam Patel",
            outcome: "ADVANCED",
            reflection:
              "The portfolio walkthrough landed. A tighter mobile example would help next time.",
          },
        ],
      },
      contacts: { create: { userId, contactId, role: "HIRING_MANAGER" } },
    },
  });
}

async function insertOffer(tx: Tx, userId: string, clock: SeedClock, contactId: string) {
  return tx.job.create({
    data: {
      ...baseJob(
        userId,
        "Harbour Light",
        "Senior Product Designer",
        "harbour-light",
        clock.updated.offer,
      ),
      source: "RECRUITER",
      workMode: "HYBRID",
      status: "OFFER",
      priority: 5,
      salaryMin: 118000,
      salaryMax: 118000,
      salaryCurrency: "CAD",
      salaryPeriod: "YEAR",
      appliedAt: daysFrom(clock.staleAppliedAt, 13),
      firstResponseAt: daysFrom(clock.staleAppliedAt, 23),
      events: {
        create: [
          created(userId, clock.updated.offer),
          statusChanged(userId, "INTERVIEWING", "OFFER", clock.updated.offer),
          { userId, type: "OFFER_RECEIVED" as const, occurredAt: clock.updated.offer },
          {
            userId,
            type: "FOLLOW_UP_SENT" as const,
            occurredAt: clock.followUpAt,
            contactId,
            details: "Asked Mina about the respond-by date.",
          },
        ],
      },
      reminders: {
        create: {
          userId,
          kind: "OFFER_RESPONSE",
          title: reminderCopy.offerResponse,
          dueAt: clock.dueToday,
          autoCreated: true,
        },
      },
      offer: {
        create: {
          userId,
          baseSalary: 118000,
          currency: "CAD",
          payPeriod: "YEAR",
          bonus: "10% target",
          benefits: "Health, dental, and 4 weeks of vacation.",
          respondBy: clock.respondBy,
          decision: "PENDING",
        },
      },
      contacts: { create: { userId, contactId, role: "RECRUITER" } },
    },
  });
}

async function insertAccepted(tx: Tx, userId: string, clock: SeedClock) {
  return tx.job.create({
    data: {
      ...baseJob(userId, "Maple Goods", "Design Lead", "maple-goods", clock.updated.accepted),
      source: "COMPANY_SITE",
      workMode: "ONSITE",
      status: "ACCEPTED",
      appliedAt: daysFrom(clock.staleAppliedAt, -14),
      firstResponseAt: daysFrom(clock.staleAppliedAt, 6),
      closedAt: clock.updated.accepted,
      events: {
        create: [
          created(userId, clock.updated.accepted),
          statusChanged(userId, "OFFER", "ACCEPTED", clock.updated.accepted),
        ],
      },
    },
  });
}

async function insertRejected(tx: Tx, userId: string, clock: SeedClock) {
  return tx.job.create({
    data: {
      ...baseJob(userId, "Paper North", "UX Researcher", "paper-north", clock.updated.rejected),
      source: "OTHER",
      sourceDetail: "Design Slack",
      workMode: "REMOTE",
      status: "REJECTED",
      appliedAt: daysFrom(clock.staleAppliedAt, 1),
      firstResponseAt: daysFrom(clock.staleAppliedAt, 19),
      closedAt: clock.updated.rejected,
      closeReason: "The role was filled.",
      events: {
        create: [
          created(userId, clock.updated.rejected),
          statusChanged(userId, "SCREENING", "REJECTED", clock.updated.rejected),
        ],
      },
      reminders: {
        create: {
          userId,
          kind: "CUSTOM",
          title: "Review the note",
          dueAt: clock.completedAt,
          completedAt: clock.completedAt,
          autoCreated: false,
        },
      },
    },
  });
}

function baseJob(userId: string, company: string, title: string, slug: string, updatedAt: Date) {
  const text = posting(company, title);
  if (text.length < 200) {
    throw new Error("Seed posting is shorter than 200 characters.");
  }
  return {
    userId,
    title,
    company,
    location: "Toronto, ON",
    url: `https://jobs.example/${slug}`,
    rawText: text,
    analysis: analysis(company, title),
    analysisStatus: "READY" as const,
    employmentType: "FULL_TIME" as const,
    boardOrder: 0,
    createdAt: updatedAt,
    updatedAt,
  };
}

function posting(company: string, title: string): string {
  return `${company} is hiring a ${title} to shape services used by residents and the staff who run them. The work is pairing with engineers, writing interface specs, and testing flows with the people who rely on them. The team shares research with partners who are not designers. This posting is sample data for local development and is not a real opening.`;
}

function analysis(company: string, title: string): Prisma.InputJsonValue {
  return JobAnalysis.parse({
    title,
    company,
    location: "Toronto, ON",
    seniority: "mid",
    workMode: "HYBRID",
    employmentType: "FULL_TIME",
    salary: { min: 90000, max: 120000, currency: "CAD", period: "YEAR" },
    referenceNumber: null,
    summary: "Shape public-facing services and the tools staff use to run them.",
    requirements: [
      {
        id: "r1",
        text: "Shipped product design with engineers and researchers",
        kind: "experience",
        importance: "must",
      },
      {
        id: "r2",
        text: "Comfortable working in React",
        kind: "skill",
        importance: "nice",
      },
    ],
    keywords: ["design", "react", "research"],
  }) as Prisma.InputJsonValue;
}

function created(userId: string, occurredAt: Date) {
  return { userId, type: "CREATED" as const, occurredAt };
}

function statusChanged(
  userId: string,
  fromStatus: "SAVED" | "APPLIED" | "SCREENING" | "INTERVIEWING" | "OFFER",
  toStatus: "APPLIED" | "SCREENING" | "INTERVIEWING" | "OFFER" | "ACCEPTED" | "REJECTED",
  occurredAt: Date,
) {
  return { userId, type: "STATUS_CHANGED" as const, fromStatus, toStatus, occurredAt };
}

/** Whole days after the stale application instant. Negative moves earlier. */
function daysFrom(staleAppliedAt: Date, daysAfterStale: number): Date {
  return new Date(staleAppliedAt.getTime() + daysAfterStale * 24 * 60 * 60 * 1000);
}
