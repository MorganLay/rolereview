# Feedback

Notes from using the live site. Add new ones under **Open**. One note per entry. Shipped notes are removed after they become tasks in `docs/06-ROADMAP.md`.

## Open

**Screen:** Library, starting with no resume.
**What I did:** I have not played much with the empty library. Import is the path I know.
**What felt wrong:** Someone who does not already have a resume needs a way to build the library from nothing. I want that later, after the library and tailoring pass. When this becomes a task, decide how a guided start writes entries and bullets without inventing facts.

**Screen:** Library. Completeness card, profile dialog, bullet strength, and the tailored resume.
**What I did:** Looked at the library while the profile already had a name, a location, and a summary, and the headline was still empty. A Good bullet was told that a number is what would make it Strong. An education line, “Coursework in software engineering…”, was told to start with an action verb. The default summary ends by seeking an IT Developer (CS-01, Stream 2) role. The email on the profile cannot be edited.
**What felt wrong:** The library evaluates the writing and does not help me improve it or reuse it. I want three things, ahead of more dashboard functionality. First, evidence-grounded bullet improvements: a Rewrite that clarifies without new facts, a Strengthen that asks one or two questions and then revises, and a Tailor that reframes an approved bullet for one job. Coursework is a fact, not an accomplishment, so the check has to know what kind of bullet it is. Second, suggested headlines and summaries from the experience I already have, each with a short reason, editable, with one default. About 3–5 saved headlines, and a way to add more. A headline can name what I do. A past job title stays the real title. Third, and the one I care about most: keep several approved headlines, summaries, and bullets, then pick the combination for this job and say why in a sentence. No fake “94% match.” A tailored resume can still propose a new rewrite from the original when no saved variant fits. Each rewrite stays tied to its source, with why it was made, whether I approved it, and whether it is general or for one job. The same propose, review, approve, select, and adapt path should cover headlines, summaries, and bullets. Also: the completeness line should name only the empty fields, and those words should open that field. The reusable summary should stay neutral, and the CS-01 wording should be a job-specific variant. Sign-in email and the email on the resume should be different values. Weakest bullets should be the ones that need clarification, evidence, or a real rewrite. A Good bullet does not automatically belong there. Learning from what I accept or reject can wait. When this becomes a task, decide how that shared variant store sits beside the 1.1 bullet coach and target profiles. The coach already plans three rewrites and questions, with a placeholder where a number is missing. A target profile is a preset of entries, skills, and emphasis. Neither stores approved wording or explains which wording was chosen for a job.

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
