# 03 — Architecture

> **How** it's built: stack, folder layout, patterns every feature follows, auth, payments, email, jobs, security, deployment. Cursor rules in `.cursor/rules/` enforce these patterns.

## Why a fresh repo (not refactoring aijobforgev2)

| v2 problem | Why it forces a rewrite |
|---|---|
| `Document` stores a resume as one text blob or uploaded file | Tailoring needs structured, addressable items. The schema changes completely. |
| Homemade JWT auth; `/api/generate` trusts `userId` from the body; no route protection | Replacing auth touches every route. |
| Uploads written to local `uploads/` folder | Doesn't work on serverless. |
| Puppeteer for PDFs | Heavy and slow on serverless. |
| Next 14 | Next 16 changed async request APIs and replaced `middleware.ts` with `proxy.ts`. |
| Only cover letters existed | The core feature didn't exist. |

**Port from v2/v1:** the job-analysis idea (`aijobforgev2/src/app/api/generate/route.ts`), application statuses, `mammoth` DOCX extraction, `JobApplication` tracker ideas, v1's landing page section structure (`AiRoleRefinev1/frontend-remix/app/components/Homepage/*`), and v1's test resumes as the first eval fixtures.

## Stack

Pin major versions. Versions checked on npm in October 2026.

| Concern | Choice | Version | Release |
|---|---|---|---|
| Framework | Next.js App Router, TypeScript strict | 16.x | 1.0 |
| UI | React 19, Tailwind CSS 4, shadcn/ui, lucide icons | — | 1.0 |
| Auth | Supabase Auth via `@supabase/ssr` (magic link + Google) | 0.12.x | 1.0 |
| Database | Supabase Postgres + **Prisma 7** (`prisma-client` generator, `@prisma/adapter-pg`) | ^7 | 1.0 |
| Validation | Zod | 4.x | 1.0 |
| AI | `@anthropic-ai/sdk` (structured outputs, native PDF input) | 0.13x | 1.0 |
| Payments | Stripe (Checkout, Customer Portal, webhooks, coupons) | 23.x | 1.0 |
| PDF export | `@react-pdf/renderer` | 4.x | 1.0 |
| DOCX export | `docx` | 9.x | 1.0 |
| DOCX import | `mammoth` | 1.x | 1.0 |
| Board drag & drop | `@dnd-kit/core` + `@dnd-kit/sortable`; fractional ordering via `fractional-indexing` | — | 1.0 |
| Charts (Insights, admin) | Recharts (shadcn chart wrappers) | — | 1.0 |
| Email | Resend + React Email templates | — | 1.0 (welcome), 1.1 (rest) |
| Product analytics | PostHog (`posthog-js`, `posthog-node`), cookieless mode | — | 1.0 |
| Bot protection | Cloudflare Turnstile (free tools, waitlist form) | — | 1.0 |
| Scheduled jobs | Vercel Cron → `/api/cron/*` route handlers | — | 1.1 |
| Content | MDX (`@next/mdx`) for changelog (1.0) and guides (1.1) | — | 1.0 |
| OG images | `next/og` `ImageResponse` | — | 1.0 |
| IDs | `nanoid` for content item ids and referral codes | — | 1.0 |
| Tests | Vitest 5, Playwright 1.6x | — | 1.0 |
| Hosting | Vercel (**Hobby is non-commercial; switch to Pro before charging**) | — | 1.0 |

Deliberately not used: Clerk, Redis/queues, file storage, tRPC/React Query, a CMS.

## Folder structure

