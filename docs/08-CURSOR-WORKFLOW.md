# 08 — Working With Cursor

> How to vibe code this without losing control of it. The plan is written so Cursor can follow it; this doc is for **you**, the overseer.

## One-time setup

1. Open the `rolerefine` folder in Cursor. `AGENTS.md` and `.cursor/rules/*.mdc` load automatically.
2. **Settings → Indexing & Docs → add docs** (so you can `@`-mention them): Next.js, Supabase (Auth with Next.js SSR), Prisma, Anthropic (Claude API), Stripe, React-PDF, shadcn/ui, Tailwind. This cuts down on made-up APIs.
3. Use the strongest model available for planning and for Phase 6 (tailoring) tasks; a faster model is fine for UI polish.
4. Turn on "ask before running terminal commands" until you trust the flow.

## Slash commands (the easy way)

Use `/next-task`, `/review`, and `/finish-task` (defined in `.cursor/commands/`, progress in `docs/PROGRESS.md`). They wrap the loop and template below, so you rarely need to type the prompt yourself. See `00-START-HERE.md` → Part D.

## The loop for every task

```
1. New chat (one task per chat; long chats drift)
2. Plan first  → paste the prompt below, ask for a plan, NOT code
3. Review plan → does it match the docs? push back on extras
4. Build       → "Go ahead with the plan"
5. Verify      → run the acceptance criteria yourself, plus lint/typecheck/test
6. Review diff → use the checklist below
7. Commit      → feat(area): T#.# short description
```

### Task prompt template

```
Task T6.3 from @docs/06-ROADMAP.md.

Read first: @docs/03-ARCHITECTURE.md (Data flow: tailor), @docs/05-AI.md (TAILOR section),
@docs/04-DATA-MODEL.md (ResumeContent, MatchReport).

Constraints:
- Follow the patterns in AGENTS.md and .cursor/rules.
- Only touch files needed for this task. Don't refactor unrelated code.
- If the docs are ambiguous or seem wrong, stop and ask me instead of guessing.

First reply with: a short plan, the files you'll create or change, and any questions.
Do not write code yet.
```

### Diff review checklist (2 minutes, every time)

- [ ] Every Prisma call in an action or query has `userId` in its `where`.
- [ ] No direct writes to `Job.status` (must go through `applyStatusChange`).
- [ ] No hard-coded limits or prices (must come from `plans.ts`).
- [ ] Every server action starts with `requireUser()` then a Zod parse.
- [ ] No `process.env.X` outside `lib/env.ts`.
- [ ] No direct `@anthropic-ai/sdk` import outside `lib/ai/`.
- [ ] No `console.log` of resume, posting, or AI content.
- [ ] No new dependency you didn't expect (check `package.json`).
- [ ] No files changed outside the task's scope.
- [ ] Tests exist for any new pure logic.
- [ ] UI strings come from `copy/strings.ts`; colours come from the brand tokens (no ad-hoc hex values).

## What to own yourself (understand line by line)

Let Cursor write it, but read and be able to explain these. They're the interview-worthy parts and the places where bugs cost real money or trust:

1. `prisma/schema.prisma` and the RLS migration.
2. `lib/auth.ts` (`requireUser`) and `src/proxy.ts`.
3. `features/tailor/validate.ts` (the fabrication guard) and its tests.
4. `lib/ai/run.ts` and the three prompts.
5. `api/stripe/webhook/route.ts`.
6. `features/billing/quota.ts` (incl. bonus credits) and `entitlements.ts`.
7. `features/jobs/pipeline.ts` (status side effects) and the Insights metric queries; these decide whether your tracking data can be trusted.

For each, write a 3–5 sentence explanation in your own words in `docs/NOTES.md`. If you can't, ask Cursor to explain it until you can.

## Keeping Cursor on the rails

- **It drifts from the docs:** point at the exact section: "Re-read @docs/04-DATA-MODEL.md ResumeContent; you stored the title in the entry, which D-14 forbids."
- **It invents APIs:** "@Prisma (docs) — check how Prisma 7 configures the datasource" or paste the relevant doc page.
- **It over-builds:** "That's out of scope for this task (see 01-PRODUCT non-goals). Remove it."
- **It repeats the same mistake twice:** add a one-line rule to the relevant `.cursor/rules/*.mdc` file. Rules grow from real mistakes.
- **A task balloons past ~3 hours:** stop, commit what works, and split the task in the roadmap.
- **Docs are wrong:** fix the doc in the same commit as the code. The docs are only useful if they stay true.

## Git habits

- `main` always runs. Branch per phase (`phase-5-tailor`), merge when the phase's tasks are done and CI is green.
- Commit after every task, so you can always `git reset` a bad Cursor session.
- Never commit `.env`, real resumes, or `evals/out/`.

## When to come back to Claude (chat) instead of Cursor

- Product or pricing decisions (update `07-DECISIONS.md` afterwards).
- Reviewing a whole phase for security or design issues ("review my Phase 6 diff against the docs").
- Rewriting prompts after an eval run, with the eval output pasted in.
