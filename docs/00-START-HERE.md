# 00 — Start Here

> Your setup checklist and first week. Do Part A and Part B once, then follow the Part D prompts. After that, it's the same loop for every task in `06-ROADMAP.md`.

## Part A — Name & accounts (this week, alongside coding)

**Name checks (before T2.1, the waitlist page).** Coding can start now; the name only becomes public in Phase 2.
- [ ] CIPO trademark search: "RoleRefine", "Role Refine", "RoleRefiner" in classes 9, 35, 42 (Canadian Trademarks Database).
- [ ] USPTO search (you'll have US users).
- [ ] Google, app stores, Product Hunt: no live product with the same or a confusingly similar name in careers/HR.
- [ ] Domains: `rolerefine.com` and `rolerefine.ca` (buy both if available; `.ca` needs Canadian presence, which you have).
- [ ] Handles: LinkedIn page, X, Instagram, YouTube, TikTok, Reddit.
- [ ] Ontario business name registration if trading as a sole proprietor under "RoleRefine".
- If anything blocks the name: fallback **Threadline** (re-run the same checks), then update `10-BRAND.md` and `strings.ts`. Nothing else in the code depends on the brand.

**Accounts to create now** (free tiers are fine):
- [ ] **GitHub:** new **private** repo `rolerefine` (empty, no README).
- [ ] **Supabase:** project `rolerefine-dev` (Canada region if offered). Save the database password in a password manager.
- [ ] **Anthropic Console:** API key + **set a monthly spend limit** (e.g., $20) so a bug can't run up a bill.

**Accounts for later** (don't set up yet): Vercel (Phase 2), Resend, PostHog, Cloudflare Turnstile (Phase 2), Google Cloud OAuth client (T1.1), Stripe (Phase 11).

## Part B — Install on your PC

- [ ] **Node.js LTS** (22 or newer) from nodejs.org. Check: `node -v` and `npm -v` in a new terminal.
- [ ] **Git for Windows.** Check: `git --version`. Set your name and email: `git config --global user.name "Morgan …"` and `git config --global user.email "…"`.
- [ ] **Cursor** (latest).
- [ ] Optional but handy: **GitHub CLI** (`gh auth login`), and the **Prisma** and **Tailwind CSS IntelliSense** extensions in Cursor.

Note: the project lives at `D:\Coding Projects\rolerefine`. The space in "Coding Projects" is fine for npm/Next, but always quote the path in terminal commands.

## Part C — Set up Cursor (once)

1. **File → Open Folder** → `D:\Coding Projects\rolerefine`.
2. **Check the rules loaded:** Cursor Settings → Rules. You should see the project rules from `.cursor/rules/` (ai, billing, data-access, database, marketing, nextjs, testing, ui), and `AGENTS.md` is picked up automatically.
3. **Add docs for `@`-mentions** (Settings → Indexing & Docs → Add): Next.js, Supabase (Auth + Next.js SSR), Prisma, Anthropic (Claude API), shadcn/ui, Tailwind CSS. Add Stripe, React-PDF, Resend, and PostHog when you reach those phases.
4. **Model:** use the strongest available model in Agent mode for planning and for Phases 4–6 and 9 (AI work); a faster one is fine for UI polish.
5. **Safety:** keep "ask before running terminal commands" on for now. Turn on Privacy Mode if you don't want your code retained by model providers.
6. Read `08-CURSOR-WORKFLOW.md` once (10 minutes). It's how you stay in control.

## Part D — Running tasks with the slash commands

You don't paste task text into Cursor. Three project commands (in `.cursor/commands/`) do the reading for you, and `docs/PROGRESS.md` tracks where you are.

| Command | What it does |
|---|---|
| `/next-task` | Finds the first unticked task in `PROGRESS.md`, reads the roadmap entry and every doc it references, then replies with: acceptance criteria, **what you must do by hand first** (accounts, `.env` values), plan, files, commands, questions. It waits for your "go". Add a task ID to jump to a specific one: `/next-task T3.2`. |
| `/review` | Strict read-only review of your uncommitted changes against the rules (security, scoping, spec, UI, tests, scope creep). |
| `/finish-task` | Runs lint/typecheck/tests, checks the Definition of Done, asks you to confirm the acceptance criteria, ticks the task in `PROGRESS.md`, and gives you the commit commands. |

**The loop, every task:**
1. **New Agent chat** (one task per chat; long chats drift).
2. Type **`/next-task`** → read its plan → do any by-hand steps it lists → reply **"go"** (or push back first).
3. When it says it's done: **`/review`** → ask it to fix anything High/Medium.
4. Check the acceptance criteria yourself (click through the app, run the commands).
5. **`/finish-task`** → confirm → run the git commands it gives you.
6. Close the chat. Repeat.

You stay the reviewer: Cursor never moves on to the next task by itself, and it never commits unless you ask.

### What to expect in the first sessions
- **T0.1:** special case. The folder already holds the plan, so the agent scaffolds Next.js into `..\rolerefine-scaffold` and moves files in without overwriting `docs/`, `AGENTS.md`, `.cursor/`, `prisma/`, `README.md`, `.env.example`. Have your empty GitHub repo URL ready. Verify: `npm run dev` shows the page; `docs/` unchanged.
- **T0.2:** verify `/styleguide` looks calm and professional in light and dark (pine buttons, paper background, nothing neon).
- **T0.3:** before saying "go", copy `.env.example` to `.env` and fill `DATABASE_URL` (pooled, port 6543) and `DIRECT_URL` (port 5432) from Supabase → Project Settings → Database. Verify: `npm run db:studio` shows 25 tables; Supabase shows RLS enabled on each.
- **T0.4:** verify CI is green on GitHub after pushing.
- **T1.1:** you'll set up a Google OAuth client and Supabase redirect URLs; the plan will list exact values.

## Part E — A realistic first two weeks

| When | Do |
|---|---|
| Day 1 | Part A accounts, Part B installs, Part C setup, **T0.1** |
| Day 2 | **T0.2** brand tokens + styleguide |
| Day 3 | **T0.3** database |
| Day 4 | **T0.4** tests & CI; name checks done by now |
| Weekend | **T1.1–T1.3** auth + app shell |
| Week 2 | Buy domain → **T2.1–T2.2** waitlist live → first LinkedIn "building in public" post |
| Then | Phases 3–7 → walking skeleton → use it for your own applications |

## When you get stuck

- The agent goes in circles twice → stop, `git restore .` (or `git reset --hard` to the last commit), start a fresh chat with a narrower ask.
- An error you don't understand → paste the full error and ask "explain the cause before changing anything".
- The docs seem wrong → fix the doc first (or ask Claude in chat), then continue.
- After each phase, ask Claude (chat) for a review: "Review my Phase N changes against the docs for security and design issues."
