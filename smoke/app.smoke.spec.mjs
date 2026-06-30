import { expect, test } from "@playwright/test";

function localIso(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

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
  await page.getByRole("textbox", { name: "Department name", exact: true }).fill("Motion Graphics");
  await page.getByRole("combobox", { name: "Parent department", exact: true }).selectOption("ops");
  await page.getByRole("button", { name: "Create Department", exact: true }).click();
  await expect(page.locator(".sub-department-card").filter({ hasText: "Motion Graphics" })).toContainText("Sub-department");
  await expect(page.locator(".sub-department-card").filter({ hasText: "Motion Graphics" })).toContainText("Operations");
  await page.getByRole("button", { name: "Details", exact: true }).click();
  await expect(page.locator(".department-detail-row").filter({ hasText: "Motion Graphics" })).toContainText("Operations /");

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
  await expect(page.locator(".detail-line").filter({ hasText: "Date" })).toContainText(/[A-Z][a-z]{2} Jun \d{1,2}/);
  await expect(page.locator("#shift-form")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open in Scheduler", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Open in Scheduler", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Operations", exact: true })).toBeVisible();
});

test("admins can assign seniority and weekly or daily department leads", async ({ page }) => {
  const today = localIso();
  const weekend = [0, 6].includes(new Date().getDay());
  const expectedLead = weekend ? "Karim" : "Mona";
  const expectedLeadProfileId = weekend ? "emp-003" : "emp-002";

  await page.goto("/");
  await page.getByRole("button", { name: "My Profile", exact: true }).click();
  await page.getByRole("button", { name: "Edit My Profile", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Seniority", exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Department role", exact: true })).toHaveCount(0);
  await page.getByRole("combobox", { name: "Seniority", exact: true }).selectOption("lead");
  await page.getByRole("button", { name: "Save Profile", exact: true }).click();
  await page.getByRole("button", { name: "Edit Profile", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Seniority", exact: true })).toHaveValue("lead");

  await page.locator("#close-drawer").click();
  await page.getByRole("button", { name: "Rotations", exact: true }).click();
  await expect(page.getByText("Department Lead Rotation", { exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Sat", exact: true })).toHaveValue("emp-003");

  await page.getByRole("button", { name: "Scheduler", exact: true }).click();
  await expect(page.locator(`.date-head[data-date="${today}"]`)).toContainText(`Lead: ${expectedLead}`);
  await expect(page.locator(".date-head.today")).toContainText("Today");
  await expect(page.locator(`.shift-cell[data-profile-id="${expectedLeadProfileId}"][data-date="${today}"] .lead-marker`)).toBeVisible();
  await page.locator(".date-head.today").click();
  await expect(page.getByRole("combobox", { name: "Daily lead override", exact: true })).toBeVisible();
});

test("scheduler zoom switches week, two-week, and month density", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator(".scheduler-month-bar")).toContainText(/June|July/);
  await expect(page.getByRole("button", { name: /New Profile/, exact: false })).toHaveCount(0);
  await expect(page.locator(".schedule-grid.range-two-weeks")).toBeVisible();
  await page.getByTitle("Zoom in").click();
  await expect(page.locator(".schedule-grid.range-week")).toBeVisible();
  await page.getByTitle("Zoom out").click();
  await page.getByTitle("Zoom out").click();
  await expect(page.locator(".schedule-grid.range-month")).toBeVisible();
  await expect(page.locator("#range-select")).toHaveValue("30");
  await page.locator("#schedule-start-date").fill("2026-07-15");
  await expect(page.locator('.date-head[data-date="2026-07-15"]')).toBeVisible();
  await page.getByRole("button", { name: "Month Start", exact: true }).click();
  await expect(page.locator('.date-head[data-date="2026-07-01"]')).toBeVisible();
  await page.getByTitle("Next range").click();
  await expect(page.locator(".scheduler-month-bar")).toContainText(/July|August/);
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
  await expect(page.getByText("Primary", { exact: true })).toHaveCount(0);

  await page.reload();
  await page.getByRole("button", { name: "My Profile", exact: true }).click();
  await page.getByRole("button", { name: "Edit My Profile", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Title", exact: true })).toHaveValue("Editorial Operations Director");
  await expect(page.getByRole("checkbox", { name: "Customer Support", exact: true })).toBeChecked();

  await page.locator("#close-drawer").click();
  await page.getByRole("button", { name: "Scheduler", exact: true }).click();
  await page.locator("#department-select").selectOption("support");
  await expect(page.getByRole("button", { name: "OW Omar Wanis Editorial Operations Director · 22 vac days", exact: true })).toBeVisible();
});

test("admins can delete pseudo profiles", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "People", exact: true }).click();

  await page.locator('[data-profile-id="emp-003"]').click();
  await expect(page.getByRole("button", { name: "Delete Profile", exact: true })).toBeVisible();

  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });
  await page.getByRole("button", { name: "Delete Profile", exact: true }).click();
  await expect(page.getByText("Karim Adel", { exact: true })).toHaveCount(0);
});

test("hierarchy view groups people from manager through junior", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "My Profile", exact: true }).click();
  await page.getByRole("button", { name: "Edit My Profile", exact: true }).click();
  await page.getByRole("checkbox", { name: "Customer Support", exact: true }).check();
  await page.getByRole("button", { name: "Save Profile", exact: true }).click();

  await page.getByRole("button", { name: "Hierarchy", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Hierarchy", exact: true })).toBeVisible();
  const operations = page.locator('[data-hierarchy-department="ops"]');
  const support = page.locator('[data-hierarchy-department="support"]');
  await expect(operations).toBeVisible();
  await expect(operations.getByText("Managers", { exact: true })).toBeVisible();
  await expect(operations.getByText("Department Leads", { exact: true })).toBeVisible();
  await expect(operations.getByText("Senior", { exact: true })).toBeVisible();
  await expect(operations.getByText("Mid-level", { exact: true })).toBeVisible();
  await expect(operations.getByText("Junior", { exact: true })).toBeVisible();
  await expect(operations.getByText("Omar Wanis", { exact: true })).toBeVisible();
  await expect(support).toBeVisible();
  await expect(support.getByText("Omar Wanis", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(page.getByText("No departments selected", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Operations", exact: true }).click();
  await page.getByRole("button", { name: "Customer Support", exact: true }).click();
  await expect(operations).toBeVisible();
  await expect(support).toBeVisible();
  await expect(page.locator('[data-hierarchy-department="field"]')).toHaveCount(0);
});