```
rolerefine/
├── AGENTS.md  ·  .cursor/rules/*.mdc  ·  docs/  ·  .env.example
├── prisma/{schema.prisma, migrations/, seed.ts}   ·  prisma.config.ts
├── content/{changelog/*.mdx, guides/*.mdx}
├── src/
│   ├── proxy.ts                         # Supabase session refresh + signed-out redirects + first-touch UTM/ref cookies
│   ├── app/
│   │   ├── (marketing)/                 # Static where possible
│   │   │   ├── layout.tsx               # Marketing header/footer
│   │   │   ├── page.tsx                 # Homepage (09-MARKETING.md)
│   │   │   ├── pricing/ demo/ about/ changelog/ privacy/ terms/ waitlist/
│   │   │   ├── tools/ats-keyword-checker/  tools/bullet-strength/
│   │   │   └── guides/[slug]/  for/[audience]/  compare/[slug]/          # 1.1
│   │   ├── (auth)/sign-in/page.tsx
│   │   ├── auth/callback/route.ts
│   │   ├── (app)/                       # layout.tsx → requireUser(); app shell
│   │   │   ├── dashboard/  library/  library/import/  library/targets/
│   │   │   ├── jobs/  jobs/new/  jobs/[jobId]/
│   │   │   ├── jobs/[jobId]/resumes/[resumeId]/  jobs/[jobId]/letters/[letterId]/
│   │   │   ├── jobs/[jobId]/prep/[prepKitId]/        # 1.1
│   │   │   ├── contacts/  insights/  milestones/  settings/  admin/
│   │   ├── api/
│   │   │   ├── stripe/webhook/route.ts
│   │   │   ├── tailored resumes/[resumeId]/{pdf,docx}/route.ts
│   │   │   ├── letters/[letterId]/{pdf,docx}/route.ts
│   │   │   ├── account/export/route.ts  # JSON data export
│   │   │   └── cron/{reminders,weekly-digest,renewal-heads-up}/route.ts   # 1.1
│   │   ├── sitemap.ts  robots.ts  opengraph-image.tsx
│   ├── features/                        # One folder per domain; UI + logic together
│   │   ├── library/   actions, queries, schemas, serialize, strength, verbs, health, components/
│   │   ├── import/      actions, schemas, extract, components/
│   │   ├── jobs/      actions, queries, schemas, pipeline (applyStatusChange), board-order, components/
│   │   ├── tracking/    interviews, contacts, reminders, offers, events: actions, queries, schemas, components/
│   │   ├── tailor/       actions, queries, schemas, validate, assemble, score, keywords, plainText, components/
│   │   ├── letters/     actions, queries, schemas, validate, assemble, components/
│   │   ├── prep/        (1.1)
│   │   ├── coach/       (1.1)
│   │   ├── target profiles/    (1.1)
│   │   ├── insights/    queries (metrics), components/ (charts)
│   │   ├── momentum/    streak.ts (derived weekly streak), milestones.ts (definitions), award.ts, components/   (1.1)
│   │   ├── billing/     plans.ts, quota.ts, entitlements.ts, actions, queries, components/
│   │   ├── growth/      referrals, leads, feedback, testimonials
│   │   ├── account/     actions (export, delete, preferences)
│   │   ├── dashboard/   queries, components/
│   │   ├── admin/       queries, components/   (1.1)
│   │   └── marketing/   demo/ (fixtures + demo-mode components), tools/ (keyword-checker, bullet-strength), components/
│   ├── lib/
│   │   ├── db.ts  auth.ts  env.ts  result.ts  stripe.ts  analytics.ts (server capture)  turnstile.ts  iphash.ts
│   │   ├── supabase/{server,client,proxy}.ts
│   │   ├── ai/{client,models,pricing,run}.ts + prompts/{import,analyze,tailor,letter,prep,coach}.ts
│   │   ├── pdf/{fonts/, templates/{classic,modern,compact}.tsx, letter.tsx, render.ts}
│   │   ├── docx/{resume.ts, letter.ts}
│   │   └── email/{send.ts, templates/*.tsx}
│   ├── components/{ui/, shell/, marketing/}
│   ├── copy/strings.ts
│   └── generated/prisma/                # gitignored
├── tests/{unit/, e2e/}
└── evals/{fixtures/, run.ts, NOTES.md}
```

Rule of thumb: used by one feature → lives in that feature folder.

## Core patterns

### 1. Reads: server components + `queries.ts`
```ts
// src/features/jobs/queries.ts
import "server-only";
export async function getJob(userId: string, jobId: string) {
  return db.job.findFirst({ where: { id: jobId, userId } });   // ALWAYS scope by userId
}
```
```tsx
export default async function JobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;           // Next 16: params is async
  const user = await requireUser();
  const job = await getJob(user.id, jobId);
  if (!job) notFound();
}
```

