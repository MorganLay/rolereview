import { Client } from "pg";

import { expect, test } from "@playwright/test";

import { strings } from "@/copy/strings";
import { libraryRevision } from "@/features/questions/revision";

import { createE2ESession } from "./helpers/auth";
import { deleteE2EUser } from "./helpers/cleanup";
import { envValue, happyPathReady } from "./helpers/env";

const copy = strings.jobs.questions;
const fromAnswer = strings.library.fromAnswer;
const AI_TIMEOUT_MS = 180_000;
const ANSWER =
  "I wrote validation that stopped two people booking the same tee time.";

test.describe("job questions", () => {
  test.skip(
    !happyPathReady() || envValue("JOB_QUESTIONS_ENABLED") !== "1",
    "Needs Anthropic, Supabase, and JOB_QUESTIONS_ENABLED=1 on this process and the dev server.",
  );
  test.setTimeout(8 * 60 * 1000);

  let userId: string | undefined;

  test.afterEach(async () => {
    if (!userId) return;
    const id = userId;
    userId = undefined;
    await deleteE2EUser(id);
  });

  test("answer, review, tailor, then edit the saved answer", async ({ page, baseURL }) => {
    const origin = baseURL ?? "http://127.0.0.1:3000";
    const session = await createE2ESession(origin, "/dashboard");
    userId = session.userId;

    await page.goto(session.signInUrl);
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });

    const jobId = await seedQuestions(session.userId);
    await page.goto(`/jobs/${jobId}?tab=documents`);
    await expect(page.getByRole("heading", { name: copy.title(2) })).toBeVisible();
    await page.getByRole("link", { name: copy.start }).click();

    await expect(page.getByRole("heading", { level: 1 })).toContainText("booking validation");
    await page.getByLabel(copy.prompt).fill(ANSWER);
    await page.getByRole("button", { name: copy.next }).click();
    await page.getByRole("button", { name: copy.next }).click();
    await page.getByRole("button", { name: copy.reviewAction }).click();

    const saveTailor = page.getByRole("button", { name: copy.saveTailor(1) });
    const followUp = page.getByRole("heading", { name: copy.followUp });
    const dropped = page.getByText(copy.dropped);
    await expect(saveTailor.or(followUp).or(dropped)).toBeVisible({ timeout: AI_TIMEOUT_MS });
    if (await followUp.isVisible()) {
      await page.getByRole("textbox").fill("The check ran before the booking was saved.");
      await page.getByRole("button", { name: copy.continue }).click();
      await expect(saveTailor.or(dropped)).toBeVisible({ timeout: AI_TIMEOUT_MS });
    }
    if (await dropped.isVisible()) {
      await page.getByRole("textbox").fill(ANSWER);
      await page.getByRole("button", { name: copy.updateAnswer }).click();
      await expect(saveTailor).toBeVisible({ timeout: AI_TIMEOUT_MS });
    }
    await page.getByRole("button", { name: copy.saveTailor(1) }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: strings.actions.tailorResume })
      .click();
    await expect(page).toHaveURL(/\/resumes\//, { timeout: AI_TIMEOUT_MS });
    await expect(page.getByRole("link", { name: copy.answerAbout })).toBeVisible();

    await page.goto("/library");
    await page.getByRole("button", { name: new RegExp(fromAnswer.tag) }).click();
    await expect(page.getByText("What did you change in the booking validation?")).toBeVisible();
    await page.getByLabel(fromAnswer.answer).fill(
      "I wrote validation that stopped two people booking the same tee time on one day.",
    );
    await page.getByRole("button", { name: fromAnswer.save }).click();
    await expect(
      page.getByRole("button", { name: fromAnswer.accept }).or(page.getByText(fromAnswer.dropped)),
    ).toBeVisible({ timeout: AI_TIMEOUT_MS });

    await page.goto(`/jobs/${jobId}/questions`);
    await page.getByRole("textbox").fill("I have not taken that course.");
    await page.getByRole("button", { name: copy.yes, exact: true }).click();
    await expect(page.getByRole("heading", { name: copy.addTitle })).toBeVisible({
      timeout: AI_TIMEOUT_MS,
    });
  });
});

