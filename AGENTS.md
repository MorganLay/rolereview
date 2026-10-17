# AGENTS.md — RoleRefine

You are helping build **RoleRefine**, a professional job-search workspace. Users keep an **experience library** (entries, bullets, skills), add **jobs** (postings they're pursuing), **tailor** resumes and cover letters to each job from their real experience only (the AI selects and rewrites; code guards block fabrication), and track every application (jobs board, timeline, interviews, contacts, reminders, offers, Insights). The brand is calm, precise, and trustworthy; see `docs/10-BRAND.md`.

## Read before working

| Need | Doc |
|---|---|
| **Where to start / how to run a task** | `docs/00-START-HERE.md`, `docs/08-CURSOR-WORKFLOW.md` |
| **Which task is current** | `docs/PROGRESS.md` (update it via `/finish-task`) |
| Scope, non-goals, vocabulary, pricing | `docs/01-PRODUCT.md` |
| Screens and behaviour | `docs/02-USER-FLOWS.md` |
| Stack, folders, patterns, security | `docs/03-ARCHITECTURE.md` |
| Schema and JSON shapes | `docs/04-DATA-MODEL.md`, `prisma/schema.prisma` |
| AI calls, prompts, guards, scoring | `docs/05-AI.md` |
| Current task and acceptance criteria | `docs/06-ROADMAP.md` |
| Why things are the way they are | `docs/07-DECISIONS.md` |
| Homepage, marketing pages, free tools, email, SEO | `docs/09-MARKETING.md` |
| Voice, colours, type, design tokens | `docs/10-BRAND.md` |

Work on **one roadmap task at a time**, only in the current release (1.0 → 1.1 → 1.2). If the docs are ambiguous or look wrong, **stop and ask**. Don't guess, and don't silently deviate. If you change behaviour, update the doc in the same change.

## Stack (do not swap without a decision in docs/07-DECISIONS.md)

Next.js 16 (App Router, TS strict) · React 19 · Tailwind 4 + shadcn/ui · Supabase Auth (`@supabase/ssr`) · Supabase Postgres via **Prisma 7** (`prisma-client` generator → `src/generated/prisma`, `@prisma/adapter-pg`) · Zod 4 · Anthropic SDK (Claude) · Stripe · `@react-pdf/renderer` + `docx` · dnd-kit · Recharts · Resend + React Email · PostHog · Cloudflare Turnstile · Vitest · Playwright · Vercel (+ Cron in 1.1).

## Golden rules

1. **Auth boundary is `requireUser()`** from `@/lib/auth`. Call it first in every server action, protected page/layout, and route handler (except the Stripe webhook and cron routes). `src/proxy.ts` is a convenience redirect, not security.
2. **Scope every query by `userId`.** Use `findFirst/updateMany/deleteMany({ where: { id, userId } })`. Never `findUnique({ where: { id } })` on user-owned data. Missing or not-owned → `notFound()` / `NOT_FOUND`.
3. **Server actions** live in `src/features/<area>/actions.ts`, start with `"use server"`, parse input with Zod, and return `ActionResult` from `@/lib/result` (`ok()` / `fail(code)`). Don't throw for expected failures.
4. **Reads** live in `src/features/<area>/queries.ts` (`import "server-only"`), with `userId` as the first parameter.
5. **All AI calls go through `runStructured()`** in `@/lib/ai/run`. Never import `@anthropic-ai/sdk` elsewhere. Model IDs and effort only in `@/lib/ai/models`.
6. **The AI never decides facts.** Titles, employers, and dates come from the library snapshot; every tailored bullet cites source refs; `validateTailorOutput()` runs before saving a tailored resume (and the letter guard before saving a letter).
7. **Data access via Prisma only.** The Supabase JS client is for auth only.
8. **Env vars only via `env` from `@/lib/env`.** No `process.env` elsewhere. Never prefix secrets with `NEXT_PUBLIC_`.
9. **Never log user content** (resume text, posting text, AI output). Log ids, error codes, token counts, durations.
10. **UI strings live in `src/copy/strings.ts`** and follow the voice in `docs/10-BRAND.md`. Exported documents carry no RoleRefine branding.
11. **Use the design tokens** from `docs/10-BRAND.md` (Tailwind theme). No ad-hoc hex colours.
12. **Stay in scope.** Check `docs/01-PRODUCT.md` non-goals before adding features. No new dependencies without saying why.
13. **Next 16:** `params`, `searchParams`, `cookies()`, `headers()` are async (`await` them). Middleware is `src/proxy.ts`.
14. **Never write `Job.status` directly.** Use `applyStatusChange()` from `features/jobs/pipeline.ts` (it records timeline events, dates, and reminders).
15. **Plans and limits only from `features/billing/plans.ts`.** Quota via `checkQuota()`, Pro features via `can()`; deny with `QUOTA_EXCEEDED` / `PRO_REQUIRED`.
16. **Marketing honesty:** no fake testimonials, counts, logos, or unverified claims. Marketing email only with stored consent (CASL).

## Folder map (short)

```
src/app/(marketing)  public pages + free tools     src/features/<area>/  actions, queries, schemas, components, logic
src/app/(auth)       sign-in                       src/lib/              db, auth, supabase, ai, pdf, docx, email, stripe, env, result
src/app/(app)        signed-in pages               src/components/       ui (shadcn), shell, marketing
src/app/api          webhook, downloads, cron      src/copy/strings.ts   UI strings
```

## Commands

```
npm run dev          npm run lint        npm run typecheck     npm run test
npm run e2e          npm run evals       npm run db:migrate    npm run db:studio
```

Before saying a task is done: `npm run lint && npm run typecheck && npm run test` must pass, and the task's acceptance criteria in `docs/06-ROADMAP.md` must be met.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

