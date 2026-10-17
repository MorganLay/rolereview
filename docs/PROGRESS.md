# Progress

> Updated by the `/finish-task` command (or by hand). `/next-task` starts the first unticked task. Release 1.0 only; 1.1/1.2 tasks get added when 1.0 ships.

Status: `[ ]` not started · `[~]` in progress · `[x]` done


## Phase 0 — Foundation
- [x] **T0.1** Create the project
- [x] **T0.2** UI kit & brand tokens
- [x] **T0.3** Database
- [ ] **T0.4** Tests & CI

## Phase 1 — Auth & shell
- [ ] **T1.1** Supabase Auth
- [ ] **T1.2** requireUser() / requireAdmin()
- [ ] **T1.3** App shell

## Phase 2 — Brand & waitlist
- [ ] **T2.1** Brand basics
- [ ] **T2.2** Waitlist page + launch

## Phase 3 — Library
- [ ] **T3.1** Library read + profile
- [ ] **T3.2** Entries CRUD
- [ ] **T3.3** Bullets
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

- **2026-10-17 T0.3:** Prisma 7.10 + adapter-pg; `init` + `enable_rls` migrations (25 tables, RLS on). `env.ts` requires DB URLs + `NEXT_PUBLIC_APP_URL`; later-phase secrets optional. Vitest/CI still T0.4.
- **2026-10-17 T0.2:** shadcn (Radix nova) + brand tokens; Inter/Source Serif 4; `/styleguide` gated by `NODE_ENV` until `lib/env.ts` (T0.3). Vitest still T0.4.
- **2026-10-17 T0.1:** Next 16.4 scaffold on Node 22; remote is `MorganLay/rolereview` (`main`). `postinstall` deferred until Prisma (T0.3); Vitest lands in T0.4.
