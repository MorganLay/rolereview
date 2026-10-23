# 06 — Roadmap & Task List

> Build order. **One task = one Cursor chat** (about 1–3 hours). Each task says what to build and how you'll know it's done. Don't start a task until the ones before it in its phase are ticked. How to run a task: `08-CURSOR-WORKFLOW.md`.

## Milestones

| Milestone | After phase | You can… | Est. cumulative |
|---|---|---|---|
| M0 Foundation | 0–1 | Sign in to an empty app; CI green | ~11 h |
| M1 Waitlist live | 2 | Collect emails and start building in public | ~16 h |
| M2 Library | 3–4 | Import and edit your own resume | ~34 h |
| **M3 Walking skeleton** ⭐ | 5–7 | Posting → tailored resume → edit → PDF. **Use it for your own applications.** | ~66 h |
| M4 Full tracker | 8–10 | Board, timeline, interviews, contacts, reminders, offers, cover letters, Insights | ~100 h |
| M5 Monetisable | 11 | Free/Pro, Stripe, DOCX | ~110 h |
| **M6 Launch (1.0)** | 12–13 | Marketing site, free tools, legal, prod, beta → public launch | ~138 h |
| M7 Release 1.1 | 14–21 | Email, gamification, interview prep kits, coach, target profiles, referrals, admin, guides | ~195 h |
| M8 Release 1.2 | 22+ | Extension, Canadian federal mode, offers compare, annual plan | ~240 h |

At ~10 h/week, 1.0 is roughly a 3–4 month project. The walking skeleton comes first on purpose: it's the part that proves the idea, and you'll find the real problems by using it.

## Definition of Done (every task)
- [ ] Acceptance criteria pass when you try them by hand.
- [ ] `npm run lint && npm run typecheck && npm run test` pass.
- [ ] Pure logic (`validate`, `assemble`, `score`, `keywords`, `strength`, `serialize`, `extract`, `quota`, `pipeline`, `board-order`, Insights metrics, `plainText`) has unit tests.
- [ ] Every new query/action is scoped by `userId`; status changes go through `applyStatusChange`.
- [ ] No user content in logs or analytics events.
- [ ] Docs updated if behaviour differs.
- [ ] Commit: `feat(area): T#.# description`.

---

# Release 1.0 — Launch

## Phase 0 — Foundation (~6 h)

**T0.1 Create the project.** The `rolerefine` folder already holds the plan, and `create-next-app` refuses non-empty folders. From `D:\Coding Projects` run `npx create-next-app@latest rolerefine-scaffold` (TypeScript, ESLint, Tailwind, App Router, `src/`, alias `@/*`), move its contents into `rolerefine` **without overwriting** `docs/` (incl. `PROGRESS.md`), `AGENTS.md`, `.cursor/` (rules + commands), `prisma/`, `README.md`, `.env.example` (merge any generated `AGENTS.md` lines into ours), delete the scaffold, `git init`. TS `strict` + `noUncheckedIndexedAccess`. Add the npm scripts from `03-ARCHITECTURE.md`. `.gitignore` per the security checklist.
*Accept:* `npm run dev` works; `npm run typecheck` passes; pushed to a new **private** GitHub repo.

**T0.2 UI kit & brand tokens.** shadcn/ui init + components (button, input, textarea, label, card, dialog, alert-dialog, dropdown-menu, select, checkbox, tabs, badge, tooltip, popover, progress, separator, skeleton, sonner, sheet, table, chart). Brand tokens exactly as `10-BRAND.md` → Design tokens (Tailwind `@theme` + shadcn variable mapping, light default + dark mode), Source Serif 4 + Inter via `next/font`. `src/copy/strings.ts` started.
*Accept:* a dev-only `/styleguide` page shows every component in both themes and reads clearly.

**T0.3 Database.** Supabase `rolerefine-dev` (Canada region if offered). Prisma 7 + adapter + `prisma.config.ts`; `src/lib/db.ts`; `migrate dev --name init`; the `enable_rls` migration; `src/lib/env.ts`.
*Accept:* Prisma Studio shows 25 tables; the Supabase dashboard shows RLS enabled on all of them.

**T0.4 Tests & CI.** Vitest + Playwright smoke test; `lib/result.ts` (all error codes) + tests; GitHub Actions (lint, typecheck, test).
*Accept:* CI green on push.

## Phase 1 — Auth & shell (~5 h)

**T1.1 Supabase Auth.** SSR clients; `src/proxy.ts` (session refresh, protected-route redirects, first-touch UTM/ref/referrer cookie); `/sign-in` (magic link + Google); `/auth/callback`.
*Accept:* both sign-in methods work; protected routes redirect and return after sign-in.

