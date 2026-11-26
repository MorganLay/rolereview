import { expect, test } from "@playwright/test";

import { strings } from "@/copy/strings";

/**
 * Public routes only. CI runs this file against a production server with
 * placeholder secrets. Signed-in specs stay out of CI.
 */
const publicPages = [
  { path: "/", heading: strings.marketing.home.title },
  { path: "/pricing", heading: strings.marketing.pricing.title },
  { path: "/demo", heading: strings.marketing.demo.title },
  { path: "/about", heading: strings.marketing.about.title },
  { path: "/privacy", heading: strings.marketing.privacy.title },
  { path: "/terms", heading: strings.marketing.terms.title },
  { path: "/sign-in", heading: strings.signIn.title },
] as const;

for (const pageCase of publicPages) {
  test(`${pageCase.path} renders`, async ({ page }) => {
    const response = await page.goto(pageCase.path);
    expect(response?.ok()).toBe(true);
    await expect(
      page.getByRole("heading", { name: pageCase.heading, exact: true }),
    ).toBeVisible();
  });
}

test("unknown route is a branded 404", async ({ page }) => {
  const response = await page.goto("/this-page-does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: strings.errors.notFound.title, exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: strings.errors.notFound.home })).toBeVisible();
});

test("a signed-out app route opens sign-in", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fdashboard/);
  await expect(
    page.getByRole("heading", { name: strings.signIn.title, exact: true }),
  ).toBeVisible();
});
