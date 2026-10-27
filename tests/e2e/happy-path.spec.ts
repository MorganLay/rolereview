import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { strings } from "@/copy/strings";

import { createE2ESession } from "./helpers/auth";
import { deleteE2EUser } from "./helpers/cleanup";
import { happyPathReady } from "./helpers/env";
import { pdfPlainText } from "./helpers/pdf-text";
import { libraryToResumeText } from "./helpers/resume-text";

const AI_TIMEOUT_MS = 120_000;
/** Not in the library fixture. The edit must survive a leave and a PDF export. */
const EDIT_TOKEN = "e2e-persist";
/** The editor rejects a bullet longer than this. */
const BULLET_MAX = 400;
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
      page.getByRole("link", { name: copy.jobs.nextAction.tailor }),
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

    const resumePath = resumePathname(page.url());
    await appendTokenToIncludedBullet(page, EDIT_TOKEN);
    await openHref(page, page.getByRole("link", { name: copy.jobs.workspace.back, exact: true }));
    await expect(page).toHaveURL(/\/jobs\/[0-9a-f-]+/i, { timeout: 15_000 });
    await expect(page).not.toHaveURL(/\/resumes\//);
    await page.goto(resumePath);
    await expect(page).toHaveURL(/\/resumes\//, { timeout: 15_000 });
    await expect(editedBullet(page, EDIT_TOKEN)).toBeVisible({ timeout: 15_000 });

    const pdfResponse = page.waitForResponse(
      (response) =>
        /\/api\/resumes\/[^/]+\/pdf(?:\?|$)/.test(response.url()) && response.ok(),
    );
    await page.getByRole("button", { name: copy.jobs.workspace.exportMenu, exact: true }).click();
    await page.getByRole("menuitem", { name: copy.jobs.workspace.exportPdf }).click();
    const pdf = await pdfResponse;
    expect(pdf.headers()["content-type"] ?? "").toContain("application/pdf");
    await expectPdfContainsEdit(pdf);
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

function editedBullet(page: Page, token: string) {
  return page.getByRole("button", { name: new RegExp(`^Edit:.*${token}`) });
}

function resumePathname(url: string): string {
  const parsed = new URL(url);
  return `${parsed.pathname}${parsed.search}`;
}

/** One included bullet, so the token is on the resume that export draws. */
async function appendTokenToIncludedBullet(page: Page, token: string) {
  const articles = page.locator("article");
  const count = await articles.count();
  for (let index = 0; index < count; index += 1) {
    const article = articles.nth(index);
    const entrySwitch = article.getByRole("switch", { name: /^Include (?!bullet:)/ });
    if ((await entrySwitch.count()) === 0) continue;
    if (!(await entrySwitch.first().isChecked())) continue;

    const bulletSwitches = article.getByRole("switch", { name: /^Include bullet: / });
    const bulletCount = await bulletSwitches.count();
    for (let bulletIndex = 0; bulletIndex < bulletCount; bulletIndex += 1) {
      const bulletSwitch = bulletSwitches.nth(bulletIndex);
      if (!(await bulletSwitch.isChecked())) continue;
      const label = (await bulletSwitch.getAttribute("aria-label")) ?? "";
      const text = label.slice("Include bullet: ".length).trim();
      if (text.length === 0 || text.includes(token)) continue;
      if (text.length + 1 + token.length > BULLET_MAX) continue;

      const row = bulletSwitch.locator("xpath=ancestor::li[1]");
      await row.getByRole("button").first().click();
      const field = page.getByRole("textbox", { name: copy.library.bullets.label });
      await expect(field).toBeVisible();
      await field.fill(`${text} ${token}`);
      const saveResponse = page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          response.ok() &&
          response.url().includes("/resumes/"),
        { timeout: 20_000 },
      );
      await field.press("Enter");
      await expect(field).toBeHidden();
      await expect(editedBullet(page, token)).toBeVisible();
      await saveResponse;
      await expect(page.getByText(copy.jobs.workspace.saveFailed)).toHaveCount(0);
      await expect(editedBullet(page, token)).toBeVisible();
      return;
    }
  }
  throw new Error("No included bullet had room for the edit.");
}

async function expectPdfContainsEdit(pdf: Awaited<ReturnType<Page["waitForResponse"]>>) {
  const extracted = pdfPlainText(await pdf.body());
  if (extracted === null) {
    // Glyph ids without a ToUnicode map are not searchable here.
    // tests/unit/export-parity.test.ts checks that copy, PDF lines, and DOCX match.
    expect(pdf.ok()).toBeTruthy();
    return;
  }
  expect(extracted).toContain(EDIT_TOKEN);
}

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
