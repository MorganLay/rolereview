# 01 — Product

> Source of truth for **what** we're building, **in which release**, and **what we're not building**. A feature that isn't listed under a release doesn't get built. Scope changes go through `07-DECISIONS.md` first. Brand and visual identity: `10-BRAND.md`.

## One-liner

**RoleRefine** is a job-search workspace that tailors your resume and cover letter to each job **using only your real experience**, then tracks every application through to the offer.

Tagline: **"Tailored resumes. Every line traced to you."**

## The problem

- Tailored applications get more callbacks, but tailoring takes 30–60 minutes per job, so most people send the same resume everywhere.
- Generic AI chat tools make up experience, lose formatting, and forget your history between sessions.
- Resume builders and job trackers are separate tools. A job search is long and discouraging, with little sense of progress.

## What makes RoleRefine different (the 4 pillars)

1. **Truthful by design.** Your experience lives in a structured library. Every tailored bullet cites its source, and a code guard reverts anything that adds facts. The AI can't change titles, employers, or dates. *"Other AI tools improvise. RoleRefine cites its sources."*
2. **Explainable matching.** A requirement-by-requirement match report (met / partial / missing, with evidence) and live keyword coverage, instead of a black-box score.
3. **One workspace for the whole search.** Experience library → tailored resume and cover letter → jobs board → interviews, contacts, reminders → offer, with personal insights on what's working.
4. **Progress you can see.** A bullet strength meter, a weekly momentum streak, milestones, and insights make a long search feel like it's moving, without gimmicks, and they reward quality over volume.

## Target users

| Segment | Why they care | Where to find them |
|---|---|---|
| **Primary:** early/mid-career job seekers applying to 10–100 roles: new grads, juniors, career changers, analysts, tech and tech-adjacent roles | Tailoring at volume; want an edge they can trust | Reddit (r/resumes, r/jobs, r/cscareerquestions), LinkedIn, university career centres |
| **Secondary:** Canadian job seekers, incl. federal public service applicants | Canadian context; GC Jobs screening questions (Release 1.2) | r/PublicServiceCanada, r/canadajobs, Ottawa networks |
| **Channel partners (later):** career counsellors, college career centres, employment agencies | A credible tool they can recommend | Direct outreach |
| **Tertiary:** anyone tired of their tracker spreadsheet | The free jobs board is the hook | SEO ("job application tracker"), free tools |

## Release plan

| Release | Theme | Goal | Est. effort |
|---|---|---|---|
| **1.0 Launch** | Tailor + track + get paid | A complete, polished product worth paying for, with a strong marketing site | ~135 h |
| **1.1 Momentum** | Retention + growth | Email reminders and digests, interview prep, bullet coach, streaks and milestones, target profiles, referrals, guides | ~50 h |
| **1.2 Expansion** | Reach | Chrome extension, Canadian federal mode, offer comparison, annual plan | ~45 h |

Inside 1.0 the **walking skeleton** (library → job → tailored resume → PDF) is built first, so you can use it for your own applications while the rest gets built.

---

## Feature catalogue

**F** = Free plan · **P** = Pro only · **F/P** = both, with Pro getting higher limits.

### A. Experience library

| # | Feature | Release | Plan |
|---|---|---|---|
| A1 | Import a resume (PDF, DOCX, paste): AI extracts entries, bullets, and skills; you review, then save | 1.0 | F/P |
| A2 | Manual editing: profile/contact, entries (experience, projects, education, certifications, volunteer, other), bullets, skills; add, edit, delete, reorder | 1.0 | F |
| A3 | **Bullet strength meter** (deterministic, instant): action verb, metric, length, no first person, no filler, specificity → Weak / Fair / Good / Strong / Excellent, with the specific fix to reach the next level | 1.0 | F |
| A4 | Library completeness card: five checks, plus a separate bullet-strength summary and the weakest bullets | 1.0 | F |
| A5 | **Bullet coach** (AI): stronger rewrites with `[placeholders]` for metrics you fill in; never invents numbers | 1.1 | F/P |
| A6 | **Target profiles**: saved presets (e.g., "Data Analyst", "Frontend Developer") with preferred entries, skills, and emphasis, chosen when tailoring | 1.1 | F (1) / P (unlimited) |

