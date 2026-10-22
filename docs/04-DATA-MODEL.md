# 04 — Data Model

> The real schema is `prisma/schema.prisma` (25 tables, validated). This doc explains it, maps every tracking need to a field, defines the **JSON column shapes**, and specifies the **automatic side effects** that keep tracking data accurate without extra typing.
>
> All tables exist from the first migration, even ones first used in Release 1.1/1.2 (marked `R1.1` in the schema). Later releases add features, not data reshaping.

## Entity map

```
User ─┬─ Library:   Entry ── Bullet,  Skill,  TargetProfile(R1.1)
      ├─ Hunt:        Job ─┬─ JobEvent (timeline)
      │                      ├─ Interview ── Reminder
      │                      ├─ JobContact ── Contact
      │                      ├─ Reminder
      │                      ├─ Offer (0..1)
      │                      ├─ TailoredResume (versions) ← resume
      │                      ├─ CoverLetter (versions)  ← letter
      │                      └─ PrepKit (R1.1)          ← interview prep
      ├─ Metering:    AiCall, BonusCredit
      ├─ Momentum:    UserMilestone (R1.1; streaks derived)
      └─ Growth:      Referral (R1.1), Feedback, Testimonial
Not user-owned: StripeEvent, Lead, FreeToolRun, EmailLog
```

All user-owned rows carry `userId` and cascade-delete with the user (feedback and testimonials are kept anonymised: `SetNull`).

## Tracking coverage — "can I track X?"

| You want to track… | Where it lives |
|---|---|
| Every job you're considering | `Job` (title, company, location, url, rawText) |
| Where you found it | `Job.source` (+ `sourceDetail`) |
| Requisition / competition number (GC Jobs etc.) | `Job.referenceNumber` |
| Remote/hybrid/onsite, full-time/contract/co-op | `Job.workMode`, `Job.employmentType` |
| Posted salary range | `Job.salaryMin/Max/Currency/Period` |
| How excited you are about it | `Job.priority` (1–5) |
| Application deadline | `Job.deadline` (+ auto reminder) |
| Stage in the pipeline, board position | `Job.status`, `Job.boardOrder` |
| When you applied / first heard back / closed | `Job.appliedAt`, `firstResponseAt`, `closedAt` (set automatically) |
| Why it closed | `Job.closeReason` |
| Which resume and cover letter you actually sent | `Job.submittedResumeId`, `submittedCoverLetterId` |
| Full history (status changes, follow-ups, calls, emails, notes) | `JobEvent` timeline |
| Interview rounds, type, time, link, interviewers, prep, reflection, outcome | `Interview` |
| People: recruiters, hiring managers, referrers, interviewers | `Contact` + `JobContact.role` |
| Last time you reached out to someone | `Contact.lastContactedAt` |
| Follow-ups, thank-you notes, deadlines, interview day | `Reminder` (manual + automatic) |
| Offer details and your decision | `Offer` |
| Tailored resume versions, match score, keyword fit, quality rating | `TailoredResume` |
| Cover letter versions | `CoverLetter` |
| Interview prep questions and your notes | `PrepKit` |
| Your experience library | `Entry`, `Bullet`, `Skill` |
| Targeting presets | `TargetProfile` |
| AI usage, cost, quota | `AiCall`, `BonusCredit` |
| Milestones, weekly momentum streak | `UserMilestone`; streak derived from `JobEvent` + `TailoredResume` |
| Referrals | `Referral` |
| Where users came from | `User.signupSource/Referrer/utm*`, `Lead.utm*` |
| Marketing consent (CASL) | `User.marketingConsentAt/Text`, `Lead.marketingConsentAt/consentText` |
| Product feedback, testimonials | `Feedback`, `Testimonial` |
| Emails sent (no duplicates) | `EmailLog` |

## Key decisions

