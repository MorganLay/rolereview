# 02 — User Flows & Screens

> Every app screen: what it shows, what you can do, and how it behaves when empty, loading, or failing. Marketing pages are specified in `09-MARKETING.md`. When building a screen in Cursor, point the agent at its section here. Release tags: **[1.0]** default, **[1.1]**, **[1.2]**.

## Site map

```
Public (see 09-MARKETING.md)
  /  /pricing  /demo  /about  /changelog  /privacy  /terms  /waitlist
  /tools/ats-keyword-checker  /tools/bullet-strength
  /guides/[slug] [1.1]  /for/[audience] [1.1]  /compare/[competitor] [1.1]
  /sign-in      /auth/callback (route handler)

Signed in — protected by src/proxy.ts AND requireUser() in the (app) layout
  /dashboard                                        Dashboard: today, pipeline, onboarding
  /library                                   Library editor (+ strength, health)
  /library/import                            Import resume → review → save
  /library/targets [1.1]                    TargetProfiles
  /jobs                                      Jobs board: list until T8.1, then board (default) or list (?view=list)
  /jobs/new                                  Paste a posting
  /jobs/[jobId]                            Job detail (tabs)
  /jobs/[jobId]/resumes/[resumeId]           Resume resume workspace
  /jobs/[jobId]/letters/[letterId]         Cover letter workspace
  /jobs/[jobId]/prep/[prepKitId] [1.1]     Interview prep kit
  /contacts                                    All contacts
  /insights                                     Analytics
  /milestones [1.1]                          Momentum streak + milestones
  /settings                                    Tabs: Profile · Preferences · Plan & billing · Invite [1.1] · Data
  /admin [1.1]                                 Admin only (role = ADMIN)
```

## App shell

- **Sidebar** (top bar + menu on mobile): Dashboard · Library · Jobs board · Contacts · Insights · Settings. Bottom: Usage pill ("2 / 3 tailored resumes") → Settings → Plan; [1.1] XP bar and level.
- **Header:** global "New job" button; 🔔 reminders bell with the due-today count (popover list with complete/snooze); user menu (email, Invite friends [1.1], Sign out).
- **Global:** toaster; Upgrade modal (opened by any `QUOTA_EXCEEDED` or Pro-only action); Feedback button (bottom-right, opens a small form → `Feedback`); [1.1] milestone toast.

## Flow A — first-time user (activation)

1. Homepage CTA → `/sign-in?next=/library/import` → magic link or Google → `/auth/callback` (session only) → first app load `requireUser()` creates the User (stores `signupSource`, `utm*`, `signupReferrer` from the first-touch cookie; `timezone` from the browser via `setTimezone`).
2. Lands on `/library/import` with a one-line welcome: "Let's start by building your experience library."
3. After saving the import → `/dashboard` shows the **Getting started** checklist (4 steps, computed from data):
   1. Build your library (≥ 1 entry)
   2. Accept a job (≥ 1 job)
   3. Tailor your resume (≥ 1 READY tailored resume)
   4. Export it (any tailored resume with `exportedAt`)
   Completing all four sets `onboardingCompletedAt`, shows a brief success message, and [1.1] unlocks the "First tailored resume" milestone.

## Flow B — daily use

Dashboard ("what needs me today?") → complete a reminder or log a follow-up → paste a new posting → tailor a resume → tweak → export → drag the card to Applied (auto follow-up reminder) → later log an interview (auto prep and thank-you reminders) → record the offer → Accepted 🎉.

---

## Screen specs

### `/dashboard` — Dashboard
- **New user:** First job line checklist (above) + a short "How RoleRefine works" card.
- **Returning user** (top to bottom):
  1. **Today:** due/overdue reminders (complete ✓ / snooze 1 day / open job) and interviews in the next 48 h.
  2. **Nudges:** jobs Applied for 30+ days with no change ("No response? Mark it or follow up"); deadlines within 3 days; offers with respond-by within 3 days.
  3. **Pipeline snapshot:** count per stage (clickable → board filtered).
  4. **This week:** applications sent, tailored %, responses; [1.1] momentum streak.
  5. **Recent jobs:** 5 most recently updated.
  6. **Library health** (if score < 70%): "3 weak bullets: strengthen them" → `/library`.