### B. Jobs

| # | Feature | Release | Plan |
|---|---|---|---|
| B1 | Add a job by pasting the posting; AI analysis extracts title, company, location, seniority, requirements (must/nice), keywords, work mode, salary, reference number | 1.0 | F/P |
| B2 | Job details: URL, reference/competition number, source, work mode, employment type, salary range, priority (1–5), deadline, notes | 1.0 | F |
| B3 | Retry analysis; edit any extracted field | 1.0 | F |
| B4 | Chrome extension: save a posting from any job board in one click | 1.2 | F |

### C. Tailoring

| # | Feature | Release | Plan |
|---|---|---|---|
| C1 | **Tailor resume**: AI selects and rewrites from your library only; summary, sections, skills, and a match report. Options: length (1/2 pages), emphasis, target profile (1.1) | 1.0 | F/P |
| C2 | Fabrication guard (code-level validation; reverts bad bullets) | 1.0 | F |
| C3 | Resume workspace: inline edit, include toggles for every library entry and bullet, reorder, "show source", restored-original badges, autosave | 1.0 | F |
| C4 | **Match score** (requirement report with evidence links) + **live keyword coverage** with missing-keyword chips | 1.0 | F |
| C5 | "Add to library" from a missing requirement (quick-add bullet) | 1.0 | F |
| C6 | Versions (v1, v2…); mark which version you **submitted** | 1.0 | F |
| C7 | **Cover letter**: grounded in your library, the posting, and your own "why this company" notes; tone and length options; editable; source refs | 1.0 | F (1/mo) / P |
| C8 | Export **PDF**: 3 ATS-safe templates. Classic (Free); Modern and Compact (Pro) | 1.0 | F/P |
| C9 | Export **DOCX** (resume + cover letter) | 1.0 | P |
| C10 | Copy as plain text (for application forms) | 1.0 | F |
| C11 | Rate a tailored resume or letter 👍/👎 with a reason | 1.0 | F |
| C12 | **Interview prep**: 10–15 likely questions, why they're asked, STAR outlines from your library with source refs, your notes, practised checkmarks | 1.1 | F (1/mo) / P |

### D. Jobs board (application tracking)

| # | Feature | Release | Plan |
|---|---|---|---|
| D1 | **Board view** (drag between stages) and **list view** (sortable, filterable table) | 1.0 | F |
| D2 | Stages: Saved → Applied → Screening → Interviewing → Offer → Accepted; closed: Rejected, Withdrawn, No response. Archive any job. | 1.0 | F |
| D3 | **Timeline** per job: automatic events (created, status changes, tailored, applied, interviews) + manual entries (follow-up sent, call, email, note) | 1.0 | F |
| D4 | **Interviews**: rounds, type, date/time, duration, link/location, interviewers, prep notes, outcome, reflection | 1.0 | F |
| D5 | **Contacts**: recruiters, hiring managers, referrers, interviewers; linked to jobs with a role; last-contacted date | 1.0 | F |
| D6 | **Reminders**: manual + automatic (follow up 7 days after applying, thank-you after an interview, deadline in 3 days, interview tomorrow); "Today" list on the dashboard | 1.0 | F |
| D7 | **Offer details**: base, currency, period, bonus, equity, benefits, start date, respond-by, decision | 1.0 | F |
| D8 | "No response?" nudge after 30 days with no change since Applied | 1.0 | F |
| D9 | Email reminders + weekly summary email | 1.1 | F |
| D10 | Offer comparison (side by side) | 1.2 | P |

### E. Insights (personal analytics)

| # | Feature | Release | Plan |
|---|---|---|---|
| E1 | Funnel: Saved → Applied → Response → Interview → Offer, with conversion rates | 1.0 | F |
| E2 | Applications per week; response rate; median days to first response | 1.0 | F |
| E3 | **What's working**: interview rate by source; by match-score band (<50, 50–74, 75+); tailored vs not | 1.0 | P |
| E4 | Activity history and streak calendar | 1.1 | F |
| E5 | Shareable search summary card (e.g., "32 applications · 6 interviews · 1 offer") | 1.2 | F |