### 2. Writes: server actions in `actions.ts`
```ts
"use server";
export async function updateJobStatus(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = updateJobStatusSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION", parsed.error.flatten().fieldErrors);
  const res = await applyStatusChange(user.id, parsed.data.jobId, parsed.data.status); // scoped + side effects
  if (!res) return fail("NOT_FOUND");
  revalidatePath(`/jobs/${parsed.data.jobId}`);
  return ok({ id: parsed.data.jobId });
}
```
- Server actions are public endpoints: `requireUser()` → Zod parse → ownership in `where` → side effects → `revalidatePath`.
- `ActionResult<T>` = `{ ok: true, data } | { ok: false, error: { code, fields? } }`.
- Error codes (closed set, `lib/result.ts`): `VALIDATION`, `NOT_FOUND`, `UNAUTHENTICATED`, `QUOTA_EXCEEDED`, `PRO_REQUIRED`, `AI_FAILED`, `CONFLICT`, `RATE_LIMITED`, `CAPTCHA_FAILED`, `INTERNAL`.

### 3. Route handlers: only where an action can't work
Stripe webhook (raw body) · file downloads (PDF, DOCX, JSON export) · auth callback · cron jobs · OG images/sitemap/robots. Everything else is a server action.

### 4. AI calls: always `runStructured()` (see `05-AI.md`)

### 5. Pipeline side effects: always `applyStatusChange()`
Any change to `Job.status` (board drag, dropdown, list, offer creation, interview creation) goes through `features/jobs/pipeline.ts`, which applies the side effects in `04-DATA-MODEL.md` in one transaction. Never `db.job.update({ data: { status } })` directly.

### 6. Entitlements: `features/billing/entitlements.ts`
`can(user, "docx" | "template:modern" | "template:compact" | "insights:whats-working" | "targets:unlimited")` reads `plans.ts`. Pro-only server actions and routes return `PRO_REQUIRED`; the UI shows a lock and opens the Upgrade modal.

### 7. Long AI operations
`export const maxDuration = 120` on pages whose actions tailor, write letters, or import. Generated rows are created `PENDING` before the AI call → `READY`/`FAILED` after. A PENDING row older than 5 minutes is treated as FAILED in queries. The UI polls (`router.refresh()` every 3 s) while PENDING.

### 8. Board ordering
`boardOrder` is a float. Moving a card between neighbours A and B sets `(A + B) / 2` (or ±1 at the ends); when the gap gets below 1e-6, renumber that column in a transaction. Unit-tested in `board-order.ts`.

## Auth design
- Supabase Auth session cookie; `src/proxy.ts` refreshes it and redirects signed-out users from app routes (`/dashboard`, `/library`, `/jobs`, `/contacts`, `/insights`, `/milestones`, `/settings`, `/admin`) to `/sign-in?next=…`. It also stores first-touch `source`, `utm_*`, `ref`, and referrer in a 30-day cookie (`rr_ft`). `/auth/callback` exchanges a PKCE `code` or verifies a `token_hash` + `type` (admin/email links).
- **`requireUser()` is the security boundary**, called in the `(app)` layout, every server action, and every route handler except the webhook and cron (cron uses `CRON_SECRET`).
- `requireUser()` (wrapped in React `cache()`): `supabase.auth.getUser()` (never trust `getSession()` on the server) → upsert `User` (on create: `referralCode = nanoid(8)`, attribution from the cookie, and a `Referral` row if a valid `ref` exists) → return `{ id, email, plan, role }`. Signed-out: `redirect("/sign-in")` in pages; `fail("UNAUTHENTICATED")` in actions.
- `requireAdmin()` = `requireUser()` + `role === "ADMIN"`, otherwise `notFound()`.
- **All app data through Prisma.** Supabase JS is for auth only.
- **RLS enabled with no policies on every table** (see `04-DATA-MODEL.md` → Migrations).

## Data flow: tailor (critical path)
```
tailorResume({ jobId, length, emphasis, targetProfileId? })
  1 requireUser  2 Zod  3 load job (scoped, analysis READY)  4 load library (non-empty)
  5 quota = checkQuota(user, "TAILOR") → QUOTA_EXCEEDED       6 PENDING tailored resume for job < 5 min → CONFLICT
  7 create TailoredResume PENDING (version n+1, options, librarySnapshot)
  8 serializeLibrary → text + refMap   9 runStructured(TAILOR, usedBonusCredit = quota.useBonus)
 10 validateTailorOutput  11 assembleResumeContent  12 scoreMatch
 13 update TailoredResume READY + JobEvent(RESUME_TAILORED) (+ milestone check in 1.1)   14 revalidate, return { resumeId }
 on error after 7: TailoredResume FAILED (error code), return AI_FAILED
```
Cover letters follow the same shape (`features/letters/actions.ts`).

