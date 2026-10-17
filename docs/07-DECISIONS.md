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
Content entries store only a `ref`; header data is joined from the snapshot at render time.

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

**D-07 — Pricing** · Accepted (defaults, revisit after 100 paying users)
- Free: unlimited tracking; 3 tailored resumes, 1 letter, 2 imports per month; Classic template.
- Pro: **US$19/month** or **US$45 per 90 days**; 80 tailored resumes, 60 letters, 20 imports per month; all templates, DOCX, Insights insights.
- **Founding members:** first 100 get 40% off for as long as they stay subscribed.
- **14-day money-back guarantee**; one-click cancel; email heads-up before each 90-day renewal; no weekly plan.
- Context: Teal+ $29/30 days or $79/90 days; Jobscan $49.95/month; Rezi $29/month; Kickresume $24/month; Huntr ~$40/month (reported Aug–Oct 2026). RoleRefine undercuts them while staying credible; the 90-day plan matches a typical search.
- Unit economics: worst-case Pro AI cost ≈ $10/month, typical ≈ $1.50; break-even on fixed costs at ~3–4 subscribers.

**D-16 — USD at launch** · Accepted. Revisit CAD / local currency in 1.2.

## Open — default chosen, confirm or change

| ID | Question | Default | Notes |
|---|---|---|---|
| Q-1 | Name clearance | "RoleRefine" (D-27) | CIPO + USPTO search, domains, handles before T2.1. Fallbacks if blocked: Threadline, then re-run the same checks. |
| Q-3 | Dark mode at launch | Light by default, dark toggle in the app | Marketing site light only. |
| Q-4 | Google sign-in at launch | Yes | Needs a Google Cloud OAuth client. |
| Q-5 | Supabase region | Canada if offered | Privacy story for Canadian users. |
| Q-6 | Free trial of Pro? | No (generous Free tier + 14-day refund instead) | Revisit if conversion < 2%. |
| Q-7 | Founding discount size | 40% forever, first 100 | Could be 50% for the first 25 beta users. |
