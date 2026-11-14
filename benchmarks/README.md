# Resume benchmark

Compares RoleRefine's tailoring pipeline with a single direct prompt, `prompts/direct-baseline-v1.md`. `validate`, `dry-run`, and `report` do not call a model. `execute` sends only when `--confirm-spend`, a positive `--max-usd`, and `--send` are all present.

## What is curated

Twenty sourced profiles and sixty sourced pairs, plus two synthetic regression cases. Five profiles are Careerflow ResumeBench records the publisher labels real-anonymized, CC-BY-4.0. Fifteen more are CareerCorpus public examples, also CC-BY-4.0, labeled adapted because the publisher standardized them with GPT-5. They are not verified applicants. Names and contact details were already removed by that publisher. A personal portfolio URL was removed from the apparel designer and not replaced.

Job text is from public Greenhouse boards. Employers keep the copyright. The capture is for repeating an evaluation after a posting closes.

Registered nursing, civil engineering, and a licensed-electrician posting were not acquired. See `sources/acquisition-notes.md` and `docs/coverage.md`.

## Commands

```powershell
npm run bench:validate
npm run bench:dry-run
npm run bench:report -- --id P005-J013
npm run bench:case -- --id P005-J013 --confirm-spend --max-usd 2
npm run bench:smoke -- --confirm-spend --max-usd 5
npm run bench:full -- --confirm-spend --max-usd 25
```

`validate`, `dry-run`, and `report` never authorize a paid call. `execute` refuses without `--confirm-spend` and a positive `--max-usd` that covers the worst-case estimate. Without `--send` it writes `benchmarks/results/<run>/plan.json` with status `authorized-not-sent`. `--send` uses the production prompts and stops before the next call would pass the cap. The three paid cases already stored under `benchmarks/results/` were not regenerated.

A case report before a paid run says the outcome is not yet evaluated. It does not invent a winner.
