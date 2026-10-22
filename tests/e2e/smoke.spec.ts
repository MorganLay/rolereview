import { expect, test } from "@playwright/test";

test("homepage loads", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.ok()).toBe(true);
  await expect(
    page.getByRole("heading", { name: "Refine your resume for every role." }),
  ).toBeVisible();
});
