import { expect, test, type Page } from "@playwright/test";

import { strings } from "@/copy/strings";

import { createE2ESession } from "./helpers/auth";
import { deleteE2EUser } from "./helpers/cleanup";
import { e2eAuthReady } from "./helpers/env";
import { seedOverflowFixtures, type OverflowFixtures } from "./helpers/overflow-fixtures";

const copy = strings;
const WIDTHS = [375, 390] as const;

test.describe("mobile overflow", () => {
  test.skip(!e2eAuthReady(), "Needs Supabase secrets in .env.");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(12 * 60 * 1000);

  let userId: string | undefined;

  test.afterEach(async () => {
    if (!userId) return;
    const id = userId;
    userId = undefined;
    await deleteE2EUser(id);
  });

  test("app routes stay within 375 and 390 px", async ({ page, baseURL }) => {
    const origin = baseURL ?? "http://127.0.0.1:3000";
    const session = await createE2ESession(origin, "/dashboard");
    userId = session.userId;

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(session.signInUrl, { waitUntil: "commit", timeout: 120_000 });
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 60_000 });
    await expectShell(page, "/dashboard");

    const fixtures = await seedOverflowFixtures(session.userId);
    const routes = appRoutes(fixtures);

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 812 });
      for (const path of routes) {
        await gotoApp(page, path);
        await expectShell(page, path);
        if (path !== "/admin") {
          await expect(
            page.getByRole("heading", { name: copy.errors.notFound.title }),
            path,
          ).toHaveCount(0);
        }
        const extra = await horizontalOverflow(page);
        expect(extra, `${path} at ${width}px overflows by ${extra}px`).toBeLessThanOrEqual(0);
      }
    }

    await page.setViewportSize({ width: 390, height: 812 });
    await page.goto("/dashboard");
    await expect(page.getByRole("button", { name: copy.feedback.button })).toHaveCount(0);
    await page.getByRole("button", { name: copy.shell.userMenuAria }).click();
    await page.getByRole("menuitem", { name: copy.feedback.button }).click();
    await expect(page.getByRole("heading", { name: copy.feedback.title })).toBeVisible();
    const message = page.getByLabel(copy.feedback.messageLabel);
    await message.click();
    await expect(message).toBeInViewport();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await page.keyboard.press("Escape");

    await page.setViewportSize({ width: 390, height: 480 });
    await page.goto("/jobs/new");
    const posting = page.getByLabel(copy.jobs.postingLabel);
    await posting.click();
    await expect(posting).toBeInViewport();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/dashboard");
    await expect(page.getByRole("button", { name: copy.feedback.button })).toBeVisible();
    await page.getByRole("button", { name: copy.shell.userMenuAria }).click();
    await expect(page.getByRole("menuitem", { name: copy.feedback.button })).toHaveCount(0);
    await expect(page.getByRole("menuitem", { name: copy.auth.signOut })).toBeVisible();
  });
});

function appRoutes(fixtures: OverflowFixtures): string[] {
  const tabs = [
    "overview",
    "documents",
    "interviews",
    "contacts",
    "timeline",
    "reminders",
    "offer",
  ];
  return [
    "/dashboard",
    "/library",
    "/library/import",
    "/library/targets",
    "/jobs",
    "/jobs?view=list",
    "/jobs/new",
    ...tabs.map((tab) => `/jobs/${fixtures.jobId}?tab=${tab}`),
    `/jobs/${fixtures.jobId}/resumes/${fixtures.resumeId}`,
    `/jobs/${fixtures.jobId}/letters/${fixtures.letterId}`,
    "/contacts",
    "/insights",
    "/settings",
    "/settings?tab=profile",
    "/settings?tab=preferences",
    "/settings?tab=plan",
    "/settings?tab=data",
    "/milestones",
    "/admin",
  ];
}

async function gotoApp(page: Page, path: string): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await page.goto(path, { waitUntil: "commit", timeout: 60_000 });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (attempt === 1 || !message.includes("ERR_ABORTED")) {
        throw new Error(`${path}: ${message}`);
      }
    }
  }
}

function expectShell(page: Page, path: string) {
  return expect(
    page.getByRole("button", { name: copy.shell.userMenuAria }),
    path,
  ).toBeVisible({ timeout: 60_000 });
}

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}
