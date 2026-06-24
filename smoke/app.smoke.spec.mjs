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
