# Feedback

Notes from using the live site. Add new ones under **Open**. One note per entry. Shipped notes are removed after they become tasks in `docs/06-ROADMAP.md`.

## Open

**Screen:** Import, after a resume is read, when the library is empty.
**What I did:** Asked for a reminder to add a lot of different tests that also test a person’s input. If enough validations fail, I think it should probably go to the manual editing anyway.
**What felt wrong:** The confirmation tests only count sections and flag a blank bullet or one over 400 characters. They do not run a person’s upload or paste through the screen. One problem stays on the confirmation to shorten or leave out, and several problems would still sit there. I want a wide set of tests around what a person actually submits. Once enough checks fail, the full review should open instead. When this becomes a task, decide how many failures, and which kinds, send them to the review. One isolated bullet can stay on the confirmation. A mix of dates, titles, and bullets should open the review.

**Screen:** Jobs, across the search. No screen for this exists yet.
**What I did:** Asked whether the plan includes reading Gmail, or whatever email is linked, for updates on the jobs and updating those jobs, like a full assistant.
**What felt wrong:** Nothing in 1.0, 1.1, or 1.2 reads an inbox. Email in 1.1 is mail RoleRefine sends (reminders, a weekly summary, a renewal heads-up, an offer note, a quota-reached note). The timeline can record an email I log myself. I want a linked mailbox, Gmail first, watched for recruiter and employer mail, matched to a job, and the job updated from it. When this becomes a task, decide whether a detected update is applied or shown for confirmation first. Status only moves through the pipeline, and a wrong match should not move a job on its own. This is inbound tracking. Auto-apply stays out of scope.

**Screen:** New job, Deadline.
**What I did:** Started a job from a posting that had no date. The deadline field was empty. The hint says a reminder is set for 3 days before.
**What felt wrong:** With no date, nothing reminds me to apply. I want the field to start as 7 days from today, and I still want to change or clear it on this job. The reminder stays 3 days before that date, so it falls on day 4. Counting the reminder day through the deadline is four days to apply. Settings → Preferences should hold that default: how many days ahead, or none. Seven days is the default I want. A shorter one would nudge me before I have had time to tailor; a longer one is easy to ignore. When this becomes a task, decide whether a filled default is the posting’s close date. Soon, Past, and the dashboard treat that date as the day the posting closes, so a guessed week will show Past once it passes.

**Screen:** Settings, Plan & billing.
**What I did:** Opened Plan & billing on a Pro account at localhost.
**What felt wrong:** The plan card stacks “Stripe hosts the payment page” and the whole renewal explanation into one dense paragraph under the price buttons. In Usage, “2 extra” and “Up to 40 a day” sit tight against the bars and are hard to read.

**Screen:** Dashboard, Getting started, before any library or job exists.
**What I did:** Landed on the dashboard and hovered a to-do row.
**What felt wrong:** The checklist is quiet. Four thin rows and a second list repeat the same steps, and nothing reads as the one next action. On hover, the line under the number and the line under the words are not straight.

Copy this for each note:

**Screen:**
**What I did:**
**What felt wrong:**