| Decision | Reason |
|---|---|
| `User.id` = Supabase auth user id | One identity; row created lazily by `requireUser()`. |
| Profile on `User` | One profile per user. |
| Resume dates are `"YYYY-MM"` / `"YYYY"` strings | Month precision; no fake days or timezones. |
| Generic `Entry` with `kind` | All sections share a shape: one editor, one query. |
| Archive is a timestamp, not a status | Keeps the final stage (e.g., REJECTED) for analytics while hiding the card. |
| `appliedAt`, `firstResponseAt`, `closedAt` on `Job` (plus the timeline) | Analytics queries stay simple and fast; the timeline keeps the full story. |
| `submittedResumeId` / `submittedCoverLetterId` | Lets the Insights answer "do tailored applications get more interviews?" |
| `TailoredResume.librarySnapshot` | Source traceability survives later library edits. |
| `aiOutput` (immutable) vs `content` (editable) | Compare AI output to user edits for evals and prompt tuning. |
| Quotas counted from `AiCall`; bonus credits as a ledger with `remaining` | No counter drift; failures are free; full audit trail. |
| Milestone definitions live in code; streaks are computed | No balance tuning in the DB; nothing to farm. |
| No uploaded files stored | Privacy and simplicity. |
| `Lead` separate from `User` | Waitlist and free-tool emails exist before accounts do. |

## Automatic side effects (implement in the owning action; tested)

These keep the tracking data accurate without the user doing extra work. Put them in `features/jobs/pipeline.ts` (`applyStatusChange()`), called by every action that changes status (board drag, dropdown, list).

| Trigger | Side effects |
|---|---|
| Job created | `JobEvent(CREATED)`; if `deadline` → `Reminder(DEADLINE, dueAt = deadline − 3 days)` |
| Deadline edited | If the date changes, move each open auto `Reminder(DEADLINE)` to the new `deadline − 3 days`, or create that reminder when none is open. Clearing the deadline dismisses those open reminders. Completed or already dismissed reminders stay. |
| Status → `APPLIED` (first time) | set `appliedAt`; `JobEvent(APPLIED)`; `Reminder(FOLLOW_UP, +7 days, autoCreated)`; if no `submittedResumeId` and a READY tailored resume exists → set it to the latest exported tailor (user can change) |
| Status leaves `APPLIED` to SCREENING / INTERVIEWING / OFFER / REJECTED (first time) | set `firstResponseAt`; `JobEvent(RESPONSE_RECEIVED)`; complete any open auto FOLLOW_UP reminder |
| Status → ACCEPTED / REJECTED / WITHDRAWN / NO_RESPONSE | set `closedAt`; dismiss open reminders for the job |
| Any status change | `JobEvent(STATUS_CHANGED, fromStatus, toStatus)` |
| Status → `ACCEPTED` | celebration UI; prompt for testimonial (opt-in); prompt "pause your search?" |
| Interview created with `scheduledAt`, or later given a `scheduledAt` when it has never had one | `JobEvent(INTERVIEW_SCHEDULED)` once; `Reminder(INTERVIEW, scheduledAt − 24h)`. 24h is exactly 24×60×60×1000 ms, including across a daylight-saving change. If an open automatic interview reminder exists, its due time moves; otherwise one is created. Clearing the date dismisses that open reminder and leaves the timeline event. A later date does not write a second scheduled event. If the status is `SAVED`, `APPLIED`, or `SCREENING` → move to `INTERVIEWING` (via `applyStatusChange`) on that first date only. `INTERVIEWING`, `OFFER`, `ACCEPTED`, and the closed statuses stay. |
| Interview outcome leaves `PENDING` the first time | `JobEvent(INTERVIEW_COMPLETED)` once. A later outcome change, including back to Pending and out again, does not write another event. `Reminder(THANK_YOU, now + 2h)` when `scheduledAt` falls on today in the user's timezone. No date, or a date on another local day, skips the thank-you. |
| Interview deleted | Reminders for that interview are removed. Timeline events stay, with `interviewId` cleared. Status stays. |
| Offer created | `JobEvent(OFFER_RECEIVED)`; status → OFFER; if `respondBy` → `Reminder(OFFER_RESPONSE, respondBy − 2 days)` |
| TailoredResume / CoverLetter READY | `JobEvent(RESUME_TAILORED / LETTER_WRITTEN)` |
| Manual "Log follow-up" | `JobEvent(FOLLOW_UP_SENT)`; update `Contact.lastContactedAt` if a contact is chosen |
| APPLIED with no change for 30 days | Dashboard shows a "No response?" nudge (computed in the query, nothing stored until the user acts) |