**T1.2 `requireUser()` / `requireAdmin()`.** Upsert User with `referralCode`, attribution from the cookie, and a `Referral` row if `ref` is valid; timezone captured on first app load (`setTimezone` action). Sign-out action.
*Accept:* first sign-in creates exactly one User with attribution fields; `/admin` 404s for normal users.

**T1.3 App shell.** Sidebar, header (New job, reminders bell placeholder, user menu), toaster, Upgrade modal store, Feedback button (→ `Feedback`), placeholder pages for every app route in `02-USER-FLOWS.md`. Mobile layout.
*Accept:* all routes render; works at 375 px; feedback submissions appear in the DB.

## Phase 2 — Brand & waitlist (~5 h)

**T2.1 Brand basics.** RoleRefine wordmark (SVG, per `10-BRAND.md` → Logo direction), favicon ("R" on pine), OG image template (`next/og`), marketing header/footer. Domain bought and name checks done (D-27 / Q-1) before this task.
*Accept:* sharing the URL in Slack/LinkedIn shows a branded preview.

**T2.2 Waitlist page + launch.** `/waitlist` (temporarily also `/`) per `09-MARKETING.md`: hero, demo GIF placeholder, founding offer, email + CASL checkbox, Turnstile, `Lead` upsert with UTM, thank-you state with share link. PostHog installed (cookieless) with `lead_captured`. Deploy to Vercel with the custom domain.
*Accept:* sign up from your phone → `Lead` row with consent text; duplicate emails don't error; bots without a Turnstile token are rejected.

## Phase 3 — Library (~10 h)

**T3.1 Library read + profile.** `getLibrary`, profile card + dialog, links editor.
**T3.2 Entries CRUD.** Sections, entry dialog (month/year pickers, "current"), delete, reorder.
**T3.3 Bullets.** Inline edit, add, delete, reorder, optimistic UI + rollback.
**T3.4 Skills.** Chips by category, autocomplete categories, case-insensitive dedupe.
**T3.5 Strength & health.** `strength.ts` + `verbs.ts` (≥ 30 table-driven tests), strength meters with tooltip fixes, library health card.
**T3.6 Seed & empty states.** `prisma/seed.ts` exactly as `04-DATA-MODEL.md` → Seed (library part now; the rest grows with later phases).
*Accept (phase):* you can build your full real library by hand; weak bullets show Weak and say why; strong ones show Strong/Excellent.

## Phase 4 — Import (~8 h)

**T4.1 AI plumbing.** `lib/ai/{client,models,pricing,run}.ts`; `plans.ts`, `quota.ts` (periods, bonus credits), `entitlements.ts`; unit tests (quota math incl. bonus credits; run error mapping with a mocked SDK).
*Accept:* a dev script runs ANALYZE and an `AiCall` row has tokens and `costMicros`.

**T4.2 Extraction.** `prompts/import.ts`; `extract.ts` + tests; `extractResume` action (file checks, PDF document block / mammoth / text).
*Accept:* your real PDF and a DOCX both extract well; a renamed PNG is rejected; the 3rd import in a month on Free → `QUOTA_EXCEEDED`.

**T4.3 Review & commit.** Import page state machine, review UI, Append/Replace, `commitImport` transaction.
*Accept:* unchecked items aren't saved; Replace really replaces; onboarding redirect to Dashboard.

## Phase 5 — Jobs core (~8 h)