## Payments design
- `plans.ts`: limits per AI kind (with period), entitlements, Stripe price ids (`STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_QUARTERLY`).
- **Checkout:** `createCheckoutSession({ interval })` → reuse or create a Stripe Customer → `mode: "subscription"`, the price for the interval, `client_reference_id = user.id`, `allow_promotion_codes: true`, and if the user is founding-eligible (their email is a `Lead` with `foundingOffer`, or the founding coupon still has redemptions) `discounts: [{ coupon: STRIPE_COUPON_FOUNDING }]` (coupon: 40% off, `duration: forever`, `max_redemptions: 100`). Success → `/settings?upgraded=1`.
- **Portal:** `createPortalSession()` for plan switches, payment methods, and cancellation (set the portal to cancel at period end).
- **Webhook** (`/api/stripe/webhook`): verify the signature on the raw body; insert `StripeEvent` first (duplicate → 200); handle `checkout.session.completed` (link the customer/subscription, set `foundingMember` if the discount applied), `customer.subscription.created|updated|deleted` (plan = PRO if `active`/`trialing`, else FREE; set `billingInterval` from the price id; `subscriptionStatus`, `currentPeriodEnd`, `cancelAtPeriodEnd`), `invoice.payment_failed` (in-app banner). In 1.1, referral conversion → reward.
- The plan changes **only** in the webhook.
- **Refunds** (14-day guarantee) are issued manually from the Stripe dashboard in 1.0.

## Exports
- **PDF:** `GET /api/resumes/[resumeId]/pdf` and `/api/letters/[letterId]/pdf`: `requireUser()` → load scoped → entitlement check for the template (fallback to Classic) → `renderToBuffer` → `attachment` download; set `exportedAt`. These routes run on the Node.js runtime. Do not export `runtime` while `cacheComponents` is enabled; Next rejects that segment config. The default runtime is already Node.
- **DOCX** (Pro): same routes with `/docx`, built with `docx` from the same section order as PDF/plain text.
- **ATS rules for all resume templates:** single column; standard headings; no tables/text boxes for content; real text; embedded OFL fonts (Inter, Source Sans 3); no icons replacing words. Compact = tighter spacing and smaller type for 1-page fits. When `TailorOptions.length` is 1, a PDF that would spill onto a second page groups the header links, then tightens spacing and type, until it fits one Letter page. It does not remove lines.
- **Data export:** `GET /api/account/export` streams JSON of every user-owned row.

## Email (Resend)
- `lib/email/send.ts`: `sendEmail({ to, template, refKey, recipientKey, props })` → checks `EmailLog` unique (skip if already sent) → Resend → insert `EmailLog`. Templates in `lib/email/templates/` (React Email).
- Every email: one CTA, a footer with preferences/unsubscribe link and a mailing address (CASL). Marketing templates check `marketingConsentAt` and refuse to send without it.
- **1.0:** welcome email. **1.1:** reminders digest, weekly digest, renewal heads-up, offer congratulations, quota reached, product updates.

## Scheduled jobs (1.1, Vercel Cron)
| Route | Schedule | Job |
|---|---|---|
| `/api/cron/reminders` | hourly | For users whose local time is 08:00 and who have due reminders and `emailRemindersEnabled` → one digest email (`refKey = date`) |
| `/api/cron/weekly-digest` | hourly on Mondays | Users at 08:00 local with `weeklyDigestEnabled` → Insights summary (`refKey = ISO week`) |
| `/api/cron/renewal-heads-up` | daily | 90-day subscribers renewing in 3 days → heads-up (`refKey = currentPeriodEnd`) |
All cron handlers require `Authorization: Bearer ${CRON_SECRET}` and are idempotent through `EmailLog`.

## Free tools & waitlist
- Server actions with: Turnstile verification (`lib/turnstile.ts`) → IP hash `sha256(ip + IP_HASH_SALT + yyyy-mm-dd)` (`lib/iphash.ts`) → `FreeToolRun` count (≤ 3/day for the keyword checker) → run → insert `FreeToolRun`.
- Waitlist/newsletter: Turnstile + Zod email + consent checkbox → upsert `Lead`.

