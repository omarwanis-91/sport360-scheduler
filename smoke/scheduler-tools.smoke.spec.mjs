import { expect, test } from "@playwright/test";
import { seedState } from "../src/data.js";

const stateKey = "sport360-scheduler-state";
const annualDate = "2026-11-11";
const workedDate = "2026-11-10";
const eventDate = "2026-11-12";
const annualRequestId = "a0c24c7e-bf25-4a60-93f9-b3147fb29a11";

test.use({ reducedMotion: "reduce" });

test.beforeEach(async ({ page }) => {
  await page.route("**/runtime-config.js", (route) => route.fulfill({
    contentType: "text/javascript", body: "window.__SPORT360_CONFIG__={demoMode:true};"
  }));
  await page.clock.setFixedTime(new Date("2026-11-11T12:00:00Z"));
  const state = structuredClone(seedState);
  state.scheduleOverrides = [
    { id: "annual", profileId: "emp-001", date: annualDate, statusId: "vacation", note: `Vacation request ${annualRequestId}` },
    { id: "worked", profileId: "emp-001", date: workedDate, statusId: "weekend", note: "Scheduled day off" },
    { id: "saturday", profileId: "emp-001", date: "2026-11-14", statusId: "morning" }
  ];
  state.vacationRequests = [
    { id: annualRequestId, profileId: "emp-001", startDate: annualDate, endDate: annualDate, status: "approved",
      reason: "Own request", deductedDays: 1, deductedDaysByYear: { 2026: 1 } },
    { id: "other-annual", profileId: "emp-002", startDate: annualDate, endDate: eventDate, status: "pending", reason: "Another person's request" }
  ];
  state.auditLog = state.vacationRequests.map((request) => ({
    id: `log-${request.id}`, entityId: request.id, entityType: "vacation_request", action: "vacation.requested",
    actorId: "user-admin", createdAt: "2026-11-11T11:00:00Z", detail: `${request.startDate} · ${request.reason}`
  }));
  const lead = state.profiles.find((profile) => profile.id === "emp-002");
  lead.seniorityLevel = "manager";
  state.profiles.find((profile) => profile.id === "emp-003").userId = "user-ops-employee";
  state.users.push({ id: "user-ops-employee", role: "employee", profileId: "emp-003", email: "karim@company.test" });
  await page.addInitScript(({ key, state }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state));
  }, { key: stateKey, state });
  await page.goto("/");
});

function button(page, name) {
  return page.getByRole("button", { name, exact: true });
}

test("shift details fit the drawer and show only the selected person's Annual activity", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 850 });
  const cell = page.locator(`.schedule-grid .shift-cell[data-profile-id="emp-001"][data-date="${annualDate}"]`);
  await expect(cell).toHaveCSS("--status-accent", "#7edc98");
  await cell.click();
  const drawer = page.locator(".drawer");
  await expect(drawer).toContainText("Own request");
  await expect(drawer).not.toContainText("Another person's request");
  await expect(page.locator('#shift-form textarea[name="note"]')).toHaveValue("Annual request");
  await expect(drawer).toHaveCSS("overflow-x", "hidden");
  await expect.poll(() => drawer.evaluate((node) => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await button(page, "Override day off").click();
  await page.getByLabel("Shift worked").selectOption("ground");
  await button(page, "Save Worked Day").click();
  await expect(cell).toHaveClass(/ground/);
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), stateKey);
  expect(saved.lowDayCredits.filter((credit) => credit.workedDate === annualDate)).toHaveLength(1);
  expect(saved.profiles.find((profile) => profile.id === "emp-001").remainingVacationDays).toBe(23);
  expect(saved.vacationRequests.find((request) => request.id === annualRequestId).deductedDays).toBe(0);
});

