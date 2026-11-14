# Acquisition notes

Date of inspection: 2026-11-12.

## Resumes

**Careerflow ResumeBench** (`https://huggingface.co/datasets/Careerflow/ResumeBench`), also described as ResumeExtractBench. CC-BY-4.0. The `test.jsonl` split was downloaded (30 records, about 249 KB of JSON, not the PDFs).

Inspected all 30. Five are labeled `real-anonymized` (engineering, legal, government, education, consulting). The other 25 are synthetic-forge, expert-canva, synthetic-latex, handwritten templates, synthetic-legal, or synthetic-government. Those 25 were not used as candidates. Several Canva records are Jane Doe templates.

The five used records are P001–P005. Published names were kept. Email, phone, and profile URLs were not copied. Dates in the published ground truth were empty, so none were invented. Employers and bullet text were copied from that ground truth. The publisher's domain label does not always match the jobs: P002 is filed as legal and the jobs are military logistics; P003 is filed as government and the jobs are Pega delivery.

**CareerCorpus** (`https://data.mendeley.com/datasets/wzzwn37gmd/1`). The first attempt, recorded below as history, could not download the file. A later call to the public dataset endpoint `https://data.mendeley.com/public-api/datasets/wzzwn37gmd` returned the file id and a public download URL. `https://api.mendeley.com/datasets/wzzwn37gmd` still answers that an auth header is required. The workbook `CareerCorpus.xlsx` (124,525 bytes, SHA-256 `97b1fa6cca1232912dd3f7bc312d71a2478249787168fd41dfbf6c1da90479d3`, matching the metadata) was inspected in full: 302 usable rows, 50 or 51 in each of Banking, Finance, Accountant, Teacher, Apparel, and Research Assistant. Fifteen rows are now P006–P020. They are adapted public examples, not verified applicants. The raw workbook is not in the repo.

**Kaggle Resume Dataset** (`https://www.kaggle.com/datasets/snehaanbhawal/resume-dataset`). The public page is readable and names the licence as CC0. The file distribution says a subscription is required. No Kaggle CLI and no `kaggle.json` were present, so the zip was not downloaded. A GitHub repository that looked like a mirror held only 133-byte pointer files. LiveCareer was not scraped.

## Jobs

Public Greenhouse boards were listed without an API key: Cloudflare, GitLab, Datadog, Elastic, Twilio. Shopify and Notion returned no job list. Fifteen postings were fetched with `content=true` on 2026-11-12 and stored as plain text. Employers retain copyright. The capture is for repeating the evaluation after a posting closes. It is not a licence to republish the postings for other uses.

Ashby and O*NET were not used. O*NET is an occupational reference, not a set of postings, so it was not treated as job-description evidence.

## Second pass, same day

**Lynceus/jobs** on Hugging Face is CC-BY-4.0 and has titles, employers, and locations only. It was not used as job text.

**HeadcountLabs/job-postings** returned `Invalid username or password` from the Hugging Face dataset API.

Greenhouse boards that returned jobs and were used for the new postings include Achievement First, One Medical, Oscar, Sweetgreen, Reformation, Formlabs, Brex, SoFi, Coursera, Airbnb, Zocdoc, Chime, Gusto, Everlane, Duolingo, Instacart, and Peloton. Many hospital, retailer, hotel, and contractor tokens returned no board. No music-teacher, civil-engineer, or electrician posting turned up on the boards that answered. A Formlabs production-equipment maintenance technician posting is the trades match. One Medical's nurse-practitioner posting is the clinical stretch. There is still no sourced registered-nurse resume in either dataset.

## What the sample cannot support

Twenty sourced profiles are still not a sample of registered nursing, civil engineering, licensed electrical work, or GIS. The nursing evidence is an aide. The trade evidence is conveyor maintenance, not an apprenticeship licence. Fifteen of the profiles are GPT-standardized public examples, so a bullet may already differ from the resume a person once posted. Two synthetic cases are not applicants.

Sixty sourced pairs are correlated: three jobs share one person. They are not 60 independent candidates, and they are not a statistical picture of hiring.
