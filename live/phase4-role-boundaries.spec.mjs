import { expect, test } from "@playwright/test";

const roleEnvironment = {
  admin: ["SPORT360_ADMIN_EMAIL", "SPORT360_ADMIN_PASSWORD"],
  lead: ["SPORT360_LEAD_EMAIL", "SPORT360_LEAD_PASSWORD"],
  employee: ["SPORT360_EMPLOYEE_EMAIL", "SPORT360_EMPLOYEE_PASSWORD"],
  unmatched: ["SPORT360_UNMATCHED_EMAIL", "SPORT360_UNMATCHED_PASSWORD"]
};

function credentialsFor(role) {
  const [emailName, passwordName] = roleEnvironment[role];
  const email = process.env[emailName];
  const password = process.env[passwordName];
  const missing = [email ? "" : emailName, password ? "" : passwordName].filter(Boolean);
  if (missing.length) {
    throw new Error(`Missing live role verification environment: ${missing.join(", ")}`);
  }
  return { email, password };
}

async function signIn(page, role) {
  const { email, password } = credentialsFor(role);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in to your schedule", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create Account", exact: true })).toHaveCount(0);
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
}

async function expectClaimedRole(page, role) {
  await expect(page.locator(".sidebar")).toBeVisible();
  await expect(page.locator(".user-tile span")).toHaveText(role);
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
}

async function selectEachDepartment(page, assertion) {
  const select = page.locator("#department-select");
  const values = await select.locator("option").evaluateAll((options) => options.map((option) => option.value));
  expect(values.length).toBeGreaterThan(1);
  for (const value of values) {
    await select.selectOption(value);
    await assertion(value);
  }
}

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  const pageErrors = [];
  const consoleErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  test.info().pageErrors = pageErrors;
  test.info().consoleErrors = consoleErrors;
});

test.afterEach(async () => {
  expect(test.info().pageErrors, "production page errors").toEqual([]);
  if (!test.info().title.startsWith("Unmatched")) {
    expect(test.info().consoleErrors, "production browser console errors").toEqual([]);
  }
});

test("Admin can open every production workspace", async ({ page }) => {
  await signIn(page, "admin");
  await expectClaimedRole(page, "admin");

  for (const destination of [
    "My Profile",
    "Scheduler",
    "Requests",
    "People",
    "Hierarchy",
    "Departments",
    "Rotations",
    "Activity",
    "Settings"
  ]) {
    await page.getByRole("button", { name: destination, exact: true }).click();
    const heading = destination === "Requests" ? "Annual Requests" : destination;
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }

  await page.getByRole("button", { name: "People", exact: true }).click();
  await expect(page.getByRole("button", { name: "New Profile", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Departments", exact: true }).click();
  await expect(page.getByRole("button", { name: "New Department", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("button", { name: "New Status", exact: true })).toBeVisible();
});

test("Department Lead is limited to assigned department workflows", async ({ page }) => {
  await signIn(page, "lead");
  await expectClaimedRole(page, "lead");

  await page.getByRole("button", { name: "People", exact: true }).click();
  await expect(page.getByRole("button", { name: "New Profile", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Departments", exact: true }).click();
  await expect(page.getByRole("button", { name: "New Department", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("button", { name: "New Status", exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Scheduler", exact: true }).click();
  let editableDepartments = 0;
  let readOnlyDepartments = 0;
  await selectEachDepartment(page, async () => {
    const editSchedule = page.getByRole("button", { name: "Edit Schedule", exact: true });
    if (await editSchedule.count()) editableDepartments += 1;
    else readOnlyDepartments += 1;
  });
  expect(editableDepartments, "Lead needs at least one assigned department").toBeGreaterThan(0);
  expect(readOnlyDepartments, "Lead needs at least one cross-department boundary").toBeGreaterThan(0);

  await page.getByRole("button", { name: "Requests", exact: true }).click();
  await expect(page.getByRole("button", { name: "New Request", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "My Profile", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit My Profile", exact: true })).toBeVisible();
});

test("Employee has self-service access without management controls", async ({ page }) => {
  await signIn(page, "employee");
  await expectClaimedRole(page, "employee");

  await page.getByRole("button", { name: "My Profile", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit My Profile", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Requests", exact: true }).click();
  await expect(page.getByRole("button", { name: "New Request", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "People", exact: true }).click();
  await expect(page.getByRole("button", { name: "New Profile", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Departments", exact: true }).click();
  await expect(page.getByRole("button", { name: "New Department", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Rotations", exact: true }).click();
  await selectEachDepartment(page, async () => {
    await expect(page.getByRole("button", { name: "Edit Rotation", exact: true })).toHaveCount(0);
  });
  await page.getByRole("button", { name: "Scheduler", exact: true }).click();
  await selectEachDepartment(page, async () => {
    await expect(page.getByRole("button", { name: "Edit Schedule", exact: true })).toHaveCount(0);
  });
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("button", { name: "New Status", exact: true })).toHaveCount(0);
});

test("Unmatched account cannot load operational data", async ({ page }) => {
  await signIn(page, "unmatched");
  await expect(page.getByRole("heading", { name: "Live data could not load", exact: true })).toBeVisible();
  await expect(page.locator(".form-error")).toContainText(/matching employee profile|profile/i);
  await expect(page.locator(".sidebar")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Scheduler", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
});
