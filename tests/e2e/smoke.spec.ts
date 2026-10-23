import { expect, test } from "@playwright/test";

test("homepage loads", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.ok()).toBe(true);
  await expect(
    page.getByRole("heading", { name: "Refine your resume for every role." }),
  ).toBeVisible();
});

test("unknown route is a branded 404", async ({ page }) => {
  const response = await page.goto("/this-page-does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "This page isn’t here." }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to home" })).toBeVisible();
});