Status ordering for "less than" comparisons: SAVED < APPLIED < SCREENING < INTERVIEWING < OFFER < ACCEPTED (closed statuses are not ordered).

### Interview fields

Caps for the Interviews tab. Blank text stores null. `scheduledAt` is a UTC instant entered as a wall-clock date and time in `User.timezone` (shown beside the field). A spring-forward gap is rejected. A repeated fall-back hour uses the earlier instant. An interview with no date stores null and does not move the status.

| Field | Max | Blank saves as |
|---|---|---|
| `round` | whole number 1–20 | required; the form suggests the next round |
| `kind` | `InterviewKind` | required |
| `scheduledAt` | real local date and time, years 1900–2099 | null |
| `durationMinutes` | whole number 1–480 | null |
| `locationOrLink` | 500 | null. `http` or `https` renders as a link; anything else is text |
| `interviewers` | 300 | null. Free text until contacts (T8.4) |
| `prepNotes` | 5,000 | null |
| `reflection` | 5,000 | null |
| `outcome` | `InterviewOutcome` | `PENDING` |

Outcome and reflection show in the dialog once `scheduledAt` is in the past, and they stay visible when an outcome other than Pending or a reflection is already saved. The prep-kit button is 1.1. The Reminders tab that lists these rows is T8.5.

### Job detail fields

Caps for the job page. Blank text stores null. Archive is `archivedAt`, not a status.

| Field | Max | Blank saves as |
|---|---|---|
| `title` | 120 | required |
| `company` | 120 | required |
| `location` | 80 | null |
| `url` | 2,000 | null; `http` or `https` only |
| `sourceDetail` | 120 | null |
| `referenceNumber` | 80 | null |
| `notes` | 5,000 | null |
| `closeReason` | 500 | null; stored only when the status select moves into Accepted, Rejected, Withdrawn, or No response |

Salary amounts are whole numbers from 0 through 2,147,483,647. When both are set, the minimum is at most the maximum. Currency is three letters, stored uppercase. Priority is 1–5 or null. Analysis still pre-fills empty classification columns; a value the user has set stays.

## JSON column shapes

Zod schemas live in the files listed; infer TS types with `z.infer`. **Parse on every read** from the DB so bad rows fail loudly. `EntryKindEnum = z.enum(["EXPERIENCE","PROJECT","EDUCATION","CERTIFICATION","VOLUNTEER","OTHER"])`.

### `User.links` → `features/library/schemas.ts`

```ts
export const ProfileLink = z.object({ label: z.string().trim().min(1).max(40), url: z.string().url().max(300) });
export const ProfileLinks = z.array(ProfileLink).max(5);
```

URLs are trimmed and must be `http` or `https`.

Profile text on `User` (the library profile dialog; email is the sign-in address and is not edited here):

| Field | Max | Blank saves as |
|---|---|---|
| `fullName` | 80 | null |
| `headline` | 120 | null |
| `phone` | 40 | null |
| `location` | 80 | null |
| `summary` | 2,000 | null |

`summary` is the default professional summary — source text, not the line that prints on a tailored resume. `ResumeContent.summary` stays capped at 800 characters; tailoring condenses this field onto the page.

### `Entry` → `features/library/schemas.ts`

One shape for every section (`EntryKindEnum`). Caps are validation only; the columns stay plain text.

| Field | Max | Blank saves as |
|---|---|---|
| `title` | 120 | required |
| `organization` | 120 | null |
| `location` | 80 | null |
| `url` | 300 | null; `http` or `https` only |
| `startDate`, `endDate` | — | null, `YYYY`, or `YYYY-MM` (years 1900–2099) |
| `isCurrent` | — | when true, `endDate` is stored null |