async function seedQuestions(userId: string): Promise<string> {
  const direct = envValue("DIRECT_URL");
  if (!direct) throw new Error("DIRECT_URL is unset.");
  const client = new Client({ connectionString: direct });
  await client.connect();
  try {
    const user = await client.query(`SELECT id FROM "User" WHERE id = $1`, [userId]);
    if (user.rowCount !== 1) throw new Error("The signed-in user row was not created.");

    const entryId = crypto.randomUUID();
    const bulletId = crypto.randomUUID();
    const skillId = crypto.randomUUID();
    const jobId = crypto.randomUUID();
    const setId = crypto.randomUUID();
    const stamp = "2026-01-15T12:00:00.000Z";
    const revision = libraryRevision({
      entries: [{ id: entryId, updatedAt: stamp, bullets: [{ id: bulletId, updatedAt: stamp }] }],
      skills: [{ id: skillId, name: "TypeScript" }],
    });
    const analysis = {
      title: "Product engineer",
      company: "Northwind",
      location: null,
      seniority: "mid",
      workMode: "REMOTE",
      employmentType: "FULL_TIME",
      salary: null,
      referenceNumber: null,
      summary: "Build the booking site.",
      requirements: [
        { id: "r-booking", text: "Booking validation", importance: "must", kind: "experience" },
        { id: "r-course", text: "A booking course", importance: "nice", kind: "education" },
        { id: "r-k8s", text: "Kubernetes", importance: "nice", kind: "skill" },
      ],
      keywords: ["booking"],
    };

    await client.query("BEGIN");
    await client.query(
      `INSERT INTO "Entry" (id, "userId", kind, title, organization, "sortOrder", "createdAt", "updatedAt")
       VALUES ($1, $2, 'EXPERIENCE', 'Booking site', 'Northwind', 0, $3, $3)`,
      [entryId, userId, stamp],
    );
    await client.query(
      `INSERT INTO "Bullet" (id, "userId", "entryId", text, tags, "sortOrder", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'Maintained the booking site.', '{}', 0, $4, $4)`,
      [bulletId, userId, entryId, stamp],
    );
    await client.query(
      `INSERT INTO "Skill" (id, "userId", name, "nameKey", "sortOrder", "createdAt")
       VALUES ($1, $2, 'TypeScript', 'typescript', 0, $3)`,
      [skillId, userId, stamp],
    );
    await client.query(
      `INSERT INTO "Job"
         (id, "userId", title, company, "rawText", analysis, "analysisStatus", status, "boardOrder", "workMode", "createdAt", "updatedAt")
       VALUES ($1, $2, 'Product engineer', 'Northwind', 'Booking validation and Kubernetes.', $3::jsonb, 'READY', 'SAVED', 0, 'REMOTE', $4, $4)`,
      [jobId, userId, JSON.stringify(analysis), stamp],
    );
    await client.query(
      `INSERT INTO "JobQuestionSet" (id, "userId", "jobId", status, "libraryRevision", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'READY', $4, $5, $5)`,
      [setId, userId, jobId, revision, stamp],
    );
    await insertQuestion(client, {
      userId,
      jobId,
      setId,
      entryId,
      requirementId: "r-booking",
      kind: "DETAIL",
      question: "What did you change in the booking validation?",
      why: "The posting asks for booking validation",
      subject: "booking validation",
      topicKey: `${entryId}:booking-validation`,
      position: 0,
      status: "OPEN",
      stamp,
    });
    await insertQuestion(client, {
      userId,
      jobId,
      setId,
      entryId: null,
      requirementId: "r-course",
      kind: "CONFIRM",
      question: "Have you finished a booking course?",
      why: "The posting asks for a booking course",
      subject: "booking course",
      topicKey: "general:booking-course",
      position: 1,
      status: "NOT_YET",
      stamp,
    });
    await insertQuestion(client, {
      userId,
      jobId,
      setId,
      entryId: null,
      requirementId: "r-k8s",
      kind: "CONFIRM",
      question: "Have you used Kubernetes?",
      why: "The posting asks for Kubernetes",
      subject: "Kubernetes",
      topicKey: "general:kubernetes",
      position: 2,
      status: "OPEN",
      stamp,
    });
    await client.query(
      `INSERT INTO "AnswerTopic" (id, "userId", "topicKey", declined, "jobId", question, "createdAt", "updatedAt")
       VALUES ($1, $2, 'general:booking-course', true, $3, 'Have you finished a booking course?', $4, $4)`,
      [crypto.randomUUID(), userId, jobId, stamp],
    );
    await client.query("COMMIT");
    return jobId;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

async function insertQuestion(
  client: Client,
  row: {
    userId: string;
    jobId: string;
    setId: string;
    entryId: string | null;
    requirementId: string;
    kind: string;
    question: string;
    why: string;
    subject: string;
    topicKey: string;
    position: number;
    status: string;
    stamp: string;
  },
): Promise<void> {
  await client.query(
    `INSERT INTO "JobQuestion"
       (id, "userId", "jobId", "setId", "requirementId", "entryId", kind, question, why, subject, "topicKey", position, status, "draftDropped", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, false, $14, $14)`,
    [
      crypto.randomUUID(),
      row.userId,
      row.jobId,
      row.setId,
      row.requirementId,
      row.entryId,
      row.kind,
      row.question,
      row.why,
      row.subject,
      row.topicKey,
      row.position,
      row.status,
      row.stamp,
    ],
  );
}
