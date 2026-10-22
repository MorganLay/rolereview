# 09 — Homepage & Marketing

> Positioning, the homepage section by section (with draft copy), other marketing pages, free tools, SEO and content, launch plan, lifecycle email, referrals, and measurement. Visual identity and voice: `10-BRAND.md`. Copy here is a **first draft**: rewrite it in your own voice, but keep the structure and the single call to action.

## Honesty rules (non-negotiable)

- **No fake testimonials, user counts, star ratings, or "as seen in" logos.** Social proof only from real, consented users (`Testimonial.approved`). Until then: the founder story and the live demo.
- **No unverified outcome claims** ("3× more interviews"). Describe what the product does ("every bullet cites its source"); later, publish real aggregate stats with sample sizes.
- Competitor comparisons: factual, dated, sourced; re-check before publishing.
- Privacy statements must match reality (check Anthropic's current API data terms before writing anything about AI training).
- Marketing email only with **express consent** (CASL): unticked checkbox, stored wording, unsubscribe link in every message.

## Messaging pillars

| Pillar | Headline form | Proof in product |
|---|---|---|
| Truthful | "Tailored, not invented." | Source refs, fabrication guard, "show source" |
| Fast | "A tailored resume in about a minute." | Tailoring time (only claim the measured median) |
| Explainable | "See exactly how you match." | Match score report, live keyword coverage |
| Complete | "From posting to offer, in one place." | Jobs board, timeline, interviews, contacts, reminders, Insights |
| Progress | "Progress you can see." | Bullet strength, weekly momentum, milestones |
| Fair | "Priced for a job search, not forever." | Free tracker, 90-day plan, one-click cancel, 14-day refund |

---

## Homepage (`/`) — section by section

The waitlist form stays on `/waitlist`. `/` is the marketing homepage.

**One primary action everywhere: "Tailor your first resume — free"** ("Start free" in tight spaces) → `/sign-in?next=/library/import`. Signed-in visitors see "Go to dashboard". Secondary action: "Try the live demo" (scrolls to the demo). Never more than two buttons in one block.

### 0. Announcement bar (optional, dismissible)
"Founding members get 40% off Pro for as long as they stay. 63 of 100 spots left →" (live count from Stripe coupon redemptions; remove when gone).

### 1. Header (sticky)
Wordmark · How it works · Features · Pricing · Free tools ▾ (ATS Keyword Checker, Bullet Strength Checker) · Guides (1.1). Right: Sign in · **[Start free]**. Mobile: menu, CTA stays visible.

### 2. Hero
- **Eyebrow:** "AI resume tailoring you can trust"
- **H1 (serif):** "Refine your resume for every role."
- **Sub:** "Import your resume once. Paste any job posting. RoleRefine tailors your resume and cover letter to what the role asks for, using only your real experience, and keeps every application organized through to the offer."
- **Buttons:** **[Tailor your first resume — free]** [Try the live demo ↓]
- **Microcopy:** "No credit card · 3 free tailored resumes every month · Cancel Pro anytime"
- **Visual:** a calm ~8 s product loop on a paper card: library bullets slide into a resume page → three requirement rows tick ✓ → the match score counts 52 → 86. Built from real UI, not stock art.

### 3. Trust strip (4 short claims with icons)
"ATS-friendly: single column, real text" · "Every line traced to your experience" · "Cancel anytime, 14-day refund" · "Built in Ottawa 🇨🇦"

### 4. The problem (3 cards)
H2: "Tailoring works. Doing it 40 times doesn't."
1. **"Rewriting takes too long."** Bullets, keywords, formatting: tailoring can take most of an hour per application.
2. **"Generic AI makes things up."** A tool that invents a certification can cost you the job.
3. **"Spreadsheets lose track."** Who did you email? When was that follow-up due?

### 5. How it works (3 steps with small UI visuals)
H2: "From posting to tailored resume in three steps"
1. **Build your experience library.** "Upload your resume once. We organize it into reusable entries, bullets, and skills."
2. **Add a job.** "Paste the posting. See its must-haves, nice-to-haves, and keywords in seconds."
3. **Tailor and apply.** "Get a tailored resume and cover letter built from your library, with a report showing exactly how you match. Edit, export, apply."
CTA: **[Tailor your first resume — free]**

### 6. Interactive demo (the conversion engine)
H2: "Try it. No sign-up."
- **Pick a sample candidate** (3 fake personas: "New CS grad" from `cs-grad`, "Data analyst" from `bi-analyst`, "Career changer from retail" from `retail-changer`) × **Pick a job** (3 sample postings: `junior-dev` Pebble Systems, `data-analyst` Lakeshore Mutual, `frontend` Kindling Studio).
- Click **[Tailor]** → the real resume workspace components in read-only demo mode reveal the result: bullets appear, match score counts up, requirements tick in. Hover a bullet to see its source. Toggle a bullet off and keyword coverage drops live.
- **Zero AI cost:** all 9 combinations are pre-generated with the real pipeline and stored as fixtures in `src/features/marketing/demo/`.
- Below: "This one was pre-generated. Yours takes about a minute." → **[Now try it with your resume →]**

### 7. "Tailored, not invented" (the differentiator)
H2: "Other AI tools improvise. RoleRefine cites its sources."
- **Left ("Generic AI"):** a bullet with an invented metric and tool, highlighted in clay: "*Led a team of 12 engineers migrating to Kubernetes, cutting costs 40%.*" Caption: "You never led a team. There was no Kubernetes."
- **Right ("RoleRefine"):** the honest tailored bullet with a source chip `Source: Junior Analyst, bullet 2`, plus a "restored original" example. Caption: "Rephrased for the role. Every fact is yours."
- Small print: "Every tailored line is checked against your library before you see it."

### 8. Feature grid (6 tiles: screenshot, title, one sentence)
1. **Match score:** "Requirement-by-requirement, with the evidence for each."
2. **Live keyword coverage:** "See your keyword match update as you edit."
3. **Cover letters that sound like you:** "Grounded in your experience and your own reasons for applying."
4. **Jobs board:** "Drag applications from Saved to Offer, with timeline, contacts, and interviews on every card."
5. **Never miss a follow-up:** "Automatic reminders after you apply and after every interview."
6. **Insights:** "Your response rate, which sources work, and whether tailoring is paying off."

### 9. Progress you can see
H2: "A long search, with visible progress."
Visual: a bullet's strength meter moving from **Fair** to **Strong** as a metric is added; the momentum streak; two milestones.
Copy: "Stronger bullets, tailored applications, and timely follow-ups all show up as progress. Sending 200 identical resumes doesn't."
(Before 1.1 ships, show only the bullet strength meter.)

### 10. Social proof
- **Before real testimonials:** a short founder note with a photo: "I built RoleRefine during my own job search in Ottawa, after rewriting the same resume one too many times. It's the tool I wanted: honest, fast, and organized. — Morgan, founder." (Keep it true to your story.)
- **After the beta:** 3 real testimonials (`Testimonial` where `approved && featured`).
- **Later:** real aggregate stats from opted-in data with sample sizes, only if true.

### 11. Pricing preview
Toggle **Monthly / 90-day (save 21%)**. Free and Pro cards with the 5 most important differences → "Compare all features" (`/pricing`). Guarantee line: "14-day money-back guarantee. Cancel in one click." Values come from `plans.ts`.

### 12. FAQ (accordion + FAQPage structured data)
1. Will RoleRefine make things up on my resume? → No; explain source refs and the guard.
2. Is it ATS-friendly? → Single column, real text, standard headings; PDF and DOCX.
3. What happens to my data? → What's stored, that files aren't kept, AI processing (described accurately), export and delete anytime.
4. Do I need a resume to start? → No; build your library by hand.
5. Does it write cover letters? → Yes, from your experience plus your own reasons.
6. What does Free include? → Unlimited tracking + 3 tailored resumes a month.
7. Can I cancel anytime? → Yes, one click; we email you before 90-day renewals.
8. Does it work for Canadian government jobs? → Tailoring yes; dedicated screening-question support only once it's on the roadmap with a date.
9. Is it only for tech jobs? → It works for any job with a written posting.

### 13. Final CTA band
H2 (serif): "Your next role is waiting." Sub: "Import your resume and tailor your first application in minutes." **[Tailor your first resume — free]**

### 14. Footer
Product (Features, Pricing, Demo, Changelog) · Free tools · Guides (1.1) · Compare (1.1) · Company (About, Contact) · Legal (Privacy, Terms) · newsletter signup (email + CASL checkbox → `Lead`) · socials · "© RoleRefine · Made in Ottawa".

### Homepage quality bar
- Lighthouse mobile: Performance ≥ 90, Accessibility ≥ 95, SEO 100; LCP < 2.5 s.
- Works at 375 px; tap targets ≥ 44 px; CTA visible without scrolling on mobile.
- One H1; logical headings; alt text; reduced motion respected.
- Events: `cta_click {location}`, `demo_run {persona, job}`, `pricing_toggle`, `faq_open {q}`.

---

## Other marketing pages

| Route | Purpose | Release |
|---|---|---|
| `/pricing` | Full comparison table from `plans.ts`, monthly/90-day toggle, founding offer, guarantee, billing FAQ, "Why we don't offer a weekly plan" | 1.0 |
| `/demo` | The interactive demo as a shareable standalone page | 1.0 |
| `/tools/ats-keyword-checker` | Free tool | 1.0 |
| `/tools/bullet-strength` | Free tool | 1.0 |
| `/about` | Founder story, why truthful-by-design, contact | 1.0 |
| `/changelog` | MDX entries; shows momentum | 1.0 |
| `/privacy`, `/terms` | Plain-language legal (PIPEDA-aware privacy; CASL consent wording) | 1.0 |
| `/waitlist` | Pre-launch waitlist. Stays at this URL after the homepage ships. | 1.0 early |
| `/guides/[slug]` | SEO guides (MDX) | 1.1 |
| `/for/new-grads`, `/for/career-changers`, `/for/canadian-public-service` | Audience landing pages; demo preset to the matching persona | 1.1 |
| `/compare/teal`, `/compare/jobscan`, `/compare/chatgpt` | Honest, dated, sourced comparisons | 1.1 |

Every page: unique title and meta description, OG image from the brand template, canonical URL, header CTA.

## Free tools (lead magnets + SEO)

### ATS Keyword Checker (`/tools/ats-keyword-checker`)
- Inputs: job posting + resume text (paste). No account.
- Runs the job analysis (Haiku) for keywords, then the same `keywordCoverage()` used in the app.
- Output: coverage %, matched and missing keyword chips, top 5 must-have requirements. CTA: "RoleRefine can tailor your resume to include the ones you actually have → **[Tailor it free]**". Optional "Email me this report" (→ `Lead` with consent checkbox).
- Abuse control: Turnstile + 3 runs per IP-hash per day (`FreeToolRun`); logged as `AiCall(kind = FREE_TOOL, userId = null)`; ≈ $0.002 per run. Inputs never stored.

### Bullet Strength Checker (`/tools/bullet-strength`)
- Paste up to 10 bullets → the same deterministic `bulletStrength()`: level (Weak → Excellent) and specific fixes ("add a number", "start with an action verb", "cut 'responsible for'").
- No AI, no cost, no limit. CTA: "Check every bullet in your resume → **[Start free]**".

## Pre-launch waitlist (live in the first two weeks of building)

- Page: hero (same H1), a 20-second demo GIF, 3 benefit bullets, email form with the **founding-member promise** ("First 100 Pro members get 40% off for as long as they stay"), CASL checkbox (unticked): "Email me product updates and launch news. Unsubscribe anytime."
- Stores `Lead { source: "waitlist", foundingOffer: true, utm*, marketingConsentAt, consentText }`.
- Thank-you state: share link with `?ref=waitlist-<shortid>`; "invite 3 friends for early beta access".

## SEO & content

**Technical (1.0):** `sitemap.ts`, `robots.ts`, metadata everywhere, canonical URLs, JSON-LD (`SoftwareApplication` with offers on `/` and `/pricing`, `FAQPage`, `Article` on guides), static rendering for marketing routes.

**Content plan (1.1, ~2 guides/week for 8 weeks).** Each answers one search intent with a worked example and ends with a free tool or the demo:
1. How to tailor your resume to a job description (with example)
2. ATS-friendly resume format: what actually matters
3. Resume keywords: how to find and use them honestly
4. Writing resume bullets with metrics (and what to do without numbers)
5. How to answer GC Jobs screening questions (Canadian federal niche)
6. Cover letter structure that works
7. Job application tracker: spreadsheet vs app
8. Following up after applying: timing and templates
9. STAR interview answers with examples
10. Career change resume: translating service experience into new roles
11. New grad resume with little experience
12. What your response rate tells you

## Launch plan

| When | Action |
|---|---|
| Weeks 1–2 of build | Waitlist live. **Build in public**: weekly LinkedIn posts (progress clips, the "tailored, not invented" idea, lessons learned). LinkedIn fits a professional brand better than X or TikTok. |
| During build | Helpful (not promotional) participation in r/resumes, r/jobs, r/cscareerquestions, r/careerguidance, r/canadajobs, r/PublicServiceCanada. **Read each subreddit's self-promotion rules first.** |
| M3 (walking skeleton) | **Private beta**: 20–50 people from the waitlist, friends, Carleton alumni and career-centre contacts. Free Pro during the beta. Weekly feedback form; 15-minute calls with 5 users; ask for consented testimonials when someone lands an interview. |
| 1.0 ready | **Launch week:** Product Hunt (Tue–Thu; gallery, maker comment, demo video), Show HN ("Show HN: A resume tailor that can't invent experience"), LinkedIn launch post, Reddit where allowed, waitlist email (founding offer, 7-day countdown). |
| Ongoing | Short demo videos (LinkedIn, YouTube Shorts): before/after tailoring, "generic AI vs RoleRefine". Outreach to college/university career centres and employment counsellors (free Pro for advisors to demo). |

## Lifecycle email (Resend; 1.1 unless noted)

| Email | Trigger | Consent basis |
|---|---|---|
| Magic link | Sign-in | Transactional (Supabase) |
| Welcome + "build your library" | Sign-up (1.0) | Transactional |
| "Your first tailored resume is one paste away" | 24 h after sign-up with a library but no job | Transactional/onboarding |
| Reminder digest | Daily 8:00 local when reminders are due | Transactional (user setting) |
| Weekly summary | Monday 8:00 local | User setting (`weeklyDigestEnabled`) |
| Limit reached | First time a limit is hit in a month | Transactional |
| Renewal heads-up | 3 days before a 90-day renewal | Transactional |
| "Congratulations on the offer" | Job → ACCEPTED | Transactional: offer pause/cancel, ask for a testimonial |
| Product updates | Monthly | **Marketing: requires `marketingConsentAt`** |
| Win-back | 30 days inactive with active jobs | Marketing consent |

Every email: wordmark, one CTA, footer with preferences/unsubscribe and mailing address (CASL). `EmailLog` prevents duplicates.

## Referral program (1.1): "Invite a friend"

- Every user has a `referralCode`; link `rolerefine.com/?ref=CODE` (30-day cookie → `Referral` on sign-up).
- Both get **+5 tailored resumes** (`BonusCredit`, reason REFERRAL, 90-day expiry) once the friend exports their first PDF (`ACTIVATED`).
- When the friend upgrades (`CONVERTED`), the inviter gets **1 free month**.
- Surfaces: Settings → Invite, the post-export success dialog ("Know someone who's job hunting?"), the weekly summary footer.

## Measurement

**PostHog** in cookieless mode. **No resume or posting content in events**, only ids, counts, enums.

Core events: `signup {source, utm}`, `import_completed {method}`, `job_created`, `resume_tailored {matchScore, reverts}`, `resume_exported {format, template}`, `letter_completed`, `job_status_changed {from, to}`, `upgrade_clicked {location}`, `checkout_completed {interval}`, `cta_click {location}`, `demo_run`, `tool_run {tool}`, `lead_captured {source}`.

**Funnels (weekly):** Visitor → Sign-up → Library built → First tailored resume → First export → Pro. Free tool → Lead → Sign-up.

**North-star metric:** *tailored applications sent per week* (jobs moved to Applied with a submitted tailored resume).
