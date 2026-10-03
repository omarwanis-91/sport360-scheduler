import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/runtime-config.js", (route) => route.fulfill({
    contentType: "text/javascript",
    body: `window.__SPORT360_CONFIG__ = ${JSON.stringify({
      supabaseUrl: "",
      supabaseAnonKey: "",
      allowSignup: false,
      release: "smoke-demo",
      demoMode: true
    })};`
  }));
});

function localIso(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function currentMonthLabel(date = new Date()) {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

test("authentication connection failures are accurate and shown once", async ({ page }) => {
  await page.route("**/runtime-config.js", (route) => route.fulfill({
    contentType: "text/javascript",
    body: `window.__SPORT360_CONFIG__ = ${JSON.stringify({
      supabaseUrl: "https://unreachable-sport360-test.supabase.co",
      supabaseAnonKey: "smoke-test-anon-key",
      allowSignup: false,
      release: "smoke-auth-error",
      demoMode: false
    })};`
  }));
  await page.route("https://unreachable-sport360-test.supabase.co/**", (route) => route.abort("failed"));
  await page.goto("/");

  await page.getByRole("textbox", { name: "Email", exact: true }).fill("test@example.com");
  const passwordInput = page.getByLabel("Password", { exact: true });
  await expect(passwordInput).toHaveAttribute("type", "password");
  await page.getByLabel("Show password", { exact: true }).check();
  await expect(passwordInput).toHaveAttribute("type", "text");
  await page.getByLabel("Show password", { exact: true }).uncheck();
  await expect(passwordInput).toHaveAttribute("type", "password");
  await passwordInput.fill("not-a-real-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();

  await expect(page.locator(".form-error")).toHaveCount(1);
  await expect(page.locator(".form-error")).toContainText("Supabase did not respond to this request. Try again.");
  await expect(page.locator(".form-notice")).toHaveCount(0);
});

test("password recovery requests use the current app URL without revealing account status", async ({ page }) => {
  const supabaseUrl = "https://recovery-sport360-test.supabase.co";
  let recoveryRequest;
  await page.route("**/runtime-config.js", (route) => route.fulfill({
    contentType: "text/javascript",
    body: `window.__SPORT360_CONFIG__ = ${JSON.stringify({
      supabaseUrl,
      supabaseAnonKey: "smoke-test-anon-key",
      allowSignup: false,
      release: "smoke-password-recovery",
      demoMode: false
    })};`
  }));
  await page.route(`${supabaseUrl}/auth/v1/recover**`, async (route) => {
    recoveryRequest = route.request();
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await page.goto("/?source=smoke");

  await page.getByRole("button", { name: "Forgot password?", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Reset your password", exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Password", exact: true })).toHaveCount(0);
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("person@example.com");
  await page.getByRole("button", { name: "Send Recovery Link", exact: true }).click();

  await expect(page.locator(".form-notice")).toContainText("If an account exists for that email");
  expect(recoveryRequest).toBeTruthy();
  expect(recoveryRequest.postDataJSON()).toEqual({ email: "person@example.com" });
  const requestedUrl = new URL(recoveryRequest.url());
  expect(requestedUrl.searchParams.get("redirect_to")).toBe("http://127.0.0.1:4174/");
});

test("password recovery links require matching passwords and clear the temporary session", async ({ page }) => {
  const supabaseUrl = "https://recovery-sport360-test.supabase.co";
  let passwordUpdateRequest;
  await page.route("**/runtime-config.js", (route) => route.fulfill({
    contentType: "text/javascript",
    body: `window.__SPORT360_CONFIG__ = ${JSON.stringify({
      supabaseUrl,
      supabaseAnonKey: "smoke-test-anon-key",
      allowSignup: false,
      release: "smoke-password-update",
      demoMode: false
    })};`
  }));
  await page.route(`${supabaseUrl}/auth/v1/user`, async (route) => {
    passwordUpdateRequest = route.request();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "recovery-user" })
    });
  });
  await page.goto("/#access_token=recovery-access&refresh_token=recovery-refresh&expires_in=3600&token_type=bearer&type=recovery");

  await expect(page).toHaveURL("http://127.0.0.1:4174/");
  await expect(page.getByRole("heading", { name: "Choose a new password", exact: true })).toBeVisible();
  await page.getByLabel("Show passwords", { exact: true }).check();
  await expect(page.getByLabel("New password", { exact: true })).toHaveAttribute("type", "text");
  await expect(page.getByLabel("Confirm new password", { exact: true })).toHaveAttribute("type", "text");
  await page.getByLabel("Show passwords", { exact: true }).uncheck();
  await page.getByLabel("New password", { exact: true }).fill("New-password-123");
  await page.getByLabel("Confirm new password", { exact: true }).fill("Different-password-456");
  await page.getByRole("button", { name: "Update Password", exact: true }).click();
  await expect(page.locator(".form-error")).toContainText("The passwords do not match.");
  expect(passwordUpdateRequest).toBeUndefined();

  await page.getByLabel("New password", { exact: true }).fill("New-password-123");
  await page.getByLabel("Confirm new password", { exact: true }).fill("New-password-123");
  await page.getByRole("button", { name: "Update Password", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sign in to your schedule", exact: true })).toBeVisible();
  await expect(page.locator(".form-notice")).toContainText("Password updated. Sign in with your new password.");
  expect(passwordUpdateRequest.postDataJSON()).toEqual({ password: "New-password-123" });
  expect(passwordUpdateRequest.headers().authorization).toBe("Bearer recovery-access");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("sport360-supabase-session"))).toBeNull();
});

