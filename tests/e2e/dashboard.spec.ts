import { expect, test } from "@playwright/test";

test("reviewer can use dashboard filters and analyst answers", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Logistics AI Analytics" })).toBeVisible();
  await expect(page.locator(".hero .eyebrow")).toHaveCount(0);
  await expect(page.locator(".metric-card").filter({ hasText: "Total Orders" }).first()).toBeVisible();
  await expect(page.getByText("Order volume over time")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Dashboard explainability" })).toBeVisible();

  await page.getByLabel("Region").selectOption({ index: 1 });
  await expect(page.getByText(/rows in view/)).toBeVisible();

  await page.getByLabel("Ask a logistics analytics question").fill("How many orders were delivered late last month?");
  await page.getByRole("button", { name: "Ask" }).click();
  await expect(page.locator(".answer").filter({ hasText: /orders were delivered late/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Query Plan", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Predict demand for SKU CRAYON-0017 for the next 4 months" }).click();
  await expect(page.getByText(/Forecasted SKU/)).toBeVisible();
  await expect(page.getByText(/Plan around/)).toBeVisible();
});
