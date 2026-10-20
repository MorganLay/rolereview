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
- [ ] **T3.4** Skills
- [ ] **T3.5** Strength & health
- [ ] **T3.6** Seed & empty states

## Phase 4 — Import
- [ ] **T4.1** AI plumbing
- [ ] **T4.2** Extraction
- [ ] **T4.3** Review & commit

## Phase 5 — Jobs core
- [ ] **T5.1** Create + analyse
- [ ] **T5.2** Pipeline engine
- [ ] **T5.3** Job detail — Overview
- [ ] **T5.4** Jobs board — list view

## Phase 6 — Tailor ⭐
- [ ] **T6.1** Serialize + snapshot
- [ ] **T6.2** Guard, assemble, score, keywords, plainText
- [ ] **T6.3** Tailor action + Documents tab
- [ ] **T6.4** Workspace editor
- [ ] **T6.5** Match panel
- [ ] **T6.6** Evals harness

## Phase 7 — Export
- [ ] **T7.1** PDF templates
- [ ] **T7.2** Finishing touches
- [ ] **M3 checkpoint** Use RoleRefine for your own applications for a week; log issues in docs/FEEDBACK.md; fix the top 3

## Phase 8 — Full tracker
- [ ] **T8.1** Board view
- [ ] **T8.2** Timeline tab
- [ ] **T8.3** Interviews tab
- [ ] **T8.4** Contacts
- [ ] **T8.5** Reminders
- [ ] **T8.6** Offers
- [ ] **T8.7** Dashboard

## Phase 9 — Cover letters
- [ ] **T9.1** Letter logic
- [ ] **T9.2** Letter action + dialog
- [ ] **T9.3** Letter workspace + PDF

## Phase 10 — Insights
- [ ] **T10.1** Metrics queries
- [ ] **T10.2** Insights UI

## Phase 11 — Billing
- [ ] **T11.1** Usage & gating UI
- [ ] **T11.2** Checkout & portal
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

<!-- Short notes per task: decisions made, follow-ups, things to revisit. Newest first. -->

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
