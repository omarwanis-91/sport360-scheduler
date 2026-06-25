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
  await expect(page.locator(".person-summary-copy > span")).toHaveText("Workforce Admin");
  await expect(page.locator(".detail-line").filter({ hasText: "Date" }).getByText("Thu Jun 25", { exact: true })).toBeVisible();
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

test("profile title and multiple department memberships persist in the UI", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "My Profile", exact: true }).click();
  await page.getByRole("button", { name: "Edit My Profile", exact: true }).click();

  await page.getByRole("textbox", { name: "Title", exact: true }).fill("Editorial Operations Director");
  await page.getByRole("checkbox", { name: "Customer Support", exact: true }).check();
  await page.getByRole("button", { name: "Save Profile", exact: true }).click();

  await expect(page.getByText("SCH-001 · Editorial Operations Director", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit Profile", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Title", exact: true })).toHaveValue("Editorial Operations Director");
  await expect(page.getByRole("checkbox", { name: "Customer Support", exact: true })).toBeChecked();

  await page.locator("#close-drawer").click();
  await page.getByRole("button", { name: "Scheduler", exact: true }).click();
  await page.locator("#department-select").selectOption("support");
  await expect(page.getByRole("button", { name: "OW Omar Wanis Editorial Operations Director · 22 vac days", exact: true })).toBeVisible();
});

test("hierarchy view groups people from manager through junior", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Hierarchy", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Hierarchy", exact: true })).toBeVisible();
  await expect(page.getByText("Managers", { exact: true })).toBeVisible();
  await expect(page.getByText("Department Leads", { exact: true })).toBeVisible();
  await expect(page.getByText("Senior", { exact: true })).toBeVisible();
  await expect(page.getByText("Mid-level", { exact: true })).toBeVisible();
  await expect(page.getByText("Junior", { exact: true })).toBeVisible();
});
