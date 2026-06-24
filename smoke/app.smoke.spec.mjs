import { expect, test } from "@playwright/test";

test("demo workspace loads and primary navigation works", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Sport360", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Operations" })).toBeVisible();

  const destinations = [
    ["People", "People"],
    ["Departments", "Departments"],
    ["Rotations", "Rotations"],
    ["My Profile", "My Profile"]
  ];

  for (const [navigationLabel, heading] of destinations) {
    await page.getByRole("button", { name: navigationLabel, exact: true }).click();
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }
});

test("creation opens centered while editing stays in the right sidebar", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Departments", exact: true }).click();

  await page.getByRole("button", { name: "New Department", exact: true }).click();
  await expect(page.locator(".drawer.creation-modal")).toBeVisible();
  await expect(page.getByRole("heading", { name: "New Department", exact: true })).toBeVisible();

  await page.locator("#close-drawer").click();
  await page.locator('[data-open-drawer="department-detail"]').first().click();
  await expect(page.locator(".drawer.edit-sidebar")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Department", exact: true })).toBeVisible();
});
