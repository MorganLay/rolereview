# 07 — Decisions Log

> Why things are the way they are. Add an entry whenever you change scope, stack, pricing, or a pattern. Cursor should read this before proposing to "switch X to Y".

Format: **ID — Decision** · Status · Context → Choice → Consequences.

## Brand

**D-27 — Brand: RoleRefine, professional positioning** · Accepted 2026-10-17
- Context: "JobForge" conflicted with an existing site (JobForgeAI.com, same space, anvil logo). An RPG theme also narrowed the market and undercut the "truthful" promise (magic/quests suggest invention), and it would read as a hobby project to employers reviewing it as a portfolio piece.
- Choice: **RoleRefine** with a calm, editorial visual identity (`10-BRAND.md`). Motivation comes from visible progress, not game mechanics.
- Before spending money: CIPO trademark search, domains (`.com`, `.ca`), social handles, Ontario business-name registration if trading as a sole proprietor.

## Product & scope

**D-01 — Rebuild in a new repo instead of refactoring aijobforgev2** · Accepted 2026-10-17
v2 stores resumes as blobs, has trust-the-client auth, local uploads, Puppeteer, Next 14, and never built tailoring. New repo `rolerefine`; port only ideas, statuses, mammoth usage, v1 landing structure, and v1 test fixtures. v1/v2 stay archived.

**D-13 — Cover letters are in 1.0** · Accepted 2026-10-17 (supersedes "deferred to post-v1")
Competitors all have them, they share the library/job/guard machinery, and they make Pro worth paying for. Still built **after** the resume walking skeleton (Phase 9), so resumes come first as before.

**D-14 — The AI can't change titles, employers, or dates** · Accepted
The library row stays as imported. A resume version may store a display heading and dates resolved from those rows (the shared title, the spelled-out employer, or a user confirmation). The model does not invent a title, employer, or date. Older resumes omit the display fields and still read the snapshot. Null means the records disagree and nothing is chosen for them.

**D-35 — The editorial plan chooses the resume** · Accepted 2026-11-12
Canonical evidence says what may be claimed. `plan` says what should be claimed for this job. The printed resume says how it appears. Composition may reject an unsafe choice, fold one stint, and stop at the page ceiling. It does not put back an entry the plan left off, and it does not add lines to fill a page. A second model review runs only through the existing repair or revision route. Automatic length is the default: the evidence is chosen first, the classic layout is measured, and one page is kept when the second page would only be a short spill that can be cleared without dropping a lead. One page and two pages remain available as maximums.

**D-15 — Tracking is free forever; AI actions and pro outputs are paid** · Accepted
The tracker costs almost nothing to run, brings people back daily, and competes with free spreadsheets and Teal's free tracker. Monetise tailored resumes, letters, interview prep kits, DOCX, extra templates, and insights.

**D-20 — No fake social proof or unverified claims** · Accepted
Testimonials only from consented users (`Testimonial.approved`); no invented user counts, logos, or outcome stats. Founder story + live demo until real proof exists.

**D-21 — Motivation without gimmicks; reward quality, not volume** · Accepted 2026-10-17 (replaces XP/levels)
Bullet strength meter, weekly momentum streak, and ~12 milestones. No XP, levels, or badges. Streaks are weekly (not daily) and count only meaningful actions (tailored applications, follow-ups, interviews, prep). Nothing for untailored applying.

**D-23 — Ship in releases (1.0 → 1.1 → 1.2), walking skeleton first** · Accepted
The scope is now much richer, so releases plus the skeleton-first rule keep the old scope-creep failure from coming back. Nothing from a later release starts before the current one ships.

**D-11 — No server-side job-URL fetching** · Accepted
Pasting always works; scraping is brittle. The 1.2 extension captures what the user is viewing.

**D-25 — No auto-apply** · Accepted
Contradicts the quality positioning, risks users' accounts on job boards.

**D-28 — Core quality before public launch** · Accepted 2026-10-25
- Context: 1.0 is feature-complete, but an outside UX review found contradictions (skills in the resume marked "Missing", "Not assessed" filed as missing, a future deadline looking overdue, Insights tiles and funnel counting differently, completeness shown like quality), uneven mobile layouts, and an unclear finish to the resume journey.
- Choice: Phase Q in `06-ROADMAP.md`. No 1.1 features until it is done. The public launch (T13.5b) waits until the end. Updated 2026-10-26 by D-31: the private beta starts after Phase S and the production split, not midway through Q3.