## Analytics
- `posthog-js` initialised client-side in cookieless (memory) persistence mode; `posthog-node` (`lib/analytics.ts`) for server events (`checkout_completed`, `forge_completed`). Identify users by `user.id` only, never by email. **No user content in event properties.**

## Environment variables (`.env.example`)

| Name | Used by | Notes |
|---|---|---|
| `DATABASE_URL` | Prisma runtime | Supabase pooled (port 6543) |
| `DIRECT_URL` | `prisma.config.ts` | Supabase direct/session (port 5432) |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase clients | Public key (older projects: "anon") |
| `SUPABASE_SECRET_KEY` | `deleteAccount` | Server only |
| `ANTHROPIC_API_KEY` | `lib/ai/client.ts` | |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe | `stripe listen` locally |
| `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_QUARTERLY` | `plans.ts` | Price ids |
| `STRIPE_COUPON_FOUNDING` | checkout | 40% forever, max 100 |
| `RESEND_API_KEY`, `EMAIL_FROM` | `lib/email` | e.g. `RoleRefine <hello@yourdomain>` (verify the domain in Resend) |
| `MAILING_ADDRESS` | email footer | CASL requirement |
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | analytics | |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | free tools, waitlist | |
| `IP_HASH_SALT` | `lib/iphash.ts` | Random 32+ chars |
| `CRON_SECRET` | cron routes | 1.1 |
| `NEXT_PUBLIC_APP_URL` | redirects, emails, OG | |
| `SEED_USER_ID` | `prisma/seed.ts` | Dev only; optional |

`src/lib/env.ts` validates these with Zod (1.1-only ones optional until used).

## Security & privacy checklist
- [ ] Every query/mutation scoped by `userId`; every status change through `applyStatusChange`.
- [ ] RLS enabled (no policies) on all 25 tables; new tables get it in their migration.
- [ ] `"server-only"` in `lib/db.ts`, `lib/ai/*`, `lib/stripe.ts`, `lib/email/*`, every `queries.ts`.
- [ ] No resume/posting/AI content in logs or analytics.
- [ ] Uploads: MIME + magic bytes (`%PDF`, `PK`), ≤ 5 MB, in memory only.
- [ ] Free tools and waitlist: Turnstile + IP-hash rate limits; pasted text never stored.
- [ ] Webhook signature verified; plan only changed by the webhook; cron routes require `CRON_SECRET`.
- [ ] Marketing email only with stored CASL consent; unsubscribe + mailing address in every email.
- [ ] `deleteAccount`: cancel Stripe → delete User (cascade) → delete the Supabase auth user → sign out. Data export available.
- [ ] Privacy policy (PIPEDA-aware) states what's stored, that files aren't kept, the AI processor (described accurately per Anthropic's current terms), analytics, email, and how to export/delete.
- [ ] Admin routes behind `requireAdmin()`.
- [ ] `.gitignore`: `.env*` (not `.env.example`), `src/generated/`, `evals/out/`, `*.pdf`/`*.docx` outside `evals/fixtures/`.

## Environments & deployment
| Env | Database | Stripe | Email | Notes |
|---|---|---|---|---|
| Local | Supabase `rolerefine-dev` | Test + `stripe listen` | Resend test / log to console | `npm run dev` |
| Preview | `rolerefine-dev` | Test | Disabled | Vercel per PR |
| Production | `rolerefine-prod` | Live | Resend (verified domain) | Vercel on `main` |

- Build command (prod): `prisma migrate deploy && next build`.
- `vercel.json` cron entries in 1.1.
- CI: lint, typecheck, unit tests on every PR. E2E manually or nightly.
- Fixed costs at launch ≈ Vercel Pro $20 + Supabase Pro $25 + domain; Resend and PostHog free tiers.

## npm scripts
```json
{
  "dev": "next dev", "build": "next build", "start": "next start",
  "lint": "eslint .", "typecheck": "tsc --noEmit",
  "test": "vitest run", "test:watch": "vitest", "e2e": "playwright test",
  "db:migrate": "prisma migrate dev", "db:deploy": "prisma migrate deploy",
  "db:studio": "prisma studio", "db:generate": "prisma generate", "db:seed": "prisma db seed",
  "evals": "tsx --conditions=react-server evals/run.ts", "email:dev": "email dev --dir src/lib/email/templates",
  "postinstall": "prisma generate"
}
```
