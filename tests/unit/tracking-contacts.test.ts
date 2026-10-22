import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUserForAction, revalidatePath } = vi.hoisted(() => ({
  requireUserForAction: vi.fn(),
  revalidatePath: vi.fn(),
}));

const {
  userFindFirst,
  jobFindFirst,
  contactFindFirst,
  contactCreate,
  contactUpdateMany,
  jobContactFindFirst,
  jobContactCreate,
  jobEventCreate,
  jobEventFindMany,
} = vi.hoisted(() => ({
  userFindFirst: vi.fn(),
  jobFindFirst: vi.fn(),
  contactFindFirst: vi.fn(),
  contactCreate: vi.fn(),
  contactUpdateMany: vi.fn(),
  jobContactFindFirst: vi.fn(),
  jobContactCreate: vi.fn(),
  jobEventCreate: vi.fn(),
  jobEventFindMany: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/auth", () => ({ requireUserForAction }));
vi.mock("@/lib/db", () => ({
  db: {
    user: { findFirst: userFindFirst },
    $transaction: async (run: (tx: unknown) => Promise<unknown>) =>
      run({
        job: { findFirst: jobFindFirst },
        contact: {
          findFirst: contactFindFirst,
          create: contactCreate,
          updateMany: contactUpdateMany,
        },
        jobContact: { findFirst: jobContactFindFirst, create: jobContactCreate },
        jobEvent: { create: jobEventCreate, findMany: jobEventFindMany },
      }),
  },
}));

import { strings } from "@/copy/strings";
import {
  compareContactNames,
  latestContactedAt,
  matchesContactSearch,
} from "@/features/tracking/contacts";
import {
  createContactSchema,
  createTimelineEventSchema,
  linkJobContactSchema,
} from "@/features/tracking/schemas";
import { createContact, linkJobContact, logOutreach } from "@/features/tracking/actions";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const JOB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CONTACT = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const errors = strings.contacts.errors;
const timelineErrors = strings.jobs.timeline.errors;

function contactFields(partial: Record<string, unknown> = {}) {
  return {
    name: "Ada Lovelace",
    title: "",
    company: "",
    email: "",
    phone: "",
    linkedinUrl: "",
    notes: "",
    ...partial,
  };
}

function timeline(partial: Record<string, unknown> = {}) {
  return {
    jobId: JOB,
    type: "NOTE",
    date: "2026-10-21",
    details: "Sent a note.",
    ...partial,
  };
}

describe("latestContactedAt", () => {
  const older = new Date("2026-01-01T17:00:00.000Z");
  const newer = new Date("2026-06-01T16:00:00.000Z");

  it("is null when there are no follow-ups", () => {
    expect(latestContactedAt([])).toBeNull();
  });

  it("keeps the latest instant and ignores an older one", () => {
    expect(latestContactedAt([older, newer])).toBe(newer);
    expect(latestContactedAt([newer, older])).toBe(newer);
  });

  it("keeps either instant when the times match", () => {
    const same = new Date(newer.getTime());
    expect(latestContactedAt([newer, same])?.toISOString()).toBe(newer.toISOString());
  });
});

describe("matchesContactSearch", () => {
  const person = {
    name: "Ada Lovelace",
    title: "Recruiter",
    company: "Analytical Engines",
    email: "ada@example.com",
  };

  it("matches a blank query and ignores case", () => {
    expect(matchesContactSearch(person, "  ")).toBe(true);
    expect(matchesContactSearch(person, "ADA")).toBe(true);
    expect(matchesContactSearch(person, "engines")).toBe(true);
    expect(matchesContactSearch(person, "ada@example.com")).toBe(true);
  });

  it("misses text that is not a name, title, company, or email", () => {
    expect(matchesContactSearch(person, "hiring manager")).toBe(false);
  });
});

describe("compareContactNames", () => {
  it("sorts names without caring about case, then by id", () => {
    const rows = [
      { name: "bea", id: "b" },
      { name: "Ada", id: "a" },
      { name: "ada", id: "c" },
    ];
    expect([...rows].sort(compareContactNames).map((row) => row.id)).toEqual(["a", "c", "b"]);
  });
});

describe("createContactSchema", () => {
  it("trims the name and stores blank text as null", () => {
    const parsed = createContactSchema.safeParse(contactFields({ name: "  Ada Lovelace  " }));
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe("Ada Lovelace");
      expect(parsed.data.title).toBeNull();
      expect(parsed.data.email).toBeNull();
      expect(parsed.data.linkedinUrl).toBeNull();
      expect("userId" in parsed.data).toBe(false);
    }
  });

  it("ignores a userId sent with the contact", () => {
    const parsed = createContactSchema.safeParse(
      contactFields({ userId: "someone-else" }),
    );
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).not.toHaveProperty("userId");
  });

  it("rejects a missing name, a long name, a bad email, and a bare link", () => {
    expect(createContactSchema.safeParse(contactFields({ name: "   " })).success).toBe(false);
    const longName = createContactSchema.safeParse(contactFields({ name: "a".repeat(121) }));
    expect(longName.success).toBe(false);
    if (!longName.success) {
      expect(longName.error.issues.some((issue) => issue.message === errors.nameLength)).toBe(
        true,
      );
    }
    expect(
      createContactSchema.safeParse(contactFields({ name: "a".repeat(120) })).success,
    ).toBe(true);
    const email = createContactSchema.safeParse(contactFields({ email: "not-an-email" }));
    expect(email.success).toBe(false);
    if (!email.success) {
      expect(email.error.issues.some((issue) => issue.message === errors.email)).toBe(true);
    }
    const longEmail = createContactSchema.safeParse(
      contactFields({ email: `${"a".repeat(190)}@example.com` }),
    );
    expect(longEmail.success).toBe(false);
    if (!longEmail.success) {
      expect(longEmail.error.issues.some((issue) => issue.message === errors.emailLength)).toBe(
        true,
      );
    }
    const link = createContactSchema.safeParse(
      contactFields({ linkedinUrl: "linkedin.com/in/ada" }),
    );
    expect(link.success).toBe(false);
    if (!link.success) {
      expect(link.error.issues.some((issue) => issue.message === errors.linkedin)).toBe(true);
    }
    const okLink = createContactSchema.safeParse(
      contactFields({ linkedinUrl: "https://www.linkedin.com/in/ada" }),
    );
    expect(okLink.success).toBe(true);
  });
});

describe("timeline contact", () => {
  it("stores no contact unless the entry is a follow-up", () => {
    const note = createTimelineEventSchema.safeParse(timeline());
    expect(note.success).toBe(true);
    if (note.success) expect(note.data.contactId).toBeNull();

    const withPerson = createTimelineEventSchema.safeParse(
      timeline({ type: "NOTE", contactId: CONTACT }),
    );
    expect(withPerson.success).toBe(false);
    if (!withPerson.success) {
      expect(
        withPerson.error.issues.some((issue) => issue.message === timelineErrors.contactType),
      ).toBe(true);
    }

    const followUp = createTimelineEventSchema.safeParse(
      timeline({ type: "FOLLOW_UP_SENT", contactId: CONTACT }),
    );
    expect(followUp.success).toBe(true);
    if (followUp.success) expect(followUp.data.contactId).toBe(CONTACT);

    const cleared = createTimelineEventSchema.safeParse(
      timeline({ type: "FOLLOW_UP_SENT", contactId: "" }),
    );
    expect(cleared.success).toBe(true);
    if (cleared.success) expect(cleared.data.contactId).toBeNull();
  });

  it("rejects a contact id that is not a uuid", () => {
    const parsed = linkJobContactSchema.safeParse({
      jobId: JOB,
      contactId: "not-a-person",
      role: "RECRUITER",
    });
    expect(parsed.success).toBe(false);
    const timelineParsed = createTimelineEventSchema.safeParse(
      timeline({ type: "FOLLOW_UP_SENT", contactId: "not-a-person" }),
    );
    expect(timelineParsed.success).toBe(false);
    if (!timelineParsed.success) {
      expect(
        timelineParsed.error.issues.some((issue) => issue.message === timelineErrors.contact),
      ).toBe(true);
    }
  });
});

describe("contact actions and ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserForAction.mockResolvedValue({
      id: USER,
      email: "ada@example.com",
      plan: "FREE",
      role: "USER",
    });
    userFindFirst.mockResolvedValue({ timezone: "America/Toronto" });
    jobFindFirst.mockResolvedValue({ id: JOB });
    contactFindFirst.mockResolvedValue({ id: CONTACT });
    jobContactFindFirst.mockResolvedValue(null);
    contactCreate.mockResolvedValue({ id: CONTACT });
    jobContactCreate.mockResolvedValue({});
    jobEventCreate.mockResolvedValue({ id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" });
    jobEventFindMany.mockResolvedValue([]);
    contactUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("does not create a contact when the job is not owned", async () => {
    jobFindFirst.mockResolvedValue(null);
    const result = await createContact(contactFields({ jobId: JOB, role: "RECRUITER" }));
    expect(result).toEqual({ ok: false, error: { code: "NOT_FOUND" } });
    expect(jobFindFirst).toHaveBeenCalledWith({
      where: { id: JOB, userId: USER },
      select: { id: true },
    });
    expect(contactCreate).not.toHaveBeenCalled();
  });

  it("returns not found for a contact id the user does not own and does not link it", async () => {
    contactFindFirst.mockResolvedValue(null);
    const result = await linkJobContact({
      jobId: JOB,
      contactId: CONTACT,
      role: "RECRUITER",
    });
    expect(result).toEqual({ ok: false, error: { code: "NOT_FOUND" } });
    expect(contactFindFirst).toHaveBeenCalledWith({
      where: { id: CONTACT, userId: USER },
      select: { id: true },
    });
    expect(jobContactCreate).not.toHaveBeenCalled();
  });

  it("returns not found when the job is not owned", async () => {
    jobFindFirst.mockResolvedValue(null);
    const result = await linkJobContact({
      jobId: JOB,
      contactId: CONTACT,
      role: "PEER",
    });
    expect(result).toEqual({ ok: false, error: { code: "NOT_FOUND" } });
    expect(contactFindFirst).not.toHaveBeenCalled();
    expect(jobContactCreate).not.toHaveBeenCalled();
  });

  it("refuses a second link for the same person", async () => {
    jobContactFindFirst.mockResolvedValue({ contactId: CONTACT });
    const result = await linkJobContact({
      jobId: JOB,
      contactId: CONTACT,
      role: "OTHER",
    });
    expect(result).toEqual({ ok: false, error: { code: "CONFLICT" } });
    expect(jobContactCreate).not.toHaveBeenCalled();
  });

  it("does not log outreach for a person who is not linked", async () => {
    jobContactFindFirst.mockResolvedValue(null);
    const result = await logOutreach({
      jobId: JOB,
      contactId: CONTACT,
      details: "Asked about the next step.",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION");
      expect(result.error.fields?.contactId?.[0]).toBe(errors.notLinked);
    }
    expect(jobEventCreate).not.toHaveBeenCalled();
  });

  it("does not log outreach when the contact id is not owned", async () => {
    contactFindFirst.mockResolvedValue(null);
    const result = await logOutreach({
      jobId: JOB,
      contactId: CONTACT,
      details: "Asked about the next step.",
    });
    expect(result).toEqual({ ok: false, error: { code: "NOT_FOUND" } });
    expect(contactFindFirst).toHaveBeenCalledWith({
      where: { id: CONTACT, userId: USER },
      select: { id: true },
    });
    expect(jobEventCreate).not.toHaveBeenCalled();
  });
});
