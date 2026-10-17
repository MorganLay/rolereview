# Finish task

Close out the RoleRefine task currently marked `[~]` in `docs/PROGRESS.md`.

1. Run `npm run lint`, `npm run typecheck`, `npm run test`. Report results; fix anything failing (ask before large changes).
2. Go through the **Definition of Done** in `docs/06-ROADMAP.md` and the **diff review checklist** in `docs/08-CURSOR-WORKFLOW.md` against the changes made for this task (`git diff` / `git status`). List each item as ✅ or ❌ with a one-line reason. Pay special attention to: `userId` scoping, `requireUser()` first, no direct `Job.status` writes, no hard-coded limits/prices/hex colours, no user content in logs, no `process.env` outside `lib/env.ts`.
3. List each acceptance criterion and ask me to confirm I verified it by hand. Don't mark the task done until I confirm.
4. After I confirm:
   - Change the task to `[x]` in `docs/PROGRESS.md` and add a one-line note under **Notes** (date, task ID, anything worth remembering or a follow-up).
   - If behaviour differs from the docs, update the docs in the same change.
   - Suggest a commit message in the form `feat(area): T#.# short description` and the exact git commands (`git add -A`, `git commit -m "..."`, `git push`). Don't commit unless I ask.
5. Tell me the next task ID and title, and suggest starting a **new chat** with `/next-task`.