**T5.1 Create + analyse.** `prompts/analyze.ts` (incl. workMode/salary/ref #); `createJob`, `retryAnalysis`; `/jobs/new`.
*Accept:* 3 real postings give sensible requirements and pre-filled details; a network failure leaves a retryable FAILED job.

**T5.2 Pipeline engine.** `features/jobs/pipeline.ts` `applyStatusChange()` implementing **every** row of `04-DATA-MODEL.md` → Automatic side effects (status-related ones; interview/offer hooks get called later) + `board-order.ts`. Test-first.
*Accept:* ≥ 20 unit tests covering each trigger; applying twice doesn't duplicate reminders or overwrite `appliedAt`.

**T5.3 Job detail — Overview.** Header (status select via pipeline, priority, archive, delete), Overview tab (requirements, keywords, posting, details form, notes).
*Accept:* another user's job id → 404; changing status creates timeline rows.

**T5.4 Jobs board — list view.** Sortable/filterable table, inline status, archive toggle, empty state.

## Phase 6 — Tailor ⭐ (~18 h)

**T6.1 Serialize + snapshot** (`serialize.ts` + tests).
**T6.2 Guard, assemble, score, keywords, plainText:** pure logic, **tests first** for G1–G11 (≥ 25 tests; `validate.ts` coverage > 90%).
**T6.3 Tailor action + Documents tab:** `prompts/tailor.ts`, `tailorResume` (14 steps), tailor dialog, staged progress, polling, version cards, 👍/👎 rating.
*Accept:* a real tailored resume in < 60 s; double-click → CONFLICT; forced failure → FAILED, no quota used.
**T6.4 Workspace editor:** per `02-USER-FLOWS.md` (include toggles, inline edit, reorder, source popover, strength meters, autosave).
**T6.5 Match panel:** match score breakdown with evidence scroll, live keyword coverage, quick-add to library.
**T6.6 Evals harness:** fixtures, `npm run evals`, `evals/NOTES.md` with your manual review of 5 pairs.

## Phase 7 — Export (~6 h)

**T7.1 PDF templates:** Classic, Modern, Compact (ATS rules); `/api/resumes/[id]/pdf`; entitlement fallback.
*Accept:* text copied from the PDF is clean and correctly ordered; a typical tailored resume fits 1 page on Classic and Compact.
**T7.2 Finishing touches:** copy as text, template switch (locks for Free), "Mark as submitted", first-export success modal ("Move to Applied?" via pipeline).

**→ M3. Use RoleRefine for your real applications for at least a week. Log every annoyance in `docs/FEEDBACK.md`. Fix the top 3 before Phase 8.**

## Phase 8 — Full tracker (~18 h)

**T8.1 Board view:** dnd-kit columns, fractional ordering, Closed column with sub-status prompt, keyboard/mobile "Move to…" menu, filters shared with the list view.
*Accept:* 30 cards drag smoothly; order persists; screen-reader users can move cards via the menu.
**T8.2 Timeline tab:** event list with icons; manual entries; hide auto events.
**T8.3 Interviews tab:** CRUD, timezone-aware datetime, outcome + reflection; pipeline hooks (auto status → INTERVIEWING, reminders).
**T8.4 Contacts:** job tab (link/create, roles, log outreach) + `/contacts` page with drawer.
**T8.5 Reminders:** bell popover, Dashboard "Today", job Reminders tab, complete/snooze/dismiss, automatic reminders from the pipeline.
**T8.6 Offers:** Offer tab, pipeline hook (status → OFFER, respond-by reminder), a short, tasteful congratulations moment on Accepted (reduced-motion aware).
**T8.7 Dashboard:** all sections in `02-USER-FLOWS.md` incl. nudges and pipeline snapshot. Extend the seed with jobs, events, interviews, contacts, reminders, and an offer.

## Phase 9 — Cover letters (~9 h)

**T9.1 Letter logic:** `prompts/letter.ts`, `letters/validate.ts` (L1–L4, sentence-level number check) + `assemble.ts`, tests first.
**T9.2 Letter action + dialog:** options incl. "Why this company?" and align-with-resume; versions on the Documents tab.
**T9.3 Letter workspace + PDF:** editor with source chips, export PDF (DOCX in T11.4), mark as submitted.
*Accept:* a letter with no WHY text contains no invented company facts (check 5 by hand and record them in `evals/NOTES.md`).

## Phase 10 — Insights (~7 h)

**T10.1 Metrics queries:** every definition in `04-DATA-MODEL.md` → Analytics, with unit tests against seed-like fixtures (incl. the small-sample rule).
**T10.2 Insights UI:** KPI tiles, funnel, weekly bars (tailored vs not), Pro "What's working" (blurred preview for Free), empty state.

## Phase 11 — Billing (~10 h)

**T11.1 Usage & gating UI:** charges pill, Settings → Plan & billing usage bars (incl. bonus credits), Upgrade modal copy per limit, `PRO_REQUIRED` locks.
**T11.2 Checkout & portal:** monthly + 90-day prices, founding coupon logic, promotion codes, portal.
*Accept:* test checkout for both intervals; founding discount applies to eligible emails only.
**T11.3 Webhook:** events per `03-ARCHITECTURE.md`; `StripeEvent` idempotency; `invoice.payment_failed` banner.
*Accept:* upgrade → PRO within seconds; cancel → FREE at period end; replayed events are no-ops.
**T11.4 DOCX export (Pro):** resume + letter via `docx`, same order as PDF.

## Phase 12 — Marketing site (~18 h)

**T12.1 Homepage structure:** sections 1–5, 7, 8, 10–14 from `09-MARKETING.md` with real screenshots; CTA logic (signed in → Go to Dashboard); events `cta_click`.
**T12.2 Interactive demo:** generate the 9 persona×posting fixtures with the real pipeline (script in `evals/`), demo-mode (read-only) workspace components, `/demo` page, homepage section 6.
*Accept:* the demo works offline from fixtures, with zero AI calls.
**T12.3 Pricing page:** toggle, full comparison table generated from `plans.ts`, guarantee, billing FAQ, JSON-LD.
**T12.4 Free tools:** keyword checker (Turnstile, IP-hash limit, FREE_TOOL logging, email-me-the-report → `Lead`) and bullet strength checker (reuses `strength.ts`).
**T12.5 SEO & content plumbing:** metadata on all routes, `sitemap.ts`, `robots.ts`, JSON-LD (SoftwareApplication, FAQPage), OG images, `/about`, `/changelog` (MDX). Lighthouse SEO 100 and accessibility 100. Performance 73 and LCP 3.5 s are recorded in `09-MARKETING.md`; the 90 / 2.5 s bar stays deferred.
**T12.6 Legal, consent & welcome email:** `/privacy`, `/terms`, Settings → Preferences (timezone, notifications, marketing consent), Resend set up + welcome email + `EmailLog`.

## Phase 13 — Launch match score (~10 h)

**T13.1 Account & trust:** data export (JSON), delete account, testimonial request on Accepted (consent form → `Testimonial`), founder note on the homepage.
**T13.2 Hardening:** `error.tsx`/`not-found.tsx`, full security checklist, cross-user ownership audit of every route and action, rate-limit review.
**T13.3 E2E happy path:** sign in → import fixture → job → tailored resume → letter → export → board move.
**T13.4 Production:** prod Supabase, Vercel Pro, env vars, Stripe live + webhook, Resend domain, PostHog prod, Supabase auth URLs, a real purchase test (then refund).
**T13.5 Beta → launch:** invite 20–50 waitlist users (free Pro), weekly feedback, fix the top issues, collect testimonials, then run the launch week from `09-MARKETING.md`.

---

# Release 1.1 — Momentum (~55 h)

**Phase 14 — Email & cron:** `vercel.json` crons; reminders digest; weekly Insights digest; renewal heads-up; offer congrats; quota-reached email; email preferences honoured; `EmailLog` idempotency tests.
**Phase 15 — Momentum:** `momentum/streak.ts` (derived weekly streak in the user's timezone, per `04-DATA-MODEL.md` → Analytics), `milestones.ts` (~12 definitions), `award.ts` hooks in the relevant actions, quiet milestone toasts, streak on the dashboard, `/milestones` page. Update the homepage "Progress you can see" section once live.
**Phase 16 — Interview interview prep kits:** prompt + guard + UI + print view.
**Phase 17 — Bullet coach:** prompt + guard + placeholder-enforced apply flow.
**Phase 18 — TargetProfiles:** CRUD + tailor dialog integration + prompt input.
**Phase 19 — Referrals:** invite tab, activation/conversion tracking, bonus credits, Stripe reward.
**Phase 20 — Admin dashboard:** metrics in `02-USER-FLOWS.md` → `/admin`, testimonial approval queue.
**Phase 21 — Content:** MDX guides (first 6 of the plan), `/for/*` audience pages, `/compare/*` pages (sourced, dated).

### Milestones (starting set, tune later)
| Key | Unlocked when |
|---|---|
| `library-built` | Library has ≥ 1 experience entry and ≥ 5 skills |
| `strong-bullets-5` | 5 bullets at Strong or above |
| `first-tailored` | First READY tailored resume |
| `first-export` | First PDF/DOCX exported |
| `tailored-applications-10` | 10 jobs moved to Applied with a submitted tailored resume |
| `first-follow-up` | First FOLLOW_UP_SENT event |
| `first-interview` | First interview logged |
| `reflection-written` | First interview reflection saved |
| `prep-practised` | 5 prep questions marked practised (1.1) |
| `first-offer` | First job reaches OFFER |
| `offer-accepted` | A job reaches ACCEPTED |
| `streak-4` | 4-week momentum streak |
Applying without tailoring never counts toward anything, on purpose.

# Release 1.2 — Expansion (~45 h)

- **Chrome extension** (Manifest V3): capture the visible posting text + URL → `createJob` via an authenticated endpoint.
- **Canadian federal mode:** detect GC Jobs postings; screening-question answers per essential qualification, drawn from library evidence (same guard approach); guide + `/for/canadian-public-service` upgrade.
- **Offer comparison** view (Pro).
- **Annual plan, student discount, CAD prices.**
- **Shareable hunt summary card** (`next/og`), opt-in.
- Candidate: French UI.
