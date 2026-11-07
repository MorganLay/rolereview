# 11 — Manual testing

> How to walk the app yourself on your machine. What each screen should do is in `02-USER-FLOWS.md`. This is the path, and what to look at.

Do this on localhost. `/dev` does not exist in production, and it only works for the account in `SEED_USER_ID`.

## Before you start

1. In the project folder, run `npm run dev`. Leave that terminal open. The app is at [http://localhost:3000](http://localhost:3000).
2. `.env` needs your Supabase keys and `SEED_USER_ID`. If you have never set that id: run `npm run dev:login -- you@example.com`, open the printed URL, copy the auth user id into `SEED_USER_ID`, and restart `npm run dev`.
3. If every signed-in page says something went wrong, run `npm run db:deploy` and reload. A missing column takes down the whole app shell. Applying migrations adds the column. It does not change your library or your jobs.

## Sign in

Run `npm run dev:login`. It prints a link and does not send email. Open that link. You land on `/dev`, signed in as the seed account.

The link works once. Run the command again when you need a new one.

## Loading a snapshot

`/dev` has five buttons. The same names work in a second terminal:

```
npm run dev:scenario -- new
npm run dev:scenario -- library
npm run dev:scenario -- job
npm run dev:scenario -- ready
npm run dev:scenario -- returning
```

**Load replaces the library and the jobs on that account.** Your email stays. Plan, billing, and past AI usage stay. Anything you typed into the library or the board on this account is gone after Load.

When you are finished looking at an early snapshot, load **Returning** if you want the full sample search back. `npm run db:seed` also restores the full search, and it leaves onboarding alone. The Returning button closes onboarding.

On 7 Nov 2026 the page was opened and no snapshot was loaded, so the account was left as it was.

## What to click

Work down the list. After each Load, use the links on `/dev` (Dashboard, Library, Import resume, Jobs board). Write surprises in `docs/Feedback.md`. One note per thing. The shape is already at the top of that file.

### New

Empty library, no jobs. Getting started is on the first step.

- Dashboard still says **Dashboard** and **What needs you today.**
- Under that, a card: **Getting started**, **Set up your job search.**, **Tailored resumes use only your real experience.**, and a **Build your library** button. That button is the only strong action.
- The steps are **Build your library** (says **Current**, with one purpose line), **Add a job**, **Tailor your resume**, and **Export it**. Upcoming steps are the name only. None of them say **To do.**
- **Build your library** opens Library, which says **Your library is empty**, with **Import a resume** and **Add manually**.
- Import says **Import your resume** and **Start your library from a resume. Nothing is saved until you review it.** **Read resume** stays quiet until a file or enough text is there.
- Jobs says **No jobs yet. Paste a job posting to accept your first job.**

This is the pass for the first-run screens. Notice whether the next action is obvious, and whether the header **New job** button pulls you past the library.

### Library

The sample library is in. No jobs. Step 1 is done. The next step is a job.

- Dashboard: **Build your library** says **Done.** The button says **Add a job.** That step says **Current.**
- Library shows the sample roles, projects, degree, and skills. The empty card is gone.
- Jobs is still the empty board.

### Job

Midpoint. Library, plus one saved job and no resume.

- Dashboard: library and job say **Done.** The button says **Tailor your resume.** That step says **Current.**
- The board has one card: **Lakeshore Civic**, **Product Designer**.
- Open it. Status is Saved. The main button is **Tailor resume**.
- Documents has no finished resume.

Do not tailor unless you mean to. A real tailor spends a model call. This snapshot is for looking, not for running one.

### Ready resume

The same job, with one tailored resume that has not been exported.

- Dashboard: the first three steps say **Done.** The button says **Export it.** That step says **Current.**
- The job’s main button is **Review resume**. It opens that resume.
- Opening it does not count as an export. Exporting does, and it can finish setup. Leave export alone if you still want this snapshot.

### Returning

The full sample search. Eight jobs, interviews, contacts, reminders, an offer, and two finished resumes. Onboarding is already closed, so the line “You’re set up” does not show.

- Dashboard is no longer the checklist. You get **Active**, **Interviews**, **Offers**, and **Urgent**, then **Needs you** and **Continue working**.
- The first row in **Needs you** is the interview that starts within 48 hours. It opens that job’s Interviews tab.
- The board has cards across the stages. The list view is `/jobs?view=list`.
- Contacts and Insights have something to show. Insights on the Free plan blurs **What’s working**.

## A narrow window

After the desktop pass, narrow the window to about 375 pixels wide and repeat the screen you care about.

- The sidebar becomes the menu button. Dashboard, Library, Jobs, Contacts, Insights, and Settings are in that menu.
- **New job** stays in the header.
- The page does not scroll sideways. Text stays inside the screen.

## Public pages

These do not need a snapshot or a sign-in: `/`, `/pricing`, `/demo`, `/sign-in`, `/about`, `/privacy`, `/terms`. The homepage button **Tailor your first resume — free** goes to sign-in and then to import.

## What this guide is not

Unit tests are `npm run test`. The browser suite is `npm run e2e`, and it is the happy path only. Model checks are `npm run evals`. None of those replace walking a screen yourself.
