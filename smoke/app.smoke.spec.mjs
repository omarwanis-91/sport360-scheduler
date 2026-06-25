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

test("profile calendar keeps the open day visibly selected", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "My Profile", exact: true }).click();

  await expect(page.locator(".person-calendar.page .month-day.today .today-label")).toHaveText("Today");

  const calendarDays = page.locator('.person-calendar.page [data-open-drawer="calendar-day"]');
  await expect(calendarDays.first()).toBeVisible();
  await calendarDays.first().click();
  await expect(calendarDays.first()).toHaveAttribute("aria-pressed", "true");

  await calendarDays.nth(1).click();
  await expect(calendarDays.first()).toHaveAttribute("aria-pressed", "false");
  await expect(calendarDays.nth(1)).toHaveAttribute("aria-pressed", "true");
});

test("personal profile shift details stay read-only and route edits to Scheduler", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "My Profile", exact: true }).click();

  const upcomingShift = page.locator('.my-shifts [data-open-drawer="calendar-day"]').first();
  await upcomingShift.click();

  await expect(page.getByRole("heading", { name: "Day Details", exact: true })).toBeVisible();
  await expect(page.locator(".person-summary-copy > span")).toHaveText("Thu Jun 25");
  await expect(page.locator(".person-summary-copy > small")).toHaveText("Operations");
  await expect(page.locator("#shift-form")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open in Scheduler", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Open in Scheduler", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Operations", exact: true })).toBeVisible();
});

test("admins can assign seniority and weekly or daily department leads", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "My Profile", exact: true }).click();
  await page.getByRole("button", { name: "Edit My Profile", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Seniority", exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Department role", exact: true })).toHaveValue("lead");

  await page.locator("#close-drawer").click();
  await page.getByRole("button", { name: "Rotations", exact: true }).click();
  await expect(page.getByText("Department Lead Rotation", { exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Sat", exact: true })).toHaveValue("emp-003");

  await page.getByRole("button", { name: "Scheduler", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sat Jun 27 Lead: Karim", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Thu Jun 25 Lead: Mona", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Daily lead override", exact: true })).toBeVisible();
});
