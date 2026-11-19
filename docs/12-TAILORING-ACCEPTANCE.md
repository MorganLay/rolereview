# RoleRefine — Resume Tailoring Branch Acceptance Criteria

TB.1. This is the acceptance criteria for the tailoring experiment. It is not the next beta task. Production tailoring stays as it is until this document is met. The boxes stay open until the evidence is in the saved runs.

## Objective

The resume-tailoring branch must demonstrate that RoleRefine can produce truthful, persuasive, job-specific resumes using the candidate's full available career history, without unnecessarily degrading the editorial decisions of the underlying Claude model.

A successful implementation must preserve RoleRefine's differentiators: source-level provenance, factual safeguards, an editable experience library, structured outputs, and reliable PDF generation.

The benchmark-only plan-faithful composition experiment and the observed P014/P006 results are mandatory regression evidence.

## AC-01 — Complete Career Evidence

- [ ] The tailoring model can consider the complete normalized experience library, including relevant and irrelevant historical employment, projects, education, certifications, and skills.
- [ ] Distinct jobs are represented as independently selectable entries.
- [ ] Accomplishments are attributed only to supported roles.
- [ ] Ambiguous source relationships are preserved without invention.
- [ ] No material evidence is silently lost during import, normalization, or model-input preparation.
- [ ] Source identifiers remain stable and traceable.
- [ ] Large libraries have explicit context and cost handling; evidence truncation cannot occur silently.

## AC-02 — Model-Led Editorial Decisions

- [ ] The model can determine which jobs, projects, skills, and accomplishments best support a particular application.
- [ ] Older but relevant experience can take precedence over recent, less relevant employment.
- [ ] Explicit omissions are recorded with meaningful rationales.
- [ ] Irrelevant experience is not included merely to preserve chronological completeness.
- [ ] Relevant evidence is not excluded solely because it has weak keyword overlap.
- [ ] Distinct accomplishments are evaluated for marginal hiring value, not just source-reference uniqueness.
- [ ] The model can construct a coherent career narrative across multiple roles and projects.

No rule should universally exclude an employment category such as retail work.

## AC-03 — Multiple Grounded Bullets per Source

**Confirmed regression:** In P014, `preferBullets` discarded distinct, grounded payroll and grant accomplishments because their respective drafted lines reused a source reference.

- [ ] Multiple semantically distinct bullets may cite the same source reference, subject to grounding and supported-splitting limits.
- [ ] The existing `MAX_SPLITS = 2` constraint is respected unless deliberately revised with equivalent or stronger safeguards.
- [ ] Merely finding a reference in `used` is not sufficient reason to discard another distinct, grounded bullet.
- [ ] Exact or semantically duplicate accomplishments are still deduplicated.
- [ ] Unsupported numerical or factual claims remain rejected.
- [ ] Explicit plan bullet caps are respected or reconciled through an auditable editorial revision.
- [ ] A dropped bullet must have a recorded, accurate reason when its removal affects the resume.

Regression: P014 must retain independently supported payroll/budget and Title III/PECO grant accomplishments, without inventing facts.

## AC-04 — Editorial Plan and Final Document Consistency

- [ ] `lead` and `support` decisions are implemented faithfully unless validation or actual document constraints justify a change.
- [ ] Explicit `omit` decisions are respected.
- [ ] If a plan says omitted evidence will appear in another section, that section must actually contain the relevant supported evidence.
- [ ] An omitted skills entry cannot be considered covered by a skills section that does not exist.
- [ ] Final coverage validation identifies missing important evidence.
- [ ] A targeted correction or editorial reconsideration can resolve a coverage failure.
- [ ] Missing evidence is not automatically restored indiscriminately.
- [ ] The final document is validated again after any correction.

**P014 regression:** The planner omitted a skills entry because it expected a skills section. The resulting resume contained neither that skills section nor FERPA compliance.

The system must detect and resolve this contradiction. The resolution should prioritize job-relevant supported competencies rather than automatically appending the entire source skills list.

## AC-05 — Composition Must Not Arbitrarily Override Editorial Judgment

- [ ] Composition preserves distinct, grounded model-written accomplishments unless there is a documented reason to alter them.
- [ ] Source references serve as provenance, not as one-use identifiers.
- [ ] Mechanical rules cannot silently replace stronger supported wording with weaker source wording.
- [ ] Redundancy checks distinguish repeated facts from genuinely different contributions.
- [ ] Estimated page budgets do not discard high-value content when the measured document has sufficient space.
- [ ] The composer remains responsible for valid structure, compatibility, and factual constraints, rather than independently making undocumented editorial decisions.

The parallel model-led path does not have to use production `compose.ts`, but it must satisfy the same observable quality and safety requirements.

## AC-06 — Accurate Removal Diagnostics

- [ ] `page_budget` is only assigned when an actual applicable budget constraint caused removal.
- [ ] An entry removed because it has no generated bullets is not incorrectly reported as a page-budget removal.
- [ ] Distinguish explicit omission, missing draft content, invalid evidence, semantic duplication, composition trimming, and measured PDF fitting.
- [ ] Every significant content loss can be traced to its originating pipeline stage.
- [ ] Internal diagnostic identifiers such as G6, G7, G12, G15, and G16 never leak into user-visible resumes.