### `/library`
- **Profile card** (header data) with an edit dialog: name, headline, email, phone, location, links (≤ 5), default summary.
- **Library health card:** completeness is five checks, 20% each: profile complete (name, headline, location, and summary — phone and links are optional), ≥ 1 Experience entry, ≥ 5 skills, ≥ 3 bullets on every recent role, ≥ 50% of all bullets Good or better (score ≥ 4). A recent role is every current Experience entry; if none is current, it is the single Experience entry with the latest start (`YYYY` ranks before any month in that year, and a later year beats an earlier month). Ties use the lower `sortOrder`, then id. The card lists up to five bullets that are not Excellent, lowest score first, with the tier and the first fix. Zero bullets fails the Good+ check.
- **Sections** in fixed order (Experience, Projects, Education, Certifications, Volunteer, Other). A section with no entries says “None yet.” and offers add. Entry card: title, org, location, dates, URL, bullets. Entry dialog: title, organization, location, URL, start and end as an optional month plus a year (`YYYY-MM` or `YYYY`), and a current checkbox (stores the end as present). Entry actions: edit dialog, delete (confirm), move up/down within the section.
- **Bullets:** inline edit (Enter or blur saves, Esc cancels, 400-character counter). Text is trimmed and required, at most 400 characters. Add, delete without a confirmation dialog, and move up/down. Each bullet shows a **strength meter** (5 marigold segments, one per tier — Weak fills 1, Excellent fills 5 — with the level written beside it: Weak · Fair · Good · Strong · Excellent) and, on hover or keyboard focus, the reasons ("Add a number to reach Good."). [1.1] a "Coach" button opens the bullet coach.
- **Skills:** chips grouped by category (no category last). Add and edit a name (trimmed, required, at most 50 characters) and an optional category (at most 40 characters; blank stores none). Category autocomplete offers this user's categories plus Languages, Frameworks, Tools, Cloud, Data, and Soft skills; a typed category that matches an existing one ignoring case keeps the existing spelling. A name that matches another skill ignoring case is blocked. Delete without a confirmation dialog. Move up/down within the category.
- Header buttons: Import resume · [1.1] TargetProfiles.
- **Empty:** "Your library is empty" → Import a resume (primary) / Add manually.
- Optimistic updates with rollback + toast on failure.

### `/library/import`
Client state machine `upload → reading → review`:
1. **Upload:** drop zone (PDF/DOCX ≤ 5 MB) or "Paste text" tab. Shows imports left this month.
2. **Reading:** staged progress copy, 10–30 s.
3. **Review:** extracted profile, entries, bullets, and skills, all editable, each with a checkbox (default on). Warnings from extraction shown at the top. Long bullets flagged. If the library isn't empty: **Append** (default) or **Replace everything** (confirm).
   "Save to library" → `commitImport` → `/library` (or `/dashboard` during onboarding) with a summary toast.
- Errors: bad file → inline; AI failure → retry or paste text (no charge); quota → upgrade modal; nothing found → message.

### `/library/targets` [1.1]
List + editor: name, target role, default emphasis, preferred entries (checklist), preferred skills. Free: 1 target profile; Pro: unlimited. Picking a target profile on the tailor dialog pre-fills emphasis and guides selection.

### `/jobs` — Jobs board
Toolbar: view toggle **Board | List**, search (company/title), filters (source, work mode, priority ≥, has deadline), "Show archived" toggle, **New job**. The toolbar is shared with the board. Choices live in the URL (`q`, `source`, `workMode`, `priority`, `deadline=1`, `archived=1`, `sort`, `dir`, `view`).

**Board view (default once T8.1 ships)**
- Columns: Saved · Applied · Screening · Interviewing · Offer · Closed (Closed stacks Accepted, Rejected, Withdrawn, No response, each with its own chip).
- Card: company, title, priority stars, match score badge (best READY tailored resume), next reminder or interview date, deadline (red ≤ 3 days), tailored ✓ icon if a tailored resume was submitted.
- Drag between columns → `moveJob({ jobId, toStatus, beforeId?, afterId? })` → runs `applyStatusChange` side effects and fractional `boardOrder`. Moving to Closed asks which closed status (+ optional reason). Keyboard alternative: each card's "Move to…" menu (accessible drag).
- Mobile: one column at a time with a stage picker; "Move to…" menu instead of drag.
- Until the board is built, Board in the toggle keeps the current filters and says the board comes later. `/jobs` opens the list.

