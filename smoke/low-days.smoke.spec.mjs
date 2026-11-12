import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/runtime-config.js", (route) => route.fulfill({
    contentType: "text/javascript", body: "window.__SPORT360_CONFIG__={demoMode:true};"
  }));
  await page.clock.setFixedTime(new Date("2026-11-11T12:00:00Z"));
  await page.goto("/");
  await page.evaluate(() => {
    const key = "sport360-scheduler-state";
    const state = JSON.parse(localStorage.getItem(key));
    state.scheduleOverrides = [
      { id: "day-off", profileId: "emp-001", date: "2026-10-18", statusId: "weekend", note: "Scheduled day off" },
      { id: "prior-shift", profileId: "emp-001", date: "2026-11-11", statusId: "midday", note: "Keep this shift" }
    ];
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.reload();
});

async function navigate(page, name) {
  await page.getByRole("button", { name, exact: true }).click();
}

async function startOn(page, date) {
  await page.getByLabel("Schedule start date", { exact: true }).fill(date);
}

function shift(page, date, person = "emp-001") {
  return page.locator(`.schedule-grid .shift-cell[data-profile-id="${person}"][data-date="${date}"]`);
}

test("a worked day earns one credit and a booking can be cancelled without losing the previous shift", async ({ page }) => {
  await startOn(page, "2026-10-18");
  await shift(page, "2026-10-18").click();
  await navigate(page, "Override day off");
  await expect(page.locator(".drawer")).toContainText("2026-11-17");
  await page.getByLabel("Shift worked").selectOption("morning");
  await navigate(page, "Save Worked Day");
  await expect(page.locator(".app-notice")).toContainText("Take the replacement by 2026-11-17");
  await expect(shift(page, "2026-10-18")).toHaveClass(/morning/);
  await shift(page, "2026-10-18").click();
  await expect(page.getByRole("button", { name: "View Low Days credit" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Override day off", exact: true })).toHaveCount(0);
  await page.locator("#close-drawer").click();

  await navigate(page, "Team");
  await page.getByRole("tab", { name: "Alerts 1", exact: true }).click();
  await expect(page.getByRole("tabpanel", { name: "Alerts 1" })).toContainText("Due soon");
  await page.locator("#team-department-select").selectOption("support");
  await expect(page.getByRole("tabpanel", { name: "Alerts" })).toContainText("No open or upcoming");
  await page.locator("#team-department-select").selectOption("ops");
  await page.getByRole("button", { name: /Manage replacement day for Omar/ }).click();
  const picker = page.getByLabel("Replacement date");
  await expect(picker.locator('option[value="2026-11-18"]')).toHaveCount(0);
  await picker.selectOption("2026-11-11");
  await expect(page.locator("#low-day-coverage")).toContainText("coverage:");
  await page.getByRole("button", { name: "Save Replacement Day" }).click();
  await expect(page.getByRole("tabpanel", { name: "Alerts" })).toContainText("Booked");

  await navigate(page, "My Profile");
  await expect(page.getByRole("region", { name: "Low Days" })).toContainText("Replacement on 2026-11-11");
  await navigate(page, "Scheduler");
  await page.locator("#department-select").selectOption("ops");
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await shift(page, "2026-11-11").click();
  await expect(page.getByRole("button", { name: "Save Daily Change" })).toBeDisabled();
  await page.getByRole("button", { name: "View Low Days credit" }).click();
  await page.getByRole("button", { name: "Cancel Booking" }).click();
  await expect(shift(page, "2026-11-11")).toHaveClass(/midday/);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("sport360-scheduler-state")));
  expect(saved.lowDayCredits).toHaveLength(1);
  expect(saved.lowDayCredits[0].replacementDate).toBeNull();
  expect(saved.scheduleOverrides.find((row) => row.id === "prior-shift").note).toBe("Keep this shift");
  expect(saved.profiles.find((profile) => profile.id === "emp-001").remainingVacationDays).toBe(22);
});

test("Admin can select a range, dates and individual shifts and see uneven holiday alerts by team", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 950 });
  await navigate(page, "Enter Public Holiday");
  await page.getByLabel("From", { exact: true }).fill("2026-11-12");
  await page.getByLabel("Through", { exact: true }).fill("2026-11-13");
  await navigate(page, "Select Range");
  await expect(page.getByRole("region", { name: "Public Holiday mode" })).toContainText("6 shifts selected");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  const secondDay = page.locator('.date-head[data-date="2026-11-13"]');
  await secondDay.click();
  await shift(page, "2026-11-13").click();
  await expect(shift(page, "2026-11-13")).toHaveAttribute("aria-pressed", "true");
  await navigate(page, "Review Holiday");
  await page.getByLabel("Holiday name").fill("Observed Holiday");
  await navigate(page, "Save Public Holiday");
  const header = page.locator('.date-head[data-date="2026-11-12"]');
  await expect(header).toContainText("Observed Holiday");
  await expect(shift(page, "2026-11-12")).toHaveClass(/public_holiday/);
  await expect(shift(page, "2026-11-13", "emp-002")).not.toHaveClass(/public_holiday/);
  await page.locator("#department-select").selectOption("support");
  await expect(header).not.toContainText("Observed Holiday");
  await page.locator("#department-select").selectOption("ops");
  await navigate(page, "Low Days");
  const holidayAlert = page.getByRole("region", { name: "Uneven public holidays" });
  await expect(holidayAlert).toContainText("Observed Holiday · Operations");
  await expect(holidayAlert).toContainText("Omar Wanis received 2 days");
  await expect(holidayAlert).toContainText(/received 1 day/);
  await page.locator("#team-department-select").selectOption("support");
  await expect(holidayAlert).toHaveCount(0);
  await navigate(page, "Scheduler");
  await navigate(page, "Enter Public Holiday");
  await navigate(page, "Saved Holidays");
  await navigate(page, "Edit Observed Holiday");
  await secondDay.press("Space");
  await navigate(page, "Review Holiday");
  await navigate(page, "Save Public Holiday");
  await expect(shift(page, "2026-11-13", "emp-002")).toHaveClass(/public_holiday/);
  await navigate(page, "Low Days");
  await expect(holidayAlert).toHaveCount(0);
});

test("employees see their own Low Days and cannot manage holiday selections", async ({ page }) => {
  await page.evaluate(() => {
    const key = "sport360-scheduler-state";
    const state = JSON.parse(localStorage.getItem(key));
    state.currentUserId = "user-employee";
    state.lowDayCredits = [
      { id: "mine", profileId: "emp-004", workedDate: "2026-10-01", dueDate: "2026-10-31", reason: "day_off" },
      { id: "other", profileId: "emp-001", workedDate: "2026-10-18", dueDate: "2026-11-17", reason: "day_off" }
    ];
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.reload();
  await expect(page.getByRole("button", { name: "Enter Public Holiday", exact: true })).toHaveCount(0);
  await navigate(page, "My Profile");
  const personal = page.getByRole("region", { name: "Low Days" });
  await expect(personal).toContainText("Overdue");
  await expect(personal).not.toContainText("2026-11-17");
  await navigate(page, "Team");
  await expect(page.getByRole("tab", { name: /Alerts/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Settings", exact: true })).toHaveCount(0);
});