**D-31 — Production split after a week of use** · Accepted 2026-10-26
- Context: T13.4b was next in line, before Q3 and Q4. The live site can stay on the shared database while more of the product is built and used.
- Choice: Build TQ.9–TQ.13 next, and use the app on your own search that same week. Phase S then turns that week's notes into feature changes and bug fixes, and finishes them before T13.4b. The private beta (T13.5a) starts after Phase S and T13.4b. Updated 2026-11-09 by D-34: the formal beta waits until Phase R.

**D-34 — Library and tailoring before the formal beta** · Accepted 2026-11-09
- Context: T13.5a was next. The library judges a bullet and does not rewrite it. Friends can use the live site while that is improved. D-23 and D-28 keep the rest of Release 1.1 closed until 1.0 ships.
- Choice: Defer T13.5a. Do not mark it done. Phase R refines the library and the tailor that already exist, starting with TR.1. A library rewrite counts against the bullet-coach allowance already in `plans.ts`. The Phase 17 coach (three suggestions, and a placeholder that blocks save) stays in 1.1. Notes from ongoing use still go in `docs/Feedback.md`.
- Consequences: the next task is TR.1. The public launch still waits for the formal beta, TQ.14, and TQ.15. Updated 2026-11-11: TR.1 and the wording store have shipped. The next task is TR.2. The formal beta still waits until Phase R is done.

**D-29 — Requirement states are computed from the current resume** · Accepted 2026-10-25
The AI's verdict at tailoring time is an input, not the answer. The match panel shows Met / Not on this resume / Needs review / Not demonstrated, recomputed as the user edits. Not on this resume is evidence left off the page. Not demonstrated is a gap in the library, and the panel does not offer a rewrite for it. The score explains its basis and never implies a hiring probability.

**D-30 — Submitted versions are frozen** · Accepted 2026-10-25
Marking a resume or letter as submitted locks it (`submittedAt`); changes go into a new version via Create revision. The record of what was sent must not drift.

## Stack

