# Next task

Start the next RoleRefine roadmap task. Follow these steps exactly.

1. Open `docs/PROGRESS.md`. Pick the first task marked `[ ]` or `[~]`. If I named a task ID in my message (e.g. "T3.2"), use that one instead. If a previous task is still `[~]`, ask me whether to finish it first.
2. Read that task in `docs/06-ROADMAP.md`, plus every doc section it references, plus `AGENTS.md` and any `.cursor/rules` that apply to the files you'll touch.
3. Mark the task `[~]` in `docs/PROGRESS.md`.
4. Reply with, and then STOP and wait for my approval:
   - **Task:** ID, title, and the acceptance criteria copied from the roadmap.
   - **Things I must do by hand first** (accounts, dashboard settings, values to put in `.env`), with exact steps. Never ask me to paste secrets into the chat.
   - **Plan:** numbered steps.
   - **Files** you will create or change.
   - **Commands** you will run, and any new dependencies (with one-line reasons).
   - **Questions** where the docs are ambiguous or seem wrong.
5. Do not write code until I reply "go" (or approve the plan).
6. While building: only touch files this task needs; follow the docs; if you hit something the docs don't cover, stop and ask.
7. When done building: run `npm run lint`, `npm run typecheck`, `npm run test` (once they exist), fix failures, then tell me exactly how to verify each acceptance criterion myself. Then remind me to run `/finish-task`.
