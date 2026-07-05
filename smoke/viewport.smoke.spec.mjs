import { expect, test } from "@playwright/test";

const widths = [1024, 1280, 1440, 1920];
const height = 900;

async function expectShellWithinViewport(page) {
  const overflow = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const shell = document.querySelector("#app");
    const workspace = document.querySelector(".workspace");
    const rightEdge = Math.max(
      shell?.getBoundingClientRect().right || 0,
      workspace?.getBoundingClientRect().right || 0
    );
    return Math.max(0, rightEdge - viewportWidth);
  });
  expect(overflow).toBeLessThanOrEqual(1);
}

async function expectMainShellHealthy(page) {
  await expect(page.getByText("Sport360", { exact: true }).first()).toBeVisible();
  await expect(page.locator(".sidebar")).toBeVisible();
  await expect(page.locator(".workspace")).toBeVisible();
  await expectShellWithinViewport(page);
}

for (const width of widths) {
  test(`desktop layout remains usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/");

    await expectMainShellHealthy(page);
    await expect(page.getByRole("heading", { name: "Operations", exact: true })).toBeVisible();
    await expect(page.locator(".scheduler-month-bar")).toBeVisible();
    await expect(page.locator("#department-select")).toBeVisible();
    await expect(page.locator("#schedule-status-filter")).toBeVisible();
    await expect(page.locator(".schedule-grid")).toBeVisible();

    await page.getByRole("button", { name: "My Profile", exact: true }).click();
    await expectMainShellHealthy(page);
    await expect(page.getByRole("heading", { name: "My Profile", exact: true })).toBeVisible();
    await expect(page.locator(".person-calendar.page")).toBeVisible();

    await page.getByRole("button", { name: "People", exact: true }).click();
    await expectMainShellHealthy(page);
    await expect(page.getByRole("heading", { name: "People", exact: true })).toBeVisible();
    await expect(page.locator("[data-people-view]")).toHaveCount(4);
    await expect(page.getByRole("button", { name: "Default", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Tiles", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Departments", exact: true }).click();
    await expectMainShellHealthy(page);
    await expect(page.getByRole("heading", { name: "Departments", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Tiles", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Details", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Rotations", exact: true }).click();
    await expectMainShellHealthy(page);
    await expect(page.getByRole("heading", { name: "Rotations", exact: true })).toBeVisible();
    await expect(page.locator(".lead-rotation-panel")).toBeVisible();

    await page.getByRole("button", { name: "Requests", exact: true }).click();
    await expectMainShellHealthy(page);
    await expect(page.getByRole("heading", { name: "Vacation Requests", exact: true })).toBeVisible();
  });
}