**List view** (`?view=list`, and the page until T8.1): sortable table (Company, Title, Status, Priority, Match score, Applied, Last activity, Deadline). Default sort is Last activity, newest first. Click a column to sort; click again to reverse. Status sort follows Saved through Offer, then the closed statuses. Empty match, priority, applied, and deadline cells show an em dash, and those empty values stay at the bottom of a sort. Match score is the highest score on a READY tailored resume. Inline status uses the pipeline; a closed status asks for an optional reason. Checkboxes archive or unarchive the selection without changing status. A deadline on or before three days from today, in the user’s timezone, is marked Soon; an earlier date is marked Past. Show archived includes archived jobs and marks them Archived.

**Empty:** "No jobs yet. Paste a job posting to accept your first job."

**Filters hide every job:** "No jobs match these filters."

### `/jobs/new`
- Posting text (required, 200–30,000 chars), URL (optional), deadline (optional), source (select, optional), priority (stars, optional).
- Submit → `createJob` (saved PENDING → analysis → fields pre-filled from analysis) → `/jobs/[id]`. Analysis typically 3–8 s; on failure the job is saved FAILED with Retry.

### `/jobs/[jobId]` — Job detail
**Header:** title, company, location, status select, priority stars, deadline, URL (new tab), ⋯ menu (Edit details — title, company, location, and URL — Archive/Unarchive, Delete with confirm). Badges: work mode, employment type, salary range, reference #. An archived job keeps its status and shows an Archived badge. Choosing a closed status asks for an optional reason.

