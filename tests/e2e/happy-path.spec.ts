import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { strings } from "@/copy/strings";

import { createE2ESession } from "./helpers/auth";
import { deleteE2EUser } from "./helpers/cleanup";
import { happyPathReady } from "./helpers/env";
import { libraryToResumeText } from "./helpers/resume-text";

const AI_TIMEOUT_MS = 120_000;
const copy = strings;

test.describe("happy path", () => {
  test.skip(!happyPathReady(), "Needs Anthropic and Supabase secrets in .env.");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(8 * 60 * 1000);

  let userId: string | undefined;

  test.afterEach(async () => {
    if (!userId) return;
    const id = userId;
    userId = undefined;
    await deleteE2EUser(id);
  });

  test("sign in → import → job → tailor → letter → export → board", async ({
    page,
    baseURL,
  }) => {
    const origin = baseURL ?? "http://127.0.0.1:3000";
    const session = await createE2ESession(origin);
    userId = session.userId;

    const resumeText = libraryToResumeText(
      JSON.parse(
        readFileSync(join(process.cwd(), "evals/fixtures/libraries/cs-grad.json"), "utf8"),
      ),
    );
    const posting = readFileSync(
      join(process.cwd(), "evals/fixtures/postings/junior-dev.txt"),
      "utf8",
    );

    await page.goto(session.signInUrl);
    await expect(page).toHaveURL(/\/library\/import/, { timeout: 30_000 });
    await expect(
      page.getByRole("heading", { name: copy.pages.libraryImport.title }),
    ).toBeVisible();
    await expect(page.getByText(copy.library.import.welcome)).toBeVisible();

    await page.getByRole("tab", { name: copy.library.import.pasteTab }).click();
    await page.getByLabel(copy.library.import.pasteLabel).fill(resumeText);
    await page.getByRole("button", { name: copy.library.import.read }).click();
    await expect(page.getByRole("button", { name: copy.library.import.save })).toBeVisible({
      timeout: AI_TIMEOUT_MS,
    });
    await page.getByRole("button", { name: copy.library.import.save }).click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
    await expect(
      page.getByRole("heading", { name: copy.pages.dashboard.gettingStarted }),
    ).toBeVisible();

    await page.getByRole("link", { name: copy.pages.dashboard.steps.job }).click();
    await expect(page).toHaveURL(/\/jobs\/new/, { timeout: 15_000 });
    await page.getByLabel(copy.jobs.postingLabel).fill(posting);
    await page.getByRole("button", { name: copy.actions.addJob }).click();
    await expect(page).toHaveURL(/\/jobs\/[0-9a-f-]+/i, { timeout: AI_TIMEOUT_MS });
    await expect(page.getByRole("button", { name: copy.jobs.result.retry })).toHaveCount(0);

    const company = await jobCompany(page);

    await openHref(
      page,
      page.getByRole("link", { name: copy.jobs.documents.promptAction }),
    );
    await expect(page).toHaveURL(/tab=documents/, { timeout: 15_000 });
    await expect(page.getByRole("button", { name: copy.actions.tailorResume })).toBeEnabled({
      timeout: AI_TIMEOUT_MS,
    });

    await page.getByRole("button", { name: copy.actions.tailorResume }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: copy.actions.tailorResume })
      .click();
    await expect(resumeOpenLink(page)).toBeVisible({ timeout: AI_TIMEOUT_MS });
    await expect(page.getByText(copy.jobs.documents.failed)).toHaveCount(0);

    await expect(page.getByRole("button", { name: copy.actions.writeCoverLetter })).toBeEnabled();
    await page.getByRole("button", { name: copy.actions.writeCoverLetter }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: copy.actions.writeCoverLetter })
      .click();
    await expect(letterOpenLink(page)).toBeVisible({ timeout: AI_TIMEOUT_MS });
    await expect(page.getByText(copy.jobs.letters.failed)).toHaveCount(0);

    await resumeOpenLink(page).click();
    await expect(page).toHaveURL(/\/resumes\//, { timeout: 15_000 });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const pdfResponse = page.waitForResponse(
      (response) =>
        /\/api\/resumes\/[^/]+\/pdf(?:\?|$)/.test(response.url()) && response.ok(),
    );
    await page.getByRole("button", { name: copy.jobs.workspace.exportMenu, exact: true }).click();
    await page.getByRole("menuitem", { name: copy.jobs.workspace.exportPdf }).click();
    const pdf = await pdfResponse;
    expect(pdf.headers()["content-type"] ?? "").toContain("application/pdf");
    await expect(
      page.getByRole("heading", { name: copy.jobs.workspace.exportReadyTitle }),
    ).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: copy.jobs.workspace.exportNotYet }).click();

    await page.goto("/jobs");
    await expect(page.getByRole("heading", { name: copy.pages.jobs.title })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: copy.jobs.board.moveToFor(company) }).click();
    await page.getByRole("menuitem", { name: copy.jobs.detail.statuses.APPLIED }).click();
    await expect(
      page.getByRole("region", { name: copy.jobs.detail.statuses.APPLIED }).getByRole("link", {
        name: company,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: copy.jobs.detail.statuses.SAVED }).getByRole("link", {
        name: company,
      }),
    ).toHaveCount(0);
  });
});

function resumeOpenLink(page: Page) {
  return page
    .getByRole("region", { name: copy.jobs.documents.title })
    .getByRole("link", { name: /^Open / });
}

function letterOpenLink(page: Page) {
  return page
    .getByRole("region", { name: copy.jobs.letters.title })
    .getByRole("link", { name: /^Open / });
}

/** shadcn Button-as-Link clicks often don't run Next client navigation in Playwright. */
async function openHref(page: Page, link: ReturnType<Page["getByRole"]>) {
  const href = await link.getAttribute("href");
  if (!href) throw new Error("Link had no href.");
  await page.goto(href);
}

async function jobCompany(page: Page): Promise<string> {
  const line =
    (await page
      .getByRole("heading", { level: 1 })
      .locator("xpath=following-sibling::p[1]")
      .textContent()) ?? "";
  const company = line.split(" · ")[0]?.trim();
  if (!company) {
    throw new Error("Job company was empty after analysis.");
  }
  return company;
}