test("My Profile puts the bright working calendar on the right and Scheduler opens the worked day directly", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 950 });
  await button(page, "My Profile").click();
  await expect(page.locator(".my-profile-side")).toBeVisible();
  await expect.poll(() => page.locator(".my-profile-layout").evaluate((layout) => {
    const sidebar = layout.querySelector(".my-profile-side").getBoundingClientRect();
    const calendar = layout.querySelector(".person-calendar.page").getBoundingClientRect();
    return calendar.left - sidebar.right;
  })).toBeGreaterThan(0);
  const workingSaturday = page.locator('.month-day[data-date="2026-11-14"]');
  await expect(workingSaturday).toHaveClass(/working/);
  await expect(workingSaturday).toHaveCSS("opacity", "1");
  const heading = page.locator(".my-shifts > .eyebrow");
  await expect(heading).toHaveCSS("padding-left", "12px");
  await expect(heading).toHaveCSS("padding-top", "10px");
  await button(page, "Scheduler").click();
  await page.getByLabel("Schedule start date", { exact: true }).fill(workedDate);
  await page.locator(`.schedule-grid .shift-cell[data-profile-id="emp-001"][data-date="${workedDate}"]`).click();
  await button(page, "Override day off").click();
  await expect(page.locator(".drawer")).toContainText("2026-12-10");
  await expect(button(page, "Save Worked Day")).toBeVisible();
});

test("team events appear on Scheduler and Annual approval, with no rotation or shift changes", async ({ page }) => {
  const savedShifts = () => page.evaluate((key) => {
    const { scheduleOverrides, rotationVersions } = JSON.parse(localStorage.getItem(key));
    return { scheduleOverrides, rotationVersions };
  }, stateKey);
  const before = await savedShifts();
  await button(page, "Events").click();
  await button(page, "New Event").click();
  await page.getByLabel("Event name").fill("Live championship");
  await page.getByLabel("Starts", { exact: true }).fill(eventDate);
  await page.getByLabel("Ends", { exact: true }).fill("2026-11-13");
  await button(page, "Save Event").click();
  await page.locator("#close-drawer").click();
  const header = page.locator(`.date-head[data-date="${eventDate}"]`);
  const eventCell = page.locator(`.schedule-events-cell[data-date="${eventDate}"]`);
  await expect(eventCell).toContainText("Live championship");
  const eventBox = await eventCell.boundingBox();
  const dateBox = await header.boundingBox();
  const shiftBox = await page.locator(`.schedule-grid .shift-cell[data-date="${eventDate}"]`).first().boundingBox();
  expect(eventBox.y).toBeGreaterThan(dateBox.y + dateBox.height);
  expect(eventBox.y + eventBox.height).toBeLessThan(shiftBox.y);
  expect(eventBox.height).toBeLessThan(shiftBox.height);
  await page.locator("#department-select").selectOption("support");
  await expect(eventCell).toHaveCount(0);
  await page.locator("#department-select").selectOption("ops");
  await button(page, "Rotations").click();
  await expect(page.getByText("Live championship")).toHaveCount(0);
  await button(page, "Requests").click();
  await page.locator('[data-request-id="other-annual"]').click();
  await expect(page.getByRole("region", { name: "Scheduled events" })).toContainText("Live championship");
  await page.locator("#close-drawer").click();
  await button(page, "Scheduler").click();
  await button(page, "Events").click();
  await button(page, "Edit Live championship").click();
  await button(page, "Remove Event").click();
  await button(page, "Remove Event").click();
  await page.locator("#close-drawer").click();
  await expect(eventCell).toHaveCount(0);
  expect(await savedShifts()).toEqual(before);
});

test("a Manager with Lead access can preview only linked employees in their teams", async ({ page }) => {
  await page.locator("#user-switcher").selectOption("user-lead");
  await button(page, "Settings").click();
  await expect(page.getByRole("tab", { name: "Role Preview" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: "Schedule" })).toHaveCount(0);
  await expect(page.locator("#role-preview-role, #role-preview-department")).toHaveCount(0);
  const people = page.locator("#role-preview-profile");
  await expect(people.locator('option:not([value=""])')).toHaveText(["Karim Adel"]);
  await people.selectOption("emp-003");
  await button(page, "Start Preview").click();
  await expect(page.getByRole("region", { name: "Role Preview is active" })).toContainText("Previewing Employee · Operations");
  await expect(page.locator("#department-select option")).toHaveCount(1);
  await expect(button(page, "Edit daily leads")).toHaveCount(0);
  await expect(button(page, "Analytics")).toHaveCount(0);
  await expect(button(page, "Low Days")).toHaveCount(0);
  await page.locator(".role-preview-sidebar").getByRole("button", { name: "Exit Preview" }).click();
  await expect(button(page, "Settings")).toBeVisible();
  await expect(page.locator(".user-tile")).toContainText("Mona Saleh");
});