test("expired password recovery links are removed from the URL and can be requested again", async ({ page }) => {
  const supabaseUrl = "https://recovery-sport360-test.supabase.co";
  await page.route("**/runtime-config.js", (route) => route.fulfill({
    contentType: "text/javascript",
    body: `window.__SPORT360_CONFIG__ = ${JSON.stringify({
      supabaseUrl,
      supabaseAnonKey: "smoke-test-anon-key",
      allowSignup: false,
      release: "smoke-expired-password-recovery",
      demoMode: false
    })};`
  }));

  await page.goto("/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired&type=recovery");

  await expect(page).toHaveURL("http://127.0.0.1:4174/");
  await expect(page.getByRole("heading", { name: "Reset your password", exact: true })).toBeVisible();
  await expect(page.locator(".form-error")).toContainText("invalid or has expired");
  await expect(page.getByRole("button", { name: "Send Recovery Link", exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("sport360-supabase-session"))).toBeNull();
});

test("demo workspace loads and primary navigation works", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Sport360", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Operations" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Scheduler", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("button", { name: "All people", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Leads", exact: true })).toHaveAttribute("aria-pressed", "false");

  const destinations = [
    ["People", "People"],
    ["Departments", "Departments"],
    ["Rotations", "Rotations"],
    ["My Profile", "My Profile"]
  ];

  for (const [navigationLabel, heading] of destinations) {
    await page.getByRole("button", { name: navigationLabel, exact: true }).click();
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: navigationLabel, exact: true })).toHaveAttribute("aria-current", "page");
  }
});

