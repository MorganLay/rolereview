# Eval notes

Run `npm run evals` before merging a change to prompts, schemas, models, or effort. Each run writes `evals/out/<timestamp>/<pair>.json` (gitignored) and prints a metrics table. The console table has no resume, posting, or letter text.

A full run is 4 libraries × 6 postings: ANALYZE, then TAILOR (one page, no emphasis), then the fabrication guard and match score. Even-numbered pairs in that sorted order also run COVER_LETTER (12 letters). Those alternate a fixed WHY note and no WHY text, starting with the note. Resume focus is the included bullet refs when that pair's tailor succeeded. The letter's cost is included in the pair's `$cost`. A second table lists letter reverts and letter words. Import fixtures are not in this folder yet.

Calls are charged to `SEED_USER_ID` and count toward that account's quota. If remaining analyses, tailors, or cover letters are below the counts the run needs, the script exits before any model call. Free allows 1 cover letter per month. Pro allows 60.

## Letter rubric

After a run, read 5 letters whose file has `letter.whyProvided` set to false. For each one: does it invent a company fact, value, product, news item, or culture detail that is not in the posting? Record the answer in the run section. Any invented company fact means the prompt gets fixed before merging.

## Rubric

Read 5 pairs from the run. For each one, answer:

1. Any claim not supported by its source?
2. Were the most relevant items selected?
3. Does it read like a strong human-written resume?
4. Is the summary grounded?

## Fail conditions

- Any fabrication in this review → fix the prompt before merging.
- Average reverts per tailored resume over 0.5 → tighten the prompt.

## Runs

### 2026-10-22 `2026-10-22T07-51-35-901Z`

24 pairs, all succeeded. Average resume reverts **0.00**. Average letter reverts **0.75** across 12 letters. Total estimated cost about **$0.62**. One page, no emphasis. Letters use a professional tone and standard length. Even pair indexes only.

The five no-WHY letters are the odd letter ordinals in that list: `bi-analyst__government-it`, `cs-grad__data-analyst`, `cs-grad__product`, `frontend-dev__government-it`, `retail-changer__data-analyst`.

| Pair | Invented company fact? |
|---|---|
| bi-analyst__government-it | No. Permits, recreation bookings, staff directories, clerk views, and plain-language notes are in the posting. |
| cs-grad__data-analyst | No. Policy and claims reports, the weekly pack, and the two-year requirement are in the posting. |
| cs-grad__product | No. Store managers, short requirements, release notes, and "not a coding role" are in the posting. |
| frontend-dev__government-it | No. The same City of Northwater duties are the reason for interest. |
| retail-changer__data-analyst | No. File checks, emailed Excel files, and teaching branch managers the filters are in the posting. |

A sixth no-WHY letter, `retail-changer__product`, says Keel & Co's software is "built around pickup orders." The posting says grocers use it for specials and pickup orders. That narrows the product. It does not add a value, a news item, or a product the posting does not name. No prompt change in this task.

Letter reverts are sentences the guard removed because of a number. The review above is the letter after that guard.

### 2026-10-21 `2026-10-21T05-26-59-411Z`

24 pairs, all succeeded. Average reverts **0.00**. Dropped bullets 0 on every pair. Total estimated cost **$0.48**. One page, no emphasis.

The five pairs are a shuffle of the filenames, seeded from that timestamp, first five: `frontend-dev__product`, `retail-changer__product`, `retail-changer__government-it`, `cs-grad__government-it`, `cs-grad__junior-dev`.

| Pair | Unsupported claim? | Best items selected? | Reads like a person? | Summary grounded? |
|---|---|---|---|---|
| frontend-dev__product | Yes | Fair for a weak fit | Yes | No |
| retail-changer__product | One extra word | Yes | Yes | Mostly |
| retail-changer__government-it | No | Relevant items are in, retail still leads | Yes | Yes |
| cs-grad__government-it | No | Yes | Yes | Yes |
| cs-grad__junior-dev | No | Yes | Yes | Yes |

**frontend-dev__product.** Bullets keep the source numbers (40 to 11, 4 squads, 30 components, 22 bugs). The summary says "three at Birchlane Studio". That role is 2019-08 to 2022-03, about two years and seven months, not three. It also says she worked directly with product squads. The source says the design system was used by 4 product squads. Score 15, and the missing product-analyst requirements stay missing. No prompt change in this task.

**retail-changer__product.** Bullets match their sources. The summary calls Quinpool Library Drop-in a public library. The org name does not say public. Selection fits the posting: orders, training, the catalogue, and tutoring are included. Excel is a library skill. Pivot tables and SQL stay missing.

**retail-changer__government-it.** No new tools or employers. Score 10. The certificate, the catalogue, and the tutoring are included. Three retail bullets still lead a developer resume. One volunteer bullet adds "as a volunteer computer tutor", which matches the entry title.

**cs-grad__government-it.** Internship, help-desk wiki, and the Java/SQL project are the right lead. Numbers match (12 supervisors, 40 stops, 18 cases, 25 tickets, 6 pages, 120 parts). "Experienced" in the summary is a strong word for one internship. The facts under it are in the library.

**cs-grad__junior-dev.** Same library, aimed at the junior role. React, TypeScript, Python, Jest, SQL, and the degree are selected. HTML and CSS stay missing. Git is a library skill and is listed. The summary's "University of Ottawa, 2026" matches the education end date.

Two bullets drop a second sentence that is in the source and does not help the application: the shop did not deploy the inventory app, and the cash drawer was short twice in 2025. What remains is still in the source. Those omissions are not new claims.

Revert average is under 0.5. The Birchlane tenure and the "worked directly with product squads" line are the fabrications to fix in the prompt before a prompt change merges.
