# Progress

> Updated by the `/finish-task` command (or by hand). `/next-task` starts the first unticked task. Release 1.0 only; 1.1/1.2 tasks get added when 1.0 ships.

Status: `[ ]` not started · `[~]` in progress · `[x]` done


## Phase 0 — Foundation
- [x] **T0.1** Create the project
- [x] **T0.2** UI kit & brand tokens
- [x] **T0.3** Database
- [x] **T0.4** Tests & CI

## Phase 1 — Auth & shell
- [x] **T1.1** Supabase Auth
- [x] **T1.2** requireUser() / requireAdmin()
- [x] **T1.3** App shell

## Phase 2 — Brand & waitlist
- [x] **T2.1** Brand basics
- [x] **T2.2** Waitlist page + launch

## Phase 3 — Library
- [x] **T3.1** Library read + profile
- [x] **T3.2** Entries CRUD
- [x] **T3.3** Bullets
- [x] **T3.4** Skills
- [x] **T3.5** Strength & health
- [x] **T3.6** Seed & empty states

## Phase 4 — Import
- [x] **T4.1** AI plumbing
- [x] **T4.2** Extraction
- [x] **T4.3** Review & commit

## Phase 5 — Jobs core
- [x] **T5.1** Create + analyse
- [x] **T5.2** Pipeline engine
- [x] **T5.3** Job detail — Overview
- [x] **T5.4** Jobs board — list view

## Phase 6 — Tailor ⭐
- [x] **T6.1** Serialize + snapshot
- [x] **T6.2** Guard, assemble, score, keywords, plainText
- [x] **T6.3** Tailor action + Documents tab
- [x] **T6.4** Workspace editor
- [x] **T6.5** Match panel
- [x] **T6.6** Evals harness

## Phase 7 — Export
- [x] **T7.1** PDF templates
- [x] **T7.2** Finishing touches
- [x] **M3 checkpoint** Use RoleRefine for your own applications for a week; log issues in docs/FEEDBACK.md; fix the top 3

## Phase 8 — Full tracker
- [x] **T8.1** Board view
- [x] **T8.2** Timeline tab
- [x] **T8.3** Interviews tab
- [x] **T8.4** Contacts
- [x] **T8.5** Reminders
- [x] **T8.6** Offers
- [x] **T8.7** Dashboard

## Phase 9 — Cover letters
- [x] **T9.1** Letter logic
- [x] **T9.2** Letter action + dialog
- [x] **T9.3** Letter workspace + PDF

## Phase 10 — Insights
- [x] **T10.1** Metrics queries
- [x] **T10.2** Insights UI

## Phase 11 — Billing
- [x] **T11.1** Usage & gating UI
- [x] **T11.2** Checkout & portal
- [ ] **T11.3** Webhook
- [ ] **T11.4** DOCX export (Pro)

## Phase 12 — Marketing site
- [ ] **T12.1** Homepage structure
- [ ] **T12.2** Interactive demo
- [ ] **T12.3** Pricing page
- [ ] **T12.4** Free tools
- [ ] **T12.5** SEO & content plumbing
- [ ] **T12.6** Legal, consent & welcome email

## Phase 13 — Launch match score
- [ ] **T13.1** Account & trust
- [ ] **T13.2** Hardening
- [ ] **T13.3** E2E happy path
- [ ] **T13.4** Production
- [ ] **T13.5** Beta → launch

## Notes