**Tabs:**
1. **Overview:** requirements (Must / Nice, kind icons), keywords, collapsible original posting; details form (source, sourceDetail, work mode, employment type, salary, reference #, deadline, notes with save on blur); "Submitted documents" (which tailor and letter were sent; change via select).
2. **Documents:**
   - **Resume tailored resumes:** [Tailor resume] → dialog: length (1/2 pages), emphasis, [1.1] target profile. Disabled with a reason if the library is empty or analysis isn't READY. Tailoring view: staged progress, 20–60 s; polls if the user leaves and returns. Version cards: v#, date, match score, template, 👍/👎, "Submitted" badge, Open.
   - **Cover letters:** [Write cover letter] → dialog: tone, length, recipient name, "Why this company?" (textarea, strongly encouraged with the hint "the AI won't invent reasons for you"), align with tailor v#. Version cards as above.
3. **Interviews:** list by round; add/edit dialog (round, type, date/time with timezone, duration, link/location, interviewers, prep notes); after the date: outcome select + reflection. [1.1] "Generate prep kit" button.
4. **Contacts:** linked contacts with role chips; "Link existing" (search) or "New contact"; "Log outreach" (→ timeline event + `lastContactedAt`).
5. **Timeline:** reverse-chronological events with icons; "Add entry" (type: follow-up sent, call, email, note, other; date; details). Auto events can't be edited, but can be hidden.
6. **Reminders:** open and completed reminders for this job; add custom.
7. **Offer** (visible once status ≥ OFFER or on "Add offer"): base, currency, period, bonus, equity, benefits, start date, respond-by, decision, notes.

### `/jobs/[jobId]/resumes/[resumeId]` — Resume resume workspace
Desktop: editor (~60%) + match panel (~40%). Mobile: tabs (Resume · Match · Export).
- **Toolbar:** ← Job · v2 · save status ("Saving… / Saved 10:42 / Save failed — retry") · Template (Classic / Modern 🔒 / Compact 🔒) · Copy text · Export ▾ (PDF, DOCX 🔒) · Mark as submitted · 👍/👎.
- **Editor:** header from profile (read-only, "Edit profile" link); summary (editable, include toggle); entries with include toggles (title/org/dates read-only, D-14); bullets with edit, include toggle, up/down, ⓘ source popover, "restored original" badge, strength meter; unselected library items appear switched off so they can be toggled in; skills chips (remove; add from library only).
- **Autosave** debounced 1.5 s → `saveResumeContent`.
- **Match panel:** Match score (score + breakdown: ✓ met / ◐ partial / ✗ missing, each with a note and evidence links that scroll to and highlight bullets); **Keyword coverage** (live %, covered and missing chips); "Add to library" on missing requirements (quick-add bullet dialog; suggests re-tailoring).
- **Export:** PDF/DOCX download named `First-Last-Company-Title.pdf`; sets `exportedAt`; first export shows a success modal: "Mark as submitted & move to Applied?" [Yes] [Not yet] + [1.1] referral prompt.

### `/jobs/[jobId]/letters/[letterId]` — Cover letter workspace
Same layout pattern: editor with greeting, paragraphs (edit, include toggle, ⓘ source refs showing library items, "from the posting", or "from your notes"), closing, signature; side panel: requirements this letter addresses, word count, tone. Toolbar: template, copy text, export PDF / DOCX 🔒, mark as submitted, 👍/👎.

### `/jobs/[jobId]/prep/[prepKitId]` [1.1]
Questions grouped by category; each shows why it's asked (linked requirements), a STAR outline with source refs, a "My notes" textarea, and a "Practiced ✓" toggle. Progress bar "8 / 14 practiced". Print-friendly view.

### `/contacts`
Table: name, title, company, email, linked jobs (chips), last contacted. Search; add/edit dialog; delete (unlinks from jobs). Row click → drawer with details, linked jobs, and outreach history (timeline events).

### `/insights` — Analytics
Date range selector (30 d / 90 d / all). Charts follow the definitions in `04-DATA-MODEL.md` → Analytics:
1. KPI tiles: Applied · Response rate · Interview rate · Offers · Median days to response.
2. Funnel chart: Saved → Applied → Responded → Interviewed → Offer.
3. Applications per week (bar), with tailored vs not stacked.
4. **What's working** (Pro; Free sees a blurred preview + upgrade): interview rate by source; by match score band; tailored vs not. Each shows sample size; hidden below 5.
5. [1.1] Activity heatmap and streak history.
- Empty state: "Your Insights fills in as you apply. Move a job to Applied to start."

### `/milestones` [1.1]
Momentum streak (weeks in a row with at least one meaningful action) with a calendar; milestones list (earned with dates, upcoming ones greyed with a hint). Quiet, professional styling, no badges or levels.

### `/settings`
- **Profile:** same fields as the library profile card.
- **Preferences:** timezone; email reminders on/off; weekly digest on/off; marketing emails (CASL consent checkbox; stores timestamp + wording; unticking sets null).
- **Plan & billing:** plan, interval, renewal or cancel date, founding badge; usage bars for every AI kind this period + bonus credits; [Upgrade] (monthly / 90-day choice → Stripe Checkout) or [Manage subscription] (Stripe Portal).
- **Invite** [1.1]: referral link, copy button, status of invites (signed up / activated / converted), credits earned.
- **Data:** "Export my data" (JSON download of all user-owned rows); "Delete account" (type DELETE; cancels Stripe, deletes everything, signs out).

### `/admin` [1.1] (role ADMIN only; `notFound()` for everyone else)
Signups per day (with source), activation funnel, Free→Pro conversion, MRR (from Stripe), AI cost by kind per day (`AiCall.costMicros`), guard reverts average, 👎 rate, latest feedback, testimonial approval queue.

---

## Cross-cutting behaviour

| Situation | Behaviour |
|---|---|
| Signed out on an app route | `proxy.ts` → `/sign-in?next=…` |
| Resource not owned | `notFound()`, a 404 (never 403) |
| Validation error | `{ ok: false, error: { code: "VALIDATION", fields } }` → inline errors |
| Quota exceeded / Pro-only | `QUOTA_EXCEEDED` / `PRO_REQUIRED` → Upgrade modal naming the limit |
| AI failure | `AI_FAILED` → toast with retry; no charge |
| Concurrent generation | `CONFLICT` → "Already tailoring this job…" |
| Slow AI | Staged progress copy; pollable PENDING state survives refresh |
| Unexpected | Toast "Something went wrong."; server logs ids and codes only |

## Accessibility & quality baseline
- Keyboard accessible everywhere, including the board (Move to… menu); visible focus.
- Status never shown by colour alone (icons + text); strength tiers always have text labels.
- `prefers-reduced-motion` respected (progress, count-ups, offer celebration).
- WCAG AA contrast in light and dark themes; works at 375 px.
- Every list has an empty state; every async action has a pending state.