A missing month does not invent one: `2019` and `2019-06` in the same year are a valid range. If both dates include a month, the end must be on or after the start. The column is a string, so a later day (`YYYY-MM-DD`) is a validation change, not a migration. New entries append to the end of their section (`sortOrder`); move up/down rewrites that section’s order.

### `Bullet` → `features/library/schemas.ts`

| Field | Max | Blank saves as |
|---|---|---|
| `text` | 400 | required; trimmed. Empty or whitespace is rejected |
| `tags` | — | not edited on the library page; stays `[]` |

New bullets append to the entry (`sortOrder`). Move up/down rewrites that entry’s order. Delete does not ask for confirmation. The text is stored as written: quotes, angle brackets, and SQL-shaped phrases stay in the string. Zod checks the shape before the write, and Prisma sends the value as a parameter. React escapes it when the page renders.

### `Job.analysis` → `features/jobs/schemas.ts`

```ts
export const Requirement = z.object({
  id: z.string(),                                         // "r1"… assigned in code
  text: z.string(),
  kind: z.enum(["skill", "experience", "education", "certification", "other"]),
  importance: z.enum(["must", "nice"]),
});
export const JobAnalysis = z.object({
  title: z.string(), company: z.string(), location: z.string().nullable(),
  seniority: z.enum(["intern", "entry", "mid", "senior", "lead", "unknown"]),
  workMode: z.enum(["ONSITE", "HYBRID", "REMOTE", "UNKNOWN"]),
  employmentType: z.enum(["FULL_TIME","PART_TIME","CONTRACT","TEMPORARY","INTERNSHIP","CO_OP","OTHER"]).nullable(),
  salary: z.object({ min: z.number().nullable(), max: z.number().nullable(),
                     currency: z.string().nullable(), period: z.enum(["HOUR","YEAR"]).nullable() }).nullable(),
  referenceNumber: z.string().nullable(),
  summary: z.string(),
  requirements: z.array(Requirement),
  keywords: z.array(z.string()),
});
```
Analysis pre-fills the Job columns (`workMode`, `employmentType`, `salary*`, `referenceNumber`); the user can override them.

### `TailoredResume.options` / `CoverLetter.options` → `features/tailor/schemas.ts`, `features/letters/schemas.ts`

```ts
export const TailorOptions = z.object({
  length: z.union([z.literal(1), z.literal(2)]).default(1),
  emphasis: z.string().trim().max(200).optional(),
  targetProfileId: z.string().uuid().optional(),               // R1.1
});
export const CoverLetterOptions = z.object({
  tone: z.enum(["professional", "warm", "enthusiastic"]).default("professional"),
  length: z.enum(["short", "standard"]).default("standard"), // ~180 / ~300 words
  recipientName: z.string().max(80).optional(),          // "Dear Ms. Chen"; default "Dear Hiring Manager"
  whyCompany: z.string().max(600).optional(),            // user's own reasons; the ONLY source for company motivation
  resumeId: z.string().uuid().optional(),                 // align with this resume version
});
```

### `*.librarySnapshot` (LibrarySnapshot) → `features/library/schemas.ts`

```ts
export const LibrarySnapshot = z.object({
  takenAt: z.string(),
  profile: z.object({ fullName: z.string().nullable(), headline: z.string().nullable(), email: z.string(),
                      phone: z.string().nullable(), location: z.string().nullable(),
                      links: ProfileLinks, summary: z.string().nullable() }),
  entries: z.array(z.object({
    ref: z.string(), id: z.string(), kind: EntryKindEnum,                 // "E1"
    title: z.string(), organization: z.string().nullable(), location: z.string().nullable(),
    startDate: z.string().nullable(), endDate: z.string().nullable(), isCurrent: z.boolean(),
    url: z.string().nullable(),
    bullets: z.array(z.object({ ref: z.string(), id: z.string(), text: z.string() })),  // "E1.B2"
  })),
  skills: z.array(z.object({ ref: z.string(), id: z.string(), name: z.string(), category: z.string().nullable() })), // "S4"
});
```