- **2026-10-22 T11.2:** Monthly and 90-day Checkout, plus Manage subscription once a Stripe customer exists. The founding coupon applies only when the email is a Lead with foundingOffer and the coupon can still be redeemed. Other sessions allow a promotion code. In development, a real `sk_test_` key shows a price preview so one account can open both totals and go back without paying. One test-card payment (4242…) then the portal switches intervals. Placeholder env values that contain `...` are treated as unset. The plan still changes only in the T11.3 webhook. The dev `.env` still has the example Stripe placeholders, so a hosted Checkout page was not opened. The settings page showed Monthly, US$19 and 90 days, US$45.
- **2026-10-22 T11.1:** The usage pill is tailored resumes this UTC month, and it links to `/settings?tab=plan`. Extra credits show on the pill when any remain, and they are not folded into the allowance. Plan & billing shows the plan, the interval and renewal or end date when those are set, and bars for tailored resumes, cover letters, resume imports, and job analyses. Upgrade names the limit, including the Free and Pro allowances for a quota. Checkout and Manage subscription stay on T11.2. Prep kits and bullet coach stay off this screen. The dev account’s Pro view showed 51 of 80 tailored resumes, 12 of 60 letters, 2 of 20 imports, and 24 of 60 analyses today.
- **2026-10-22 T10.2:** Insights is 30 days, 90 days, or all time. 30 days is the page with no query. Tiles, the funnel (share of the previous stage), and stacked weekly bars are on every plan. What’s working is Pro. Free sees a blurred preview, and Upgrade opens the modal. A group under 5 applications stays hidden. The dev account’s all-time view showed Not tailored at 33% based on 6 applications. The activity streak stays on Phase 15.
- **2026-10-22 T10.1:** Insights rates are computed per user from `appliedAt` in range: response uses 7×24 hours, interview counts any interview row, and offer counts status Offer or Accepted or an offer event. Breakdowns under 5 applications are omitted. Weekly bars are Monday-start weeks in the user's timezone, tailored against not. The activity streak stays on Phase 15. The Insights page stays a placeholder until T10.2.
- **2026-10-22 T9.3:** The letter workspace edits greeting, paragraphs, closing, and signature, with source chips and a 1.5s autosave. Copy text and the PDF are greeting, included paragraphs, closing, then signature, named `First-Last-Company-Title-Letter.pdf`. Mark as submitted sets this version and does not change status. DOCX stays locked. The five no-WHY letters from T9.1 (`2026-10-22T07-51-35-901Z`) still had no invented company facts; the prompt was not changed.
- **2026-10-22 T9.2:** Write cover letter is on Documents. The dialog takes tone, length, recipient, why, and an optional READY resume. Focus refs are remapped onto the library snapshot for this letter. Version cards list v#, date, tone, length, template, and ratings. Open still goes to the placeholder. A second write under 5 minutes is refused, and a failed write is not charged. The editor and PDF stay on T9.3.
- **2026-10-22 T9.1:** The letter guard is L1–L4. A paragraph that cited WHY and has no other source stays, with `needsWhy`. Greeting and signature come from the profile and the recipient. The closing keeps the model's words. `npm run evals` writes a letter on even pairs, alternating a WHY note and none. Five no-WHY letters in `2026-10-22T07-51-35-901Z` stayed inside the posting. Average letter reverts 0.75. Resume reverts 0.00. The write action is T9.2.
- **2026-10-22 T8.7:** Dashboard is Today, nudges, pipeline counts, this week, and five recent jobs. Getting started stays until four steps are done, then one success line. A stage count opens `/jobs?stage=` (one column; All stages clears it). The seed replaces that user's jobs with 8 jobs, 4 contacts, 3 interviews, 5 reminders, 1 offer, and 2 READY resumes. The seeded library is 100%, so the health line stays hidden. A wider layout can wait.
- **2026-10-22 T8.6:** One offer per job on `?tab=offer`. The first save writes Offer received and moves Saved, Applied, Screening, or Interviewing to Offer through the pipeline. Respond-by is UTC midnight; the reminder is two calendar days earlier and moves or clears with that date. The offer decision does not change job status. Congratulations shows only when status becomes Accepted, with no fade under reduced motion. Testimonial and pause stay on T13.1.
- **2026-10-21 T8.5:** Reminders stay in the app (bell, Dashboard Today, `?tab=reminders`). They are not device notifications. Snooze is exactly 24 hours from now. A custom reminder is a title (120) and a calendar date at noon in the user's timezone. Dismissed rows stay stored and leave the lists. A deadline or interview date change can replace a snooze on that automatic reminder. Offer reminders stay on T8.6. The rest of the dashboard stays on T8.7.
- **2026-10-21 T8.4:** Contacts are `?tab=contacts` and `/contacts`. A follow-up can name a linked contact (`JobEvent.contactId`, cleared if the contact is deleted). Log outreach is a follow-up for today at noon in the user's timezone. `lastContactedAt` is the latest follow-up for that person. Interviewers stay free text. Seed contacts stay on T8.7.
- **2026-10-21 T8.3:** Interviews are `?tab=interviews`. The first dated interview moves Saved, Applied, or Screening to Interviewing and does not set `appliedAt`. A reminder is due 24 hours before; a thank-you is only when the interview is today in the user's timezone. The first outcome writes one completed event. Changing the date does not add a second scheduled event. Delete leaves the timeline lines and does not move status back. Reminders UI is T8.5. Interviewers stay free text until T8.4.
- **2026-10-21 T8.2:** Timeline is `?tab=timeline`. Manual entries are follow-up, call, email, note, and other; the date is noon in the user's timezone. Hide automatic events is the `events=manual` filter. Details cap is 2,000 characters. A contact on a follow-up waits for T8.4.
- **2026-10-21 T8.1:** The board is the default jobs page; the list is `?view=list`. Card order is a float midpoint in `board-order.ts` (no `fractional-indexing` package). Below `md`, one column and a stage picker; Move to… is the keyboard and phone path. Same-stage drag writes `boardOrder` only. A 30-card drag was not run; the dev account has three jobs.
- **2026-10-21 M3:** Checked by hand. Feedback fixes are on main. Follow-up: the library layout (controls beside the text) was left for later.
- **2026-10-21 T7.2:** Copy text uses the resume on screen. Free locks Modern, Compact, and DOCX. Mark as submitted sets this version and does not change status. The first PDF export asks to move to Applied only while the job is still Saved, and Yes goes through the pipeline. DOCX file generation stays on T11.4.
- **2026-10-21 T7.1:** Classic, Modern, and Compact PDFs download from `/api/resumes/[id]/pdf`. Free falls back to Classic. A seed-sized resume and the saved dev resume fit one Letter page, and copied text stays in section order. `runtime` is not exported because `cacheComponents` rejects it. Copy text, the template switch, and mark as submitted stay in T7.2.
- **2026-10-21 T6.6:** `npm run evals` runs 4 libraries × 6 postings (ANALYZE + TAILOR + guard + score). Cover letters wait for T9.1. The first run cost about $0.48 with average reverts 0.00. Two summaries overstated tenure and "worked directly with product squads"; the prompt was not changed. Calls count against `SEED_USER_ID` quota.
- **2026-10-21 T6.5:** The match score stays the library score from tailoring. Keyword coverage updates as you edit. Add to library is only on a missing requirement, the bullet starts empty, and Tailor again opens Documents. The mobile Export tab waits for T7.1.
- **2026-10-20 T6.4:** The workspace autosaves. Titles, employers, and dates stay on the snapshot. On Documents, Open is the left action and the version title opens the resume. PDF download waits for T7.1.
- **2026-10-20 T6.3:** `tailorResume` saves the next version as PENDING, then READY with a `RESUME_TAILORED` event. A second tailor while one is under 5 minutes old is CONFLICT. A failed model call is FAILED and does not use quota. Documents lists the versions. Open still goes to the workspace placeholder. Cover letters stay on T9. A live model call was not run: the dev database had no users.
- **2026-10-20 T6.2:** `validateTailorOutput` runs G1–G11. `reverts` counts G4 and G5 only. `$50` and `50` differ; `1,000` matches `1000`. A posting with no requirements scores null. Plain text is included content only, in section order, with no RoleRefine branding.
- **2026-10-20 T6.1:** `serializeLibrary(library, takenAt)` is pure. Prompt text uses E/S refs. Email, phone, location, links, and entry URLs stay on the snapshot. A year-only end date sorts as December, a year-only start as January. Newlines in a summary or bullet become one space in the text; the snapshot keeps the original.
- **2026-10-20 T5.4:** The jobs list is the page until the board (T8.1). Filters and sort stay in the URL. Default sort is last activity, newest first. Inline status uses the pipeline. Archive selected leaves status alone. Match score is the best READY tailored resume, or a dash. A deadline within 3 days in the user’s timezone is marked Soon.
- **2026-10-20 T5.3:** Job overview: status goes through `applyStatusChange` (a closed stage asks for an optional reason). Edit details is title, company, location, and URL. The details form saves on blur; changing the deadline moves the open automatic reminder to 3 days before, and clearing it dismisses that reminder. Submitted documents wait for tailored resumes and letters.
- **2026-10-20 T5.2:** `applyStatusChange` is the only status write. `appliedAt`, `firstResponseAt`, and `closedAt` are set once. The same status again adds no reminder and does not change `appliedAt`. The follow-up is due 7×24 hours after the first move to Applied. `submittedResumeId` is the latest exported READY resume, only on that first move. Closed statuses dismiss open reminders. `planColumnMove` is pure; the drag write waits for T8.1.
- **2026-10-20 T5.1:** `createJob` saves the posting first, then analyses it. A failed call leaves the job FAILED with Retry and does not use the daily analysis. Title, company, location, work mode, employment, salary, and reference number are filled only while those fields are still empty. A deadline stores a reminder for 3 days before. Checked three public postings: NearSource (hourly contract), CSIS library technician, and CSIS communications analyst.
- **2026-10-20 T4.3:** Review saves only checked items. Replace deletes entries and skills first. Append skips a skill name already in the library. The sign-in email is never imported. Nothing checked refuses the save. While `onboardingCompletedAt` is null, save goes to Dashboard.
- **2026-10-20 T4.2:** `extractResume` reads a PDF, DOCX, or paste and returns a review payload. Nothing is saved until T4.3. A bad file is `VALIDATION` and does not use quota. Bullets over 400 stay and are flagged `long`. `npm run ai:import -- <path>` is the dev check. Older `.doc` files need to be `.docx` first.
- **2026-10-20 T4.1:** `runStructured` is the only model call and writes an `AiCall` (tokens, `costMicros`) for every attempt, including failures. Quotas are a UTC month except ANALYZE (UTC day). Bonus credits are soonest-expiry first, never-expiring last. `npm run ai:analyze` is the dev check and counts as one daily analysis. Haiku prompts over 100k tokens use the higher price.
- **2026-10-19 T3.6:** Dev seed replaces the SEED_USER_ID library only (profile header, 3 roles, 2 projects, 1 degree, 15 skills, weak through excellent bullets). Email stays the sign-in address. Jobs and the rest wait for T8.7. An account with no entries and no skills shows “Your library is empty” (Import a resume / Add manually). The seed reads env itself; `tsx` runs it. Pooler transaction flakes (P2028) retry once.
- **2026-10-19 T3.5:** Bullet strength is deterministic (verb, metric, 8–32 words, no first person, no filler, skill or known tool). Tiers 0–2 Weak through 6 Excellent; meter fills 1–5 segments; fixes name the next tier. Health is five checks at 20% each. AI reading and analysis stays later: import (T4), posting analysis (T5), tailoring (T6), bullet coach (1.1).
- **2026-10-19 T3.4:** Skills on `/library`: chips grouped by category (no category last). Name max 50, category max 40, blank category stores none. Autocomplete is the user's categories plus Languages, Frameworks, Tools, Cloud, Data, Soft skills; a case-only match keeps the existing spelling. Duplicate names ignoring case return CONFLICT. Delete has no confirm. Move up/down stays inside the category.
- **2026-10-19 T3.3:** Bullets on `/library`: inline edit (Enter/blur saves, Esc cancels, 400 counter), add, delete with no confirm, move up/down, optimistic rollback. Text trimmed and required, max 400. `tags` stays empty. Strength meters are T3.5.
- **2026-10-19 T3.2:** Entry sections on `/library`: add, edit, delete, move up/down. Caps title 120, organization 120, location 80, URL 300 http(s). Dates `YYYY` or `YYYY-MM` (1900–2099); current stores no end date. Bullets stay read-only until T3.3. Summary stays 2,000.
- **2026-10-19 T3.1:** Library profile card + dialog on `/library`. Email is the sign-in address (read-only). Summary cap 2,000 (source text); tailored resume summary stays 800. Links must be http(s), max 5. Settings profile still a placeholder.
- **2026-10-18 T2.2:** Waitlist on `/` + `/waitlist`; Turnstile + CASL consent → `Lead` upsert; PostHog cookieless (`lead_captured` server-side, no email); demo GIF placeholder; share `?ref=waitlist-<shortid>`. Dup emails upsert without error. Prod: www.rolerefine.ca. Add rolerefine.ca to Turnstile allowed hostnames if captcha fails in prod.
- **2026-10-17 T2.1:** Wordmark SVG + React component; pine "R" favicon/apple-icon; shared `brandOgImage` (`next/og`) + opengraph/twitter images; marketing header/footer + `(marketing)` shell. Footer/newsletter/socials omitted until later. **Q-1 clearance (agent web check, not legal advice):** no live DNS for rolerefine.com/.ca/getrolerefine.com (likely free to register — buy them); no obvious CIPO/USPTO hit for exact "RoleRefine"; nearby: Emergent AI **RoleRefiner** (JD tool), a LinkedIn hobby "RoleRefine" JD rewriter, UK **ROLEFINE LIMITED** (unrelated). Social handles deferred until site complete. Official CIPO/USPTO knockout + domain purchase still on you.
- **2026-10-17 T1.3:** App shell (sidebar/mobile sheet, header, usage-pill stub, upgrade store, Feedback → DB); placeholder pages for 1.0 routes + milestones/targets stubs; `instant = false` on app layout + sign-in; `allowedDevOrigins` for 127.0.0.1. Usage pill still hard-coded 0/3 until T11.1.
- **2026-10-17 T1.2:** `requireUser` / `requireAdmin` / `requireUserForAction`; lazy User upsert + Referral from `rr_ft` (incl. `source`); `setTimezone` + `signOut`; `(app)` layout + `/admin` stub; callback also accepts `token_hash`. Shell UI is T1.3.
- **2026-10-17 T1.1:** `@supabase/ssr` + clients; `src/proxy.ts` (getClaims refresh, protected redirects, `rr_ft` first-touch cookie); `/sign-in` (magic link + Google); `/auth/callback`; stub `/dashboard` for accept (replace in T1.3). `requireUser` is T1.2.
- **2026-10-17 T0.4:** Vitest 5 + Playwright smoke; `lib/result.ts` (10 codes) + 16 unit tests; CI workflow lint/typecheck/test (e2e not in CI). `@types/node` ^22 for Vitest peer.
- **2026-10-17 T0.3:** Prisma 7.10 + adapter-pg; `init` + `enable_rls` migrations (25 tables, RLS on). `env.ts` requires DB URLs + `NEXT_PUBLIC_APP_URL`; later-phase secrets optional. Vitest/CI still T0.4.
- **2026-10-17 T0.2:** shadcn (Radix nova) + brand tokens; Inter/Source Serif 4; `/styleguide` gated by `NODE_ENV` until `lib/env.ts` (T0.3). Vitest still T0.4.
- **2026-10-17 T0.1:** Next 16.4 scaffold on Node 22; remote is `MorganLay/rolereview` (`main`). `postinstall` deferred until Prisma (T0.3); Vitest lands in T0.4.