**D-02 — Next.js full-stack (server components + server actions)** · Accepted
**D-03 — Supabase Auth instead of Clerk** · Accepted (changes the earlier spec). One vendor for auth + DB.
**D-04 — Prisma 7 instead of Drizzle** · Accepted. Familiarity, readable schema, Studio. Pin `^7`.
**D-05 — Claude API; Sonnet for quality-critical calls, Haiku for analysis and coaching** · Accepted. Model ids only in `lib/ai/models.ts`.
**D-06 — `@react-pdf/renderer` for PDF, `docx` for DOCX** · Accepted (changes the earlier spec's Typst). Revisit Typst if typography becomes a selling point.
**D-08 — Don't store uploaded resume files** · Accepted.
**D-09 — Plain product vocabulary, identical in UI, code, and docs** · Accepted 2026-10-17. `Job`, `TailoredResume`, `CoverLetter`, `PrepKit`, `Entry`/`Bullet`/`Skill` ("experience library"), `TargetProfile`, `UserMilestone`.
**D-10 — Generic `Entry` table with `kind`** · Accepted.
**D-17 — Resend + React Email for email** · Accepted. Simple API, React templates, free tier fits launch.
**D-18 — PostHog (cookieless) for product analytics** · Accepted. Funnels and events without a cookie banner; no user content in events.
**D-19 — Cloudflare Turnstile + IP-hash limits for anonymous features** · Accepted. Free, privacy-friendly; no Redis needed.
**D-22 — All tables created up front, including 1.1/1.2 ones** · Accepted
Later releases add behaviour without reshaping data. Unused tables cost nothing.
**D-24 — dnd-kit + fractional ordering for the board** · Accepted. Accessible drag and drop; single-row updates on moves.

## Data & metering

**D-12 — Quotas counted from successful `AiCall` rows; bonus credits as a ledger** · Accepted
No counter drift; failures are free; full audit trail; referral/promo credits are clean.

**D-26 — Archive is a timestamp, not a status** · Accepted
Keeps the final pipeline stage for analytics while hiding the card.

## Pricing

**D-07 — Pricing** · Accepted (defaults, revisit after 100 paying users). List prices and the public founding offer are superseded by D-33.
- Free: unlimited tracking; 3 tailored resumes, 1 letter, 2 imports per month; Classic template.
- Pro: **CA$19/month** or **CA$45 per 90 days** (D-32); 80 tailored resumes, 60 letters, 20 imports per month; all templates, DOCX, Insights insights.
- **Founding members:** first 100 get 40% off for as long as they stay subscribed.
- **14-day money-back guarantee**; one-click cancel; email heads-up before each 90-day renewal; no weekly plan.
- Context: Teal+ $29/30 days or $79/90 days; Jobscan $49.95/month; Rezi $29/month; Kickresume $24/month; Huntr ~$40/month (reported Aug–Oct 2026). RoleRefine undercuts them while staying credible; the 90-day plan matches a typical search.
- Unit economics: worst-case Pro AI cost ≈ $10/month, typical ≈ $1.50; break-even on fixed costs at ~3–4 subscribers.

**D-16 — USD at launch** · Superseded by D-32.

**D-32 — Canadian dollar prices** · Accepted 2026-11-02. Display currency superseded by D-33.
- The same price points, in CAD: CA$19/month or CA$45 per 90 days. Founding members stay 40% off (CA$11.40 / CA$27).
- Display, FAQ, and JSON-LD use CAD. Anthropic cost estimates stay in USD.
- Stripe Prices have to be CAD. A USD Price would charge US dollars while the page says CA$.

**D-33 — Regional list prices** · Accepted 2026-11-05
- One Pro tier. Two billing options. No Basic, Premium, annual, or lifetime plan at this stage.
- Free is $0 in both currencies. Pro is **US$24/month** or **CA$29/month**, and **US$59** or **CA$75** every 90 days, charged up front. Monthly equivalents for comparison are US$19.67 and CA$25. That is 18% and 14% below three monthly payments. These are starting prices to test, not a claim that they are optimal.
- The two prices are fixed for each market. They are not converted from each other when the exchange rate moves. Both buy the same allowances.
- Canada starts on CAD. The United States and every other country, including a missing country, start on USD. A visible currency control can switch before checkout. The choice is stored and used for the prices, checkout, and the next visit. An active subscription renews on its Stripe Price. Cancelling stops the next renewal and Pro lasts until the paid period ends. CAD is not limited to Canadian billing addresses.
- The founding discount is not offered. Checkout does not apply the founding coupon, including for a `Lead` that already has `foundingOffer`. A subscription that already has that coupon on it in Stripe keeps whatever Stripe is charging until that subscription changes.
- Beta access, when needed, is a defined free period for selected testers. It is not a public price.
- Job analyses are a monthly allowance plus a UTC-day abuse cap: Free 30 and 10, Pro 200 and 40. Bonus credits do not raise the daily cap.
- Judge the price by contribution per visitor: first usable export, paid conversion, plan and currency choice, AI usage, refunds, and how long people stay paid. With early traffic, test one offer at a time.

## Open — default chosen, confirm or change

| ID | Question | Default | Notes |
|---|---|---|---|
| Q-1 | Name clearance | "RoleRefine" (D-27) | CIPO + USPTO search, domains, handles before T2.1. Fallbacks if blocked: Threadline, then re-run the same checks. |
| Q-3 | Dark mode at launch | Light by default, dark toggle in the app | Marketing site light only. |
| Q-4 | Google sign-in at launch | Yes | Needs a Google Cloud OAuth client. |
| Q-5 | Supabase region | Canada (ca-central-1) | Production database address resolves to AWS ca-central-1, checked November 11, 2026. Vercel functions are `iad1` (Washington, D.C.), so the app is not Canadian-only. |
| Q-6 | Free trial of Pro? | No (generous Free tier + 14-day refund instead) | Revisit if conversion < 2%. |
| Q-7 | Founding discount size | Not offered (D-33) | Checkout charges the list price. The coupon is not applied. |