### `TailoredResume.content` (ResumeContent) → `features/tailor/schemas.ts`

```ts
export const ContentBullet = z.object({
  id: z.string(), text: z.string().max(400), included: z.boolean(),
  sourceRefs: z.array(z.string()), reverted: z.boolean().default(false), edited: z.boolean().default(false),
});
export const ContentEntry = z.object({
  ref: z.string(),             // title/org/dates come from librarySnapshot — never stored here (D-14)
  kind: EntryKindEnum, included: z.boolean(), bullets: z.array(ContentBullet),
});
export const ResumeContent = z.object({
  schemaVersion: z.literal(1),
  summary: z.object({ text: z.string().max(800), included: z.boolean() }),
  entries: z.array(ContentEntry),
  skills: z.array(z.object({ category: z.string().nullable(), names: z.array(z.string()) })),
});
```
Render order: Summary → Experience → Projects → Education → Certifications → Volunteer → Other → Skills.

### `TailoredResume.matchReport` (MatchReport)

```ts
export const RequirementVerdict = z.object({
  requirementId: z.string(), verdict: z.enum(["met", "partial", "missing"]),
  evidenceRefs: z.array(z.string()), note: z.string().max(200),
});
export const MatchReport = z.object({
  verdicts: z.array(RequirementVerdict),
  score: z.number().int().min(0).max(100).nullable(), // null when the posting has no requirements
});
```

`score` is null when the posting has no requirements. A null score shows as an em dash on the jobs list.

### `CoverLetter.content` (CoverLetterContent) → `features/letters/schemas.ts`

```ts
export const LetterParagraph = z.object({
  id: z.string(), text: z.string().max(1200), included: z.boolean(),
  sourceRefs: z.array(z.string()),       // library refs and/or "POSTING" / "WHY" (user's notes)
  reverted: z.boolean().default(false), edited: z.boolean().default(false),
});
export const CoverLetterContent = z.object({
  schemaVersion: z.literal(1),
  greeting: z.string().max(120),          // "Dear Hiring Manager,"
  paragraphs: z.array(LetterParagraph),   // 3–5
  closing: z.string().max(60),            // "Sincerely,"
  signature: z.string().max(80),          // from profile fullName
});
```

### `PrepKit.content` (PrepKitContent) → `features/prep/schemas.ts` (R1.1)

```ts
export const PrepQuestion = z.object({
  id: z.string(),
  category: z.enum(["behavioural", "technical", "role", "motivation", "company"]),
  question: z.string(),
  whyAsked: z.string(),                   // links to requirement ids where relevant
  requirementIds: z.array(z.string()),
  star: z.object({ situation: z.string(), task: z.string(), action: z.string(), result: z.string() }).nullable(),
  sourceRefs: z.array(z.string()),
  userNotes: z.string().max(2000).default(""),
  practiced: z.boolean().default(false),
});
export const PrepKitContent = z.object({ schemaVersion: z.literal(1), questions: z.array(PrepQuestion) });
```

## Quotas & bonus credits (`features/billing/quota.ts`)

```
period(kind) = UTC calendar month, except ANALYZE = UTC day
used         = count(AiCall where userId, kind, success = true, usedBonusCredit = false, createdAt in period)
allowance    = PLANS[user.plan].limits[kind]
bonus        = sum(BonusCredit.remaining where userId, kind, (expiresAt null or > now))

canUse  = used < allowance  OR  bonus > 0
on success:
  if used < allowance → AiCall(usedBonusCredit = false)
  else → decrement the oldest-expiring BonusCredit with remaining > 0 (same transaction), AiCall(usedBonusCredit = true)
```

Soonest `expiresAt` first. `expiresAt` null (no expiry) is last. The same expiry uses the oldest `createdAt`. `expiresAt` equal to now is already expired. If that credit is gone when the row is written, the successful `AiCall` is still stored with `usedBonusCredit` true so it does not also count against the plan allowance.

