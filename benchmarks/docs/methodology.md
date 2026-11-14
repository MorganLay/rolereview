# Benchmark design justification

## Why these professions

The first five real records are the ResumeBench profiles that could be inspected and redistributed under CC-BY-4.0. The next fifteen are CareerCorpus examples chosen because their text is a different occupation from those five and from each other: revenue-cycle accounting, FP&A, construction and hotel restaurant work, branch banking with store management, secondary math, hospital discharge planning, a nursing aide, B2B sales, school administration, a one-line cashier, conveyor maintenance, graphic design, title-only HR, PR and social, and apparel design. They were not chosen to represent the labour market. Near-duplicate finance resumes were read and left out.

## Why these candidates

P001 has a long industrial electrical career and a named electrical supervisor licence. P002 is military logistics mislabeled as legal by the dataset. P003 is a Pega analyst whose client is a health agency and whose degree is mechanical. P004 has real Canvas administration written in very thin bullets, plus secretary work. P005 has quantified incident response and one SSO bullet that is easy to over-read.

P006 through P020 add the occupations named above. P012 and P015 are sparse on purpose. P018 has titles and almost no duties. P010 holds a Maryland teaching certificate. P008 says "CPA listed" without a sentence that grants the licence. Publisher category labels were not trusted: several "apparel" rows are sales, administration, design, or maintenance.

## Why these jobs

Each sourced person has three public postings, except that the original five were not given new postings in the expansion. P001 still has no strong data-center match. P003 still has no strong software match. The synthetic library still has two fictional postings. Fit was set from the posting text and the resume. A mandatory certificate the person does not hold keeps a pair at adjacent or stretch even when the daily work is related. One Medical's float-admin text was dropped because it repeated the front-desk ad.

## Seniority and resume quality

The sourced resumes range from a one-line cashier and a title-only HR record to plant management, an O-4 logistics role, a senior Pega architect, and a senior security engineer. P004, P015, and P018 are weakly written. P001, P005, P006, P007, and P010 are specific. CareerCorpus dates are whatever the publisher left in the cell. Missing dates were not filled in.

## Problems that are represented

The original set covers transferable industrial work, military-to-civilian logistics, a health-agency systems client who is not a clinician, vague LMS bullets, duplicate fictional employment, a retail line competing with technical lines, clearance and ITAR language, an electrical licence beside a staff cloud job, and a senior security engineer beside an AI staff posting.

The expansion adds revenue-cycle accounting, FP&A versus actuarial language, a CPA phrase that is not a licence, hotel food-cost work, branch banking versus mortgage origination, a Maryland math certificate, maternal discharge planning, a nursing aide against a medical-assistant certificate and a nurse-practitioner licence, quota sales, school administration, a one-line cashier, conveyor maintenance, graphic design versus apparel design, title-only HR, and PR versus paid social and marketing analytics.

## Problems that are not represented

A registered nurse, a civil engineer, a licensed electrician, GIS, and a music teacher with a music posting. CareerCorpus contained a nursing aide and a lead mechanic, not those licences. The Kaggle LiveCareer zip, which advertises healthcare, construction, and design categories beyond this subset, still requires a Kaggle login.

## What the sample size allows

The three paid cases already on disk cover one security resume, one thin LMS resume, and one electrical resume. They were not rerun. A later paid run can say how a sourced pair behaved. It still cannot speak for registered nurses, civil engineers, or the broader market. Three jobs for one person are one person, counted three times.
