import { expect, test, type Page } from "@playwright/test";

import { strings } from "@/copy/strings";

import { createE2ESession } from "./helpers/auth";
import { deleteE2EUser } from "./helpers/cleanup";
import { e2eAuthReady } from "./helpers/env";
import { seedOverflowFixtures } from "./helpers/overflow-fixtures";

const copy = strings;

test.describe("library polish", () => {
  test.skip(!e2eAuthReady(), "Needs Supabase secrets in .env.");
  test.setTimeout(6 * 60 * 1000);

  let userId: string | undefined;

  test.afterEach(async () => {
    if (!userId) return;
    const id = userId;
    userId = undefined;
    await deleteE2EUser(id);
  });

  test("library summary and bullet menu work at mobile and desktop", async ({
    page,
    baseURL,
  }) => {
    const origin = baseURL ?? "http://127.0.0.1:3000";
    const session = await createE2ESession(origin, "/library");
    userId = session.userId;
    await seedOverflowFixtures(session.userId);

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(session.signInUrl, { waitUntil: "commit", timeout: 120_000 });
    await expect(page).toHaveURL(/\/library/, { timeout: 60_000 });
    await expectLibraryShell(page);

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expect(page.getByRole("heading", { name: copy.pages.library.title })).toBeVisible();
    await expect(page.getByLabel(copy.library.health.stripLabel)).toBeVisible();
    await expect(
      page.getByRole("heading", { name: copy.library.entries.kinds.EXPERIENCE.title }),
    ).toBeVisible();

    const bulletMenu = page.getByRole("button", {
      name: copy.library.bullets.actionsLabel("Shipped a checkout flow used by 12 teams."),
    });
    await bulletMenu.focus();
    await expect(bulletMenu).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menuitem", { name: copy.library.bullets.moveUp })).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: copy.library.bullets.delete }),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/library", { waitUntil: "commit", timeout: 60_000 });
    await expectLibraryShell(page);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await expect(page.getByLabel(copy.library.health.stripLabel)).toBeVisible();
    await expect(page.getByText(copy.library.health.title)).toBeVisible();
    await expect(page.getByText(copy.library.health.strengthTitle)).toBeVisible();
  });
});

async function expectLibraryShell(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: copy.pages.library.title })).toBeVisible();
  await expect(page.getByRole("link", { name: copy.library.importResume })).toBeVisible();
  await expect(page.getByRole("heading", { name: copy.errors.notFound.title })).toHaveCount(0);
}

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const root = document.documentElement;
    return Math.max(0, root.scrollWidth - root.clientWidth);
  });
}