### F. Momentum (motivation without gimmicks)

| # | Feature | Release | Plan |
|---|---|---|---|
| F1 | Bullet strength meter (A3) | 1.0 | F |
| F2 | Getting-started checklist (4 steps) | 1.0 | F |
| F3 | Offer celebration when a job reaches Accepted (subtle, reduced-motion aware) | 1.0 | F |
| F4 | **Weekly momentum streak**: ≥ 1 meaningful action per week (tailored application, follow-up, interview, prep). Weekly, not daily, to avoid burnout. | 1.1 | F |
| F5 | **Milestones** (~12, e.g., "First tailored resume", "10 tailored applications", "First interview", "Offer received") with a quiet toast | 1.1 | F |

### G. Account, billing, growth

| # | Feature | Release | Plan |
|---|---|---|---|
| G1 | Magic link + Google sign-in | 1.0 | — |
| G2 | Free and Pro: monthly and 90-day billing, founding-member coupon, Stripe Checkout + Customer Portal | 1.0 | — |
| G3 | Usage meter + upgrade prompts at limits | 1.0 | — |
| G4 | Settings: profile, timezone, notifications, marketing consent, data export (JSON), delete account | 1.0 | — |
| G5 | In-app feedback (bug/idea/praise) + opt-in testimonial request after an offer | 1.0 | — |
| G6 | **Invite a friend**: both get +5 tailored resumes; the inviter gets a free month when the friend upgrades | 1.1 | — |
| G7 | Admin dashboard (signups, activation, conversion, AI cost, MRR) | 1.1 | — |
| G8 | Annual plan, student discount, CAD pricing | 1.2 | — |

### H. Marketing site (details in `09-MARKETING.md`)

| # | Feature | Release |
|---|---|---|
| H1 | **Pre-launch waitlist page** with founding-member offer (live within the first 2 weeks of building) | 1.0 (early) |
| H2 | Homepage with an **interactive demo** (no sign-up, no AI cost) and one clear call to action | 1.0 |
| H3 | Pricing page (monthly/90-day toggle, comparison table, FAQ, guarantee) | 1.0 |
| H4 | **Free tools**: ATS Keyword Checker (AI, rate-limited, captcha) and Bullet Strength Checker (deterministic) | 1.0 |
| H5 | About (founder story), Privacy, Terms, Contact, Changelog | 1.0 |
| H6 | SEO foundation: metadata, OG images, sitemap, structured data | 1.0 |
| H7 | Guides (MDX), audience pages (/for/new-grads, /for/career-changers, /for/canadian-public-service), comparison pages | 1.1 |

### Not building (any release, unless a decision says otherwise)

- **Auto-apply / mass-apply bots.** They contradict the quality positioning and get accounts banned.
- Scraping job sites or fetching posting URLs server-side (the 1.2 extension saves what the user is viewing).
- Fake or AI-generated testimonials, logos, or user counts.
- Photos on resumes; multi-column "creative" templates that break ATS parsing.
- XP, levels, badges-for-everything, or anything that rewards application volume.
- Teams/enterprise seats (channel partners get a referral link, not seats, in 1.x).
- Native mobile apps (the web app must work well on phones).
- Languages other than English in 1.0 (French is a strong 1.2+ candidate for Canada).

---

## Product vocabulary (UI = code)

One vocabulary everywhere: UI, code, and docs. UI strings live in `src/copy/strings.ts`.

| UI term | Code | Meaning |
|---|---|---|
| Dashboard | `/dashboard` | Home after sign-in |
| Experience library ("Library" in nav) | `Entry`, `Bullet`, `Skill` + profile fields on `User`; `/library` | Master record of your experience |
| Entry / Bullet / Skill | `Entry`, `Bullet`, `Skill` | A role, project, degree… / one accomplishment line / a skill |
| Bullet strength | `bulletStrength()` → Weak, Fair, Good, Strong, Excellent | Deterministic quality meter |
| Target profile | `TargetProfile` (1.1) | Saved tailoring preset |
| Job | `Job`; `/jobs/[jobId]` | A posting you're pursuing |
| Jobs board | `/jobs` (board + list views) | Application tracker |
| Tailor (verb) / Tailored resume | `tailorResume()`, `TailoredResume` | Tailor a resume / one tailored version |
| Cover letter | `CoverLetter` | Tailored cover letter |
| Interview prep | `PrepKit` (1.1) | Questions + STAR outlines for a job |
| Match score | `TailoredResume.matchScore` | Requirement match 0–100 |
| Keyword coverage | computed live | % of posting keywords in the current resume |
| Insights | `/insights` | Personal analytics |
| Momentum streak / Milestones | derived / `UserMilestone` (1.1) | Weekly consistency / meaningful firsts |
| Invite a friend | `Referral` (1.1) | Referral program |
| Usage | quota from `AiCall` | AI actions left this month |