test("compact controls expose names, selected state, and reduced-motion behavior", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  await expect(page.getByRole("button", { name: "Previous range", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Next range", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Zoom in", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Zoom out", exact: true })).toBeVisible();

  const ambientAnimationNames = await page.evaluate(() => ({
    bodyBefore: getComputedStyle(document.body, "::before").animationName,
    bodyAfter: getComputedStyle(document.body, "::after").animationName,
    workspaceBefore: getComputedStyle(document.querySelector(".workspace"), "::before").animationName
  }));
  expect(ambientAnimationNames).toEqual({ bodyBefore: "none", bodyAfter: "none", workspaceBefore: "none" });

  await page.getByRole("button", { name: "People", exact: true }).click();
  await expect(page.getByRole("button", { name: "Default", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Kanban", exact: true })).toHaveAttribute("aria-pressed", "false");

  await page.getByRole("button", { name: "My Profile", exact: true }).click();
  await page.getByRole("button", { name: "Edit My Profile", exact: true }).click();
  await expect(page.locator("#close-drawer")).toHaveAccessibleName(/^Close /);
});

test("missing-lead alerts stay in date headers while coverage keeps coverage details", async ({ page }) => {
  await page.goto("/");

  const missingLeadHeader = page.locator(".date-head.lead-missing").first();
  await expect(missingLeadHeader).toBeVisible();
  await expect(missingLeadHeader).toContainText("Lead missing");
  await expect(missingLeadHeader).toHaveAccessibleName(/Lead missing/);

  const date = await missingLeadHeader.getAttribute("data-date");
  expect(date).toBeTruthy();
  const coverageCell = page.locator(`.coverage-cell[data-date="${date}"]`);
  await expect(coverageCell).not.toHaveClass(/lead-missing/);
  await expect(coverageCell.locator("small")).toHaveText(/^\d+ off - \d+ ground$/);
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
  const subDepartmentTab = page.locator(".department-focus-tab").filter({ hasText: "Motion Graphics" });
  await expect(subDepartmentTab).toContainText("Sub-dept");
  await expect(subDepartmentTab).toContainText("0 people");
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

  await page.locator("#close-drawer").click();
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
  await expect(page.locator(".detail-line").filter({ hasText: "Date" })).toContainText(/[A-Z][a-z]{2} [A-Z][a-z]{2} \d{1,2}/);
  await expect(page.locator("#shift-form")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open in Scheduler", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Open in Scheduler", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Operations", exact: true })).toBeVisible();
});

test("admins can assign hierarchy roles and weekly or daily department leads", async ({ page }) => {
  const today = localIso();
  const weekend = [0, 6].includes(new Date().getDay());
  const expectedLead = weekend ? "Karim" : "Mona";
  const expectedLeadProfileId = weekend ? "emp-003" : "emp-002";

  await page.goto("/");
  await page.getByRole("button", { name: "My Profile", exact: true }).click();
  await page.getByRole("button", { name: "Edit My Profile", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Hierarchy role", exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Department role", exact: true })).toHaveCount(0);
  await page.getByRole("combobox", { name: "Hierarchy role", exact: true }).selectOption("lead");
  await page.getByRole("button", { name: "Save Profile", exact: true }).click();
  await page.getByRole("button", { name: "Edit Profile", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Hierarchy role", exact: true })).toHaveValue("lead");

  await page.locator("#close-drawer").click();
  await page.getByRole("button", { name: "Rotations", exact: true }).click();
  await expect(page.getByText("Department Lead Rotation", { exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Sat", exact: true })).toHaveValue("emp-003");

  await page.getByRole("button", { name: "Scheduler", exact: true }).click();
  if (weekend) {
    await expect(page.locator(`.date-head[data-date="${today}"]`)).toContainText("Lead missing");
    await expect(page.locator(`.shift-cell[data-profile-id="${expectedLeadProfileId}"][data-date="${today}"] .lead-marker`)).toHaveCount(0);
  } else {
    await expect(page.locator(`.date-head[data-date="${today}"]`)).toContainText(`Lead: ${expectedLead}`);
    await expect(page.locator(`.shift-cell[data-profile-id="${expectedLeadProfileId}"][data-date="${today}"] .lead-marker`)).toBeVisible();
  }
  await expect(page.locator(".date-head.today")).toContainText("Today");
  if (weekend) {
    await page.getByRole("button", { name: "Edit Schedule", exact: true }).click();
  }
  await page.locator(".date-head.today").click();
  if (weekend) {
    await expect(page.getByRole("combobox", { name: "Daily lead override", exact: true })).toBeVisible();
  } else {
    await expect(page.getByRole("heading", { name: "Coverage", exact: true })).toBeVisible();
  }
});

test("scheduler zoom switches week, two-week, and month density", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator(".scheduler-month-bar")).toContainText(currentMonthLabel());
  await page.locator("#schedule-status-filter").selectOption("night");
  await expect(page.locator("#schedule-status-filter")).toHaveValue("night");
  await expect(page.locator(".shift-cell.night").first()).toBeVisible();
  await expect(page.locator(".shift-cell.filtered-out").first()).toBeVisible();
  await page.locator("#schedule-status-filter").selectOption("all");
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
  await expect(page.locator(".scheduler-month-bar")).toContainText(/2026/);
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
  await expect(page.getByRole("button", { name: "OW Omar Wanis Editorial Operations Director - 22 annual days", exact: true })).toBeVisible();
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

test("hierarchy view groups people as managers, leads, and artists", async ({ page }) => {
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
  await expect(operations.getByText("Manager", { exact: true })).toBeVisible();
  await expect(operations.getByText("Lead", { exact: true })).toBeVisible();
  await expect(operations.getByText("Artist", { exact: true })).toBeVisible();
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