## Analytics definitions (Insights; computed by queries, nothing stored)

| Metric | Definition |
|---|---|
| Applied | jobs with `appliedAt` in range |
| Response rate | applied jobs with `firstResponseAt` not null ÷ applied jobs (exclude those applied < 7 days ago) |
| Interview rate | applied jobs with ≥ 1 `Interview` ÷ applied jobs |
| Offer rate | applied jobs that reached OFFER or ACCEPTED (event or status) ÷ applied |
| Median days to response | median(`firstResponseAt − appliedAt`) |
| By source | the above grouped by `source` |
| By match score band | the above grouped by the submitted resume's `matchScore` band (<50, 50–74, 75+) |
| Tailored vs not | grouped by `submittedResumeId` null vs not |
| Weekly activity / streak | per ISO week (user timezone): count of meaningful actions = jobs applied with a submitted resume + FOLLOW_UP_SENT events + interviews logged + prep kits practised. Streak = consecutive weeks with ≥ 1. |

Hide a breakdown until it has at least 5 jobs per group, and label small samples ("based on 7 applications").

## Weak queries → indexes

| Query | Index |
|---|---|
| Library by kind/order | `Entry(userId, kind, sortOrder)`, `Bullet(entryId, sortOrder)` |
| Board columns | `Job(userId, status, boardOrder)` |
| List view / archive filter | `Job(userId, archivedAt, updatedAt)` |
| Insights by applied date | `Job(userId, appliedAt)` |
| Timeline | `JobEvent(jobId, occurredAt)` |
| Today's reminders | `Reminder(userId, completedAt, dueAt)` |
| Upcoming interviews | `Interview(userId, scheduledAt)` |
| Quota counts | `AiCall(userId, kind, success, createdAt)` |
| Bonus credit lookup | `BonusCredit(userId, kind, remaining)` |
| Free-tool rate limit | `FreeToolRun(ipHash, tool, createdAt)` |
| Email de-duplication | `EmailLog(recipientKey, template, refKey)` unique |

## Migrations

1. `init`: `npx prisma migrate dev --name init` (creates all 25 tables).
2. `enable_rls`: `npx prisma migrate dev --create-only --name enable_rls`, paste the SQL below, then `npx prisma migrate dev`:
   ```sql
   DO $$
   DECLARE t text;
   BEGIN
     FOREACH t IN ARRAY ARRAY[
       'User','Entry','Bullet','Skill','TargetProfile','Job','JobEvent','Interview','Contact',
       'JobContact','Reminder','Offer','TailoredResume','CoverLetter','PrepKit','AiCall','BonusCredit',
       'StripeEvent','UserMilestone','Referral','Lead','FreeToolRun','Feedback',
       'Testimonial','EmailLog'
     ] LOOP
       EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
     END LOOP;
   END $$;
   -- No policies on purpose: the Supabase Data API (public key) can read nothing.
   -- Prisma connects as the postgres role, which bypasses RLS.
   ```
   **Every table added later needs the same line in its migration.**
3. Never edit an applied migration.
4. Changing a JSON shape: bump `schemaVersion` and handle old versions on parse, or write a data migration script.

## Seed data (`prisma/seed.ts`, dev only)

Sign in once locally, put your Supabase user id in `SEED_USER_ID`, then the seed creates for that user: a realistic fake library (3 roles, 2 projects, 1 degree, 15 skills, a mix of weak and strong bullets), 8 jobs across all statuses with timeline events, 3 interviews, 4 contacts, 5 reminders (2 due today), 1 offer, and 2 READY tailored resumes built from a stored fixture (no AI calls). This lets you build every screen, including the Insights, without spending money.

T3.6 seeds the library only: profile header, entries, bullets, and skills. Re-running replaces that user's entries, bullets, skills, and profile header fields. Email stays the sign-in address. Jobs and the rest are added in later tasks, starting with the dashboard seed in T8.7.
