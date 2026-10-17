# Review

Review the uncommitted changes (`git diff`, including new files) as a strict senior reviewer for RoleRefine. Do not change any code; report only.

Check against `AGENTS.md`, the relevant `.cursor/rules`, and the docs for the current task in `docs/PROGRESS.md`:

1. **Security:** `requireUser()` first in every action/route; every Prisma query scoped by `userId`; no `findUnique` by id on user-owned models; Zod on all inputs; no secrets or `process.env` outside `lib/env.ts`; webhook/cron protections where relevant.
2. **Correctness:** matches the spec in the docs (fields, enums, side effects via `applyStatusChange`, quota via `checkQuota`, entitlements via `can`); edge cases; error handling returns `ActionResult` codes.
3. **AI safety (if touched):** calls go through `runStructured()`; guards run before saving; no user content logged.
4. **UI (if touched):** strings from `src/copy/strings.ts`, brand tokens only, accessible (labels, focus, not colour-only), empty/loading/error states, works at 375px.
5. **Tests:** pure logic has tests; tests cover the nasty cases.
6. **Scope:** anything built that the task didn't ask for.

Output a table: Severity (High/Medium/Low) · File:line · Problem · Suggested fix. End with a one-line verdict: "Ready to finish" or "Fix before finishing".