## AC-07 — Factual Grounding

- [ ] Every substantive factual claim is supported by original candidate evidence.
- [ ] Source citations are verified semantically, not merely checked for existence.
- [ ] Unsupported credentials, employment history, technologies, metrics, and responsibilities are rejected.
- [ ] Legitimate paraphrasing remains possible.
- [ ] Corrections are targeted and do not unnecessarily weaken supported achievements.
- [ ] No accomplishment is attributed to the wrong employer or position.
- [ ] Imported documents and job postings are treated as untrusted data rather than executable instructions.

Specific forbidden claims in applicable diagnostic fixtures include unsupported CPA, ASC 606, NetSuite, LCSW, RN/NP, board-materials, and revenue-recognition qualifications.

## AC-08 — Professional Writing Quality

- [ ] Summaries are complete, grammatical, relevant, and specific.
- [ ] No summary begins mid-sentence.
- [ ] No heading is duplicated or incorrectly nested.
- [ ] Skills are not redundantly printed as both a heading and an identical bullet.
- [ ] Bullets are concise enough to read comfortably while retaining meaningful details.
- [ ] Important quantified accomplishments are not unnecessarily generalized.
- [ ] A resume does not explicitly advertise missing licences or qualifications unless there is a compelling contextual reason.
- [ ] The document does not repeat the same hiring signal across summary, skills, and experience without adding value.

## AC-09 — Page Measurement and Fitting

- [ ] Final PDF length is measured using the actual renderer.
- [ ] Automatic and explicit page limits are respected.
- [ ] The model receives appropriate length guidance before drafting.
- [ ] A document that fits does not lose content because of unnecessary estimated-budget pruning.
- [ ] Oversized documents undergo controlled editorial reduction before arbitrary deletion of high-value accomplishments, where feasible.
- [ ] Content modified during page reduction is revalidated.
- [ ] Page-fitting removals are recorded accurately.
- [ ] Final comparison results use the measured output, not merely an intermediate draft.

**Observed regression requirement:** Both the original and experimental P014 documents fit on one page. The experimental version preserved additional grounded accomplishments without any PDF-fitting removals.

## AC-10 — Mandatory Diagnostic Cases

### P014-J055 — Senior Executive Assistant

- [ ] The normalized library preserves distinct assistant roles and appropriately handles the mixed-role source sentence.
- [ ] Two distinct supported accomplishments citing the same source can survive.
- [ ] Payroll, undergraduate/graduate budgets, accounting, and travel evidence are retained when selected.
- [ ] Title III/PECO grant-budget evidence is retained when selected.
- [ ] FERPA and other job-relevant skills are not silently lost through a false coverage assumption.
- [ ] No unsupported board-materials or revenue-recognition claim is introduced.
- [ ] Final page length is measured.
- [ ] Prior roles are either represented appropriately or explicitly omitted; an unsupported or empty heading is not considered sufficient editorial quality.

### P006-J047 — Senior Accountant

- [ ] Current and previous accountant roles remain distinct.
- [ ] Bank reconciliations for 11 subsidiaries survive.
- [ ] Collections improvement from 40% to 90% survives.
- [ ] Unsupported CPA, ASC 606, and NetSuite claims remain absent.
- [ ] Previous defensible editorial omissions are not automatically reversed.
- [ ] The modified composer does not introduce unnecessary duplication or page-length regressions.

### P011-J052 — Elementary Teacher

- [ ] Teaching and maternal/newborn discharge experience remain separate.
- [ ] The in-progress M.S.W. is represented accurately.
- [ ] Unsupported credentials remain absent.
- [ ] Editorial omission of redundant experience remains possible.
- [ ] Section headings remain well-formed.

### P012-J037 — Nurse-Practitioner Program

- [ ] Teacher, nursing-aide, receptionist, and cook experience remains independently identifiable.
- [ ] Nursing-aide duties are never presented under the teacher role.
- [ ] Appropriate inclusion or omission decisions are retained.
- [ ] No unsupported RN or NP qualification is introduced.
- [ ] The summary is complete and does not contain the previous mid-sentence fragment.

## AC-11 — Parallel Architecture Comparison

Maintain three independently identifiable benchmark arms:

1. Current production RoleRefine tailoring.
2. Strong direct-Claude baseline.
3. Experimental full-library, model-led RoleRefine tailoring.

- [ ] Equivalent candidate facts and job descriptions reach each arm.
- [ ] Use the same underlying Claude model where technically possible.
- [ ] The direct baseline is not artificially weakened.
- [ ] Prompt versions and model configurations are recorded.
- [ ] Compare final PDFs under equivalent page and layout constraints.
- [ ] Preserve per-stage outputs, cost, token usage, and latency.
- [ ] Use blinded editorial evaluation rather than source-count or phrase-count alone.
- [ ] Include longer, diverse career histories alongside the four diagnostic cases.
- [ ] Include a private comprehensive-career test when the user's actual evidence is available.

