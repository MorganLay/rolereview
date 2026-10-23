import "server-only";

import { db } from "@/lib/db";

import {
  buildAccountExport,
  type AccountExportCollections,
} from "./export";
import type { AccountPreferences } from "./preferences";

export type { AccountPreferences };

export async function getPreferences(userId: string): Promise<AccountPreferences | null> {
  const row = await db.user.findFirst({
    where: { id: userId },
    select: {
      timezone: true,
      emailRemindersEnabled: true,
      weeklyDigestEnabled: true,
      marketingConsentAt: true,
    },
  });
  if (!row) return null;
  return {
    timezone: row.timezone,
    emailRemindersEnabled: row.emailRemindersEnabled,
    weeklyDigestEnabled: row.weeklyDigestEnabled,
    marketingConsent: row.marketingConsentAt !== null,
  };
}

/** Every row owned by this user, ready to download. Null when the account is gone. */
export async function loadAccountExport(
  userId: string,
  exportedAt: Date,
): Promise<Record<string, unknown> | null> {
  const where = { userId };
  const [
    user,
    entries,
    bullets,
    skills,
    targetProfiles,
    jobs,
    jobEvents,
    interviews,
    contacts,
    jobContacts,
    reminders,
    offers,
    tailoredResumes,
    coverLetters,
    prepKits,
    aiCalls,
    bonusCredits,
    milestones,
    referralsMade,
    referredBy,
    feedback,
    testimonials,
  ] = await Promise.all([
    db.user.findFirst({ where: { id: userId } }),
    db.entry.findMany({ where, orderBy: { id: "asc" } }),
    db.bullet.findMany({ where, orderBy: { id: "asc" } }),
    db.skill.findMany({ where, orderBy: { id: "asc" } }),
    db.targetProfile.findMany({ where, orderBy: { id: "asc" } }),
    db.job.findMany({ where, orderBy: { id: "asc" } }),
    db.jobEvent.findMany({ where, orderBy: { id: "asc" } }),
    db.interview.findMany({ where, orderBy: { id: "asc" } }),
    db.contact.findMany({ where, orderBy: { id: "asc" } }),
    db.jobContact.findMany({ where, orderBy: [{ jobId: "asc" }, { contactId: "asc" }] }),
    db.reminder.findMany({ where, orderBy: { id: "asc" } }),
    db.offer.findMany({ where, orderBy: { id: "asc" } }),
    db.tailoredResume.findMany({ where, orderBy: { id: "asc" } }),
    db.coverLetter.findMany({ where, orderBy: { id: "asc" } }),
    db.prepKit.findMany({ where, orderBy: { id: "asc" } }),
    db.aiCall.findMany({ where, orderBy: { id: "asc" } }),
    db.bonusCredit.findMany({ where, orderBy: { id: "asc" } }),
    db.userMilestone.findMany({ where, orderBy: { key: "asc" } }),
    db.referral.findMany({ where: { referrerId: userId }, orderBy: { id: "asc" } }),
    db.referral.findFirst({ where: { referredUserId: userId } }),
    db.feedback.findMany({ where, orderBy: { id: "asc" } }),
    db.testimonial.findMany({ where, orderBy: { id: "asc" } }),
  ]);
  if (!user) return null;

  const collections: AccountExportCollections = {
    entries,
    bullets,
    skills,
    targetProfiles,
    jobs,
    jobEvents,
    interviews,
    contacts,
    jobContacts,
    reminders,
    offers,
    tailoredResumes,
    coverLetters,
    prepKits,
    aiCalls,
    bonusCredits,
    milestones,
    referralsMade,
    referredBy,
    feedback,
    testimonials,
  };

  return buildAccountExport({ exportedAt, user, collections });
}
