import "server-only";

import { connection } from "next/server";

import type { ContactRole } from "@/generated/prisma/enums";
import { calendarDateInTimeZone } from "@/features/jobs/dates";
import { db } from "@/lib/db";

import {
  compareContactNames,
  CONTACT_LIMITS,
  matchesContactSearch,
  type ContactListItem,
  type ContactPick,
  type JobContactView,
} from "./contacts";
import {
  compareTimelineEvents,
  formatEventWhen,
  presentTimelineEvent,
  type TimelineEventView,
} from "./events";
import {
  compareInterviews,
  nextInterviewRound,
  presentInterview,
  type InterviewView,
} from "./interviews";

export type JobTimeline = {
  events: TimelineEventView[];
  today: string;
};

/** Timeline rows for one owned job, newest first. */
export async function listJobTimeline(userId: string, jobId: string): Promise<JobTimeline> {
  await connection();
  const [owner, rows] = await Promise.all([
    db.user.findFirst({
      where: { id: userId },
      select: { timezone: true },
    }),
    db.jobEvent.findMany({
      where: { userId, jobId },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        type: true,
        fromStatus: true,
        toStatus: true,
        details: true,
        occurredAt: true,
        createdAt: true,
        contactId: true,
        contact: { select: { name: true } },
      },
    }),
  ]);

  const timeZone = owner?.timezone || "America/Toronto";
  const ordered = [...rows].sort(compareTimelineEvents);

  return {
    today: calendarDateInTimeZone(new Date(), timeZone),
    events: ordered.map((row) =>
      presentTimelineEvent(
        { ...row, contactName: row.contact?.name ?? null },
        timeZone,
      ),
    ),
  };
}

export type JobInterviews = {
  interviews: InterviewView[];
  timeZone: string;
  now: string;
  nextRound: number;
};

/** Interviews for one owned job, by round then time. */
export async function listJobInterviews(
  userId: string,
  jobId: string,
): Promise<JobInterviews> {
  await connection();
  const now = new Date();
  const [owner, rows] = await Promise.all([
    db.user.findFirst({
      where: { id: userId },
      select: { timezone: true },
    }),
    db.interview.findMany({
      where: { userId, jobId },
      select: {
        id: true,
        round: true,
        kind: true,
        outcome: true,
        scheduledAt: true,
        durationMinutes: true,
        locationOrLink: true,
        interviewers: true,
        prepNotes: true,
        reflection: true,
        createdAt: true,
      },
    }),
  ]);

  const timeZone = owner?.timezone || "America/Toronto";
  const ordered = [...rows].sort(compareInterviews);

  return {
    timeZone,
    now: now.toISOString(),
    nextRound: nextInterviewRound(ordered.map((row) => row.round)),
    interviews: ordered.map((row) => presentInterview(row, timeZone, now)),
  };
}

export type JobContacts = {
  linked: JobContactView[];
  directory: ContactPick[];
};

/** People linked to one job, plus everyone else who can be linked. */
export async function listJobContacts(userId: string, jobId: string): Promise<JobContacts> {
  await connection();
  const [owner, links, people] = await Promise.all([
    db.user.findFirst({
      where: { id: userId },
      select: { timezone: true },
    }),
    db.jobContact.findMany({
      where: { userId, jobId },
      select: {
        role: true,
        contact: {
          select: {
            id: true,
            name: true,
            title: true,
            company: true,
            email: true,
            phone: true,
            linkedinUrl: true,
            notes: true,
            lastContactedAt: true,
          },
        },
      },
    }),
    db.contact.findMany({
      where: { userId },
      select: { id: true, name: true, title: true, company: true },
    }),
  ]);

  const timeZone = owner?.timezone || "America/Toronto";
  const linkedIds = new Set(links.map((link) => link.contact.id));
  const linked = links
    .map((link) => ({
      id: link.contact.id,
      name: link.contact.name,
      title: link.contact.title,
      company: link.contact.company,
      email: link.contact.email,
      phone: link.contact.phone,
      linkedinUrl: link.contact.linkedinUrl,
      notes: link.contact.notes,
      role: link.role,
      lastContactedLabel: contactedLabel(link.contact.lastContactedAt, timeZone),
    }))
    .sort(compareContactNames);
  const directory = people
    .filter((person) => !linkedIds.has(person.id))
    .sort(compareContactNames);

  return { linked, directory };
}

/** Every contact, optionally narrowed by a search string. `total` ignores the search. */
export async function listContacts(
  userId: string,
  query: string,
): Promise<{ contacts: ContactListItem[]; total: number }> {
  await connection();
  const [owner, rows] = await Promise.all([
    db.user.findFirst({
      where: { id: userId },
      select: { timezone: true },
    }),
    db.contact.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        title: true,
        company: true,
        email: true,
        phone: true,
        linkedinUrl: true,
        notes: true,
        lastContactedAt: true,
        jobs: {
          select: {
            role: true,
            job: { select: { id: true, title: true, company: true } },
          },
        },
        events: {
          where: { type: "FOLLOW_UP_SENT" },
          select: {
            id: true,
            jobId: true,
            details: true,
            occurredAt: true,
            createdAt: true,
            job: { select: { title: true, company: true } },
          },
        },
      },
    }),
  ]);

  const timeZone = owner?.timezone || "America/Toronto";
  const ordered = rows
    .map((row) => presentContact(row, timeZone))
    .sort(compareContactNames);
  const needle = query.trim().slice(0, CONTACT_LIMITS.search);

  return {
    total: ordered.length,
    contacts: ordered.filter((contact) => matchesContactSearch(contact, needle)),
  };
}

function contactedLabel(at: Date | null, timeZone: string): string | null {
  if (!at) return null;
  return formatEventWhen(at, timeZone, true);
}

function presentContact(
  row: {
    id: string;
    name: string;
    title: string | null;
    company: string | null;
    email: string | null;
    phone: string | null;
    linkedinUrl: string | null;
    notes: string | null;
    lastContactedAt: Date | null;
    jobs: {
      role: ContactRole;
      job: { id: string; title: string; company: string };
    }[];
    events: {
      id: string;
      jobId: string;
      details: string | null;
      occurredAt: Date;
      createdAt: Date;
      job: { title: string; company: string };
    }[];
  },
  timeZone: string,
): ContactListItem {
  const jobs = [...row.jobs]
    .map((link) => ({
      id: link.job.id,
      title: link.job.title,
      company: link.job.company,
      role: link.role,
    }))
    .sort((a, b) => compareContactNames(
      { name: `${a.company} ${a.title}`, id: a.id },
      { name: `${b.company} ${b.title}`, id: b.id },
    ));
  const outreach = [...row.events].sort(compareTimelineEvents).map((event) => ({
    id: event.id,
    jobId: event.jobId,
    jobLabel: `${event.job.company} · ${event.job.title}`,
    details: event.details,
    whenLabel: formatEventWhen(event.occurredAt, timeZone, true),
    occurredAt: event.occurredAt.toISOString(),
  }));

  return {
    id: row.id,
    name: row.name,
    title: row.title,
    company: row.company,
    email: row.email,
    phone: row.phone,
    linkedinUrl: row.linkedinUrl,
    notes: row.notes,
    lastContactedLabel: contactedLabel(row.lastContactedAt, timeZone),
    jobs,
    outreach,
  };
}