Tone: plain, specific, encouraging. See `10-BRAND.md` → Voice.

---

## Pricing model

### Principles
1. **Tracking is free forever.** The board, timeline, interviews, contacts, reminders, and basic Insights cost almost nothing to run and bring people back. AI actions and pro outputs are what people pay for.
2. **Priced for a job search, not forever.** Searches last 1–4 months. Offer monthly and a cheaper 90-day plan, one-click cancel, a reminder email before each 90-day renewal, and a "Congratulations on the offer!" cancel flow that asks for a testimonial.
3. **Undercut the big names, honestly.** No weekly-plan traps, no trials that silently convert at a higher price.

### Competitor anchors (as reported Aug–Oct 2026; re-check before launch)

| Product | Paid price |
|---|---|
| Teal+ | $29 / 30 days, $79 / 90 days (also weekly) |
| Jobscan | $49.95 / month, $89.95 / quarter |
| Rezi Pro | $29 / month ($149 lifetime) |
| Kickresume | $24 / month regular |
| Huntr Pro | ~$40 / month |

### Plans (defaults; see D-07)

| | **Free** | **Pro** |
|---|---|---|
| Price | $0 | **US$19 / month** or **US$45 / 90 days** (= $15/mo) |
| Founding members (first 100) | — | **40% off for as long as they stay subscribed** |
| Tailored resumes / month | 3 | 80 (fair use) |
| Cover letters / month | 1 | 60 |
| Resume imports / month | 2 | 20 |
| Job analyses / day | 10 | 60 |
| Interview prep kits / month (1.1) | 1 | 30 |
| Bullet coach / month (1.1) | 10 | 300 |
| PDF templates | Classic | Classic, Modern, Compact |
| DOCX export | — | ✓ |
| Jobs board, timeline, interviews, contacts, reminders | Unlimited | Unlimited |
| Insights | Funnel + weekly stats | + "What's working" |
| Target profiles (1.1) | 1 | Unlimited |
| Guarantee | — | 14-day money-back |

- All limits live in `src/features/billing/plans.ts`. A failed AI call never uses up an allowance.
- **Bonus credits** (referrals, promos, support) top up limits after the monthly allowance runs out.
- USD at launch; CAD in 1.2.

### Unit economics (estimates; verify with `AiCall` after the first 100 users)
- AI cost ≈ tailored resume $0.06 · cover letter $0.04 · import $0.05 · prep kit $0.05 · job analysis <$0.01 · bullet coach <$0.005.
- Worst-case Pro user ≈ $10/month AI cost; typical ≈ $1.50.
- Fixed costs ≈ Vercel Pro $20 + Supabase Pro $25 + domain ≈ **$50/month → break-even at ~3–4 Pro subscribers.**

---

## Success metrics

| Stage | Metric | Target (first 3 months) |
|---|---|---|
| Acquisition | Visitor → sign-up (homepage) | 5–8% |
| Acquisition | Waitlist sign-ups before launch | 300+ |
| Activation | Sign-up → first PDF exported | ≥ 40% |
| Activation | Median time to first PDF | < 10 min |
| Retention | Users with ≥ 3 jobs in first 14 days | ≥ 30% |
| Revenue | Free → Pro (within 30 days) | 3–5% |
| Quality | Guard reverts per tailored resume | < 0.5 |
| Quality | 👍 rate | ≥ 80% |
| Cost | AI cost per Pro user / month | < $3 typical |
| North star | Tailored applications sent per week | ↑ week over week |