## AC-12 — Evaluation Integrity

- [ ] Exact-phrase checks are diagnostics, not final quality scores.
- [ ] Equivalent expressions such as `bank recs` and `bank reconciliations` do not automatically imply factual loss.
- [ ] `40%→90%` and `40% to 90%` are recognized as potentially equivalent claims.
- [ ] Semantic evaluation distinguishes equivalent wording from materially altered facts.
- [ ] Evaluators cannot identify the generating arm from the document or evaluation packet.
- [ ] Unsupported-claim failures are reported separately from editorial preferences.
- [ ] Results include relevance, omission quality, accomplishment strength, clarity, redundancy, provenance, page fit, cost, and latency.
- [ ] The evaluation can conclude that the current system, direct Claude, or the experimental pipeline is preferable—or that evidence is inconclusive.

## AC-13 — Production Safety and Rollout

- [ ] Existing production tailoring remains unchanged during the parallel experiment.
- [ ] No new pipeline overwrites real user resumes during benchmarking.
- [ ] Offline tests, lint, and typecheck pass.
- [ ] Paid calls require explicit approval and spending caps.
- [ ] The experimental pipeline can be disabled independently.
- [ ] Existing source-grounding guarantees are not weakened.
- [ ] Integration requires evidence of improvement across diverse cases, not just P014.
- [ ] Promotion includes regression tests, monitoring, and a rollback mechanism.

## Definition of Done

The resume-tailoring branch is ready for production consideration when:

1. Confirmed source-reference and coverage defects are resolved.
2. Factual grounding and provenance remain reliable.
3. The final page-fitted output consistently preserves important, supported evidence.
4. The system can make useful editorial omissions without losing critical qualifications.
5. The model-led experiment has been compared fairly against production RoleRefine and direct Claude.
6. The preferred implementation demonstrates a defensible balance of editorial quality, factual reliability, operating cost, latency, and maintainability.
7. Remaining limitations are documented, with no unsupported declaration of overall superiority.

**Guiding principle:** RoleRefine must add trustworthy career intelligence and workflow value without unnecessarily constraining the editorial capabilities of its foundation model.

## Evidence recorded on 2026-11-13

The boxes above stay open. No paid three-arm run has been started.

Offline checks confirm the experimental path keeps two grounded lines that share a source, rejects an unsupported number, honours an explicit omit, and reports a skills-section claim when that section was not written. It does not insert the skill list itself. Production `composeResume` still drops the second shared-source line. The fabrication guard still runs. Page count uses the PDF renderer. A rendered resume over two pages can ask Claude to shorten before the fitter runs. A sparse second page can still lose a line in the fitter without that revision. Those removals are recorded. An include phrase that survives only on a removed line can be named after the run. There is no automated judge for a weak or misleading summary. P011’s collapsed master’s wording and P012’s summary fragment, seen on the earlier model-led run, have to be read.

The proposed paid set is P006-J047, P011-J052, P012-J037, P014-J055, P001-J001, P008-J024, P010-J028, P013-J040, P016-J050, and P017-J043. Each include phrase is in the original resume and in the normalized library both RoleRefine arms receive. The direct arm receives that same original resume and the same job text. P001-J002 is not in the set: its include phrase “work instructions and maintenance plans” is not equivalent in the library, so the runner would refuse it.

All three arms use the production automatic length instruction: one page when the evidence fits, two pages as the ceiling. The direct-baseline prompt was given that sentence so the comparison does not ask it to be shorter than the other arms. One pass for ten cases is about $2.05. The worst case is about $3.55 if every follow-up runs, including a second model-led revision when the render exceeds two pages. The production command’s own gate still includes an unused import line, so that command needs a cap of at least $2.16. The model-led command needs a cap of at least $1.96. The paid run was authorized and sent on 2026-11-13. Arms A and B are in `benchmarks/results/paid-2026-11-13T16-11-06-576Z` and cost $0.7293. Arm C is in `benchmarks/results/model-led-2026-11-13T16-16-52-462Z` and cost $0.4504. Combined spend was $1.1797. All 30 fitted documents measured one page, and the fitter removed no lines.

An informed reading of those fitted resumes, not a separate blinded panel, found no overall winner. Direct Claude kept more of the quantified record on the long industrial resume, the sales ranks, and the mechanic’s summary. Model-led avoided the broken headings, the missing-licence disclaimer, and the production summary that says a certificate “is not listed in the library.” Model-led still left FERPA off P014 after a coverage revision, left the 84% to 92% availability result off P001, and left Timberline off P008. Production’s P012 summary still begins mid-sentence. Those are open failures. The boxes stay open, and TB.1 is not closed.

A later run of the outcome-first prompt, `benchmarks/results/model-led-2026-11-14T05-18-55-399Z`, cost $0.5549. It was read against the same production and direct pages. All ten new resumes measured one page, and the fitter removed nothing. The new prompt recovered the 84% to 92% availability result, Timberline, and several complete summaries. It still omitted the Electrical Supervisor Licence and FERPA, and several bullets remained fragments. Direct Claude and the outcome-first prompt were even. Neither replaced the other.
