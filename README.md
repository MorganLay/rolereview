# RoleRefine

**Tailored resumes. Every line traced to you.**

RoleRefine tailors your resume and cover letter to each job using only your real experience, then tracks every application through to the offer.

> **Status:** Phase 0 in progress. **Start with [`docs/00-START-HERE.md`](docs/00-START-HERE.md).**

## How it works

1. **Experience library:** import your resume once. It's organized into reusable entries, bullets, and skills, with a strength meter on every bullet.
2. **Add a job:** paste a posting. It's analysed into must-have and nice-to-have requirements, keywords, salary, and work mode.
3. **Tailor:** Claude builds a tailored resume and cover letter from your library only. Every line cites its source, and code guards revert anything that adds facts.
4. **Refine and export:** edit inline, watch the match score and keyword coverage, export PDF or DOCX.
5. **Track:** move jobs across the board; timeline, interviews, contacts, reminders, and offers on every card; Insights show what's working.

## The plan

| # | Doc | What's in it |
|---|---|---|
| 00 | [Start here](docs/00-START-HERE.md) | Setup checklist and your first Cursor sessions |
| 01 | [Product](docs/01-PRODUCT.md) | Feature catalogue by release, non-goals, vocabulary, pricing, metrics |
| 02 | [User flows](docs/02-USER-FLOWS.md) | Every screen and how it behaves |
| 03 | [Architecture](docs/03-ARCHITECTURE.md) | Stack, folders, patterns, auth, payments, email, security, deployment |
| 04 | [Data model](docs/04-DATA-MODEL.md) | Schema explained + JSON shapes ([schema.prisma](prisma/schema.prisma)) |
| 05 | [AI design](docs/05-AI.md) | AI calls, prompts, fabrication guards, scoring, cost, evals |
| 06 | [Roadmap](docs/06-ROADMAP.md) | Phases → tasks with acceptance criteria |
| 07 | [Decisions](docs/07-DECISIONS.md) | Why each choice was made + open questions |
| 08 | [Cursor workflow](docs/08-CURSOR-WORKFLOW.md) | How to build this with Cursor and stay in control |
| 09 | [Homepage & marketing](docs/09-MARKETING.md) | Homepage copy and CTA, free tools, SEO, launch, email, referrals |
| 10 | [Brand](docs/10-BRAND.md) | Voice, colours, type, logo direction, design tokens |
| — | [Progress](docs/PROGRESS.md) | Task checklist used by `/next-task` and `/finish-task` |

Cursor reads `AGENTS.md` and `.cursor/rules/*.mdc` automatically. Project slash commands: `/next-task`, `/review`, `/finish-task` (`.cursor/commands/`).

## Stack

Next.js 16 · React 19 · Tailwind 4 + shadcn/ui · Supabase (Auth + Postgres) · Prisma 7 · Zod 4 · Claude API · Stripe · React-PDF + docx · dnd-kit · Recharts · Resend · PostHog · Turnstile · Vitest · Playwright · Vercel

## Local setup (fills in during Phase 0)

```bash
cp .env.example .env      # fill in values
npm install
npm run db:migrate
npm run dev
```
