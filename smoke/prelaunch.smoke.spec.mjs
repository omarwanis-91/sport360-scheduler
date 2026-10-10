import { expect, test } from "@playwright/test";

const supabaseUrl = "https://prelaunch-sport360-test.supabase.co";
const session = {
  access_token: "prelaunch-access",
  refresh_token: "prelaunch-refresh",
  expires_in: 3600,
  user: { id: "user-prelaunch", email: "artist@sport360.com" }
};
const reservation = [{
  profile_id: "profile-artist",
  full_name: "Sport360 Artist",
  email: "artist@sport360.com",
  title: "Motion Graphics Artist",
  reserved_at: "2026-10-10T10:00:00Z"
}];

async function configurePrelaunch(page) {
  await page.route("**/runtime-config.js", (route) => route.fulfill({
    contentType: "text/javascript",
    body: `window.__SPORT360_CONFIG__ = ${JSON.stringify({
      supabaseUrl,
      supabaseAnonKey: "smoke-test-anon-key",
      allowSignup: true,
      prelaunchMode: true,
      release: "smoke-prelaunch",
      demoMode: false
    })};`
  }));
}

async function mockSuccessfulReservation(page) {
  await page.route(`${supabaseUrl}/auth/v1/signup`, (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(session)
  }));
  await page.route(`${supabaseUrl}/rest/v1/rpc/current_role`, (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: "null"
  }));
  await page.route(`${supabaseUrl}/rest/v1/rpc/reserve_profile_for_current_user`, (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(reservation)
  }));
}

test("employees can reserve matching profiles without loading scheduler data", async ({ page }) => {
  await configurePrelaunch(page);
  await mockSuccessfulReservation(page);
  const requests = [];
  page.on("request", (request) => requests.push(request.url()));

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Claim your Sport360 profile", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create Account", exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("artist@sport360.com");
  await page.getByLabel("Password", { exact: true }).fill("safe-password-123");
  await page.getByRole("button", { name: "Create Account", exact: true }).click();

  await expect(page.getByText("Profile reserved", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your profile is ready for launch", exact: true })).toBeVisible();
  await expect(page.getByText("Sport360 Artist", { exact: true })).toBeVisible();
  await expect(page.getByText("artist@sport360.com", { exact: true })).toBeVisible();
  await expect(page.locator(".sidebar, .workspace")).toHaveCount(0);

  const operationalTables = [
    "departments",
    "employee_profiles",
    "shift_statuses",
    "rotation_versions",
    "schedule_overrides",
    "department_daily_leads",
    "vacation_requests"
  ];
  for (const table of operationalTables) {
    expect(requests.some((url) => url.includes(`/rest/v1/${table}?`))).toBe(false);
  }
});

test("an unmatched work email stays outside the scheduler with recovery guidance", async ({ page }) => {
  await configurePrelaunch(page);
  await page.route(`${supabaseUrl}/auth/v1/token?grant_type=password`, (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ...session, user: { id: "user-unmatched", email: "unknown@sport360.com" } })
  }));
  await page.route(`${supabaseUrl}/rest/v1/rpc/current_role`, (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: "null"
  }));
  await page.route(`${supabaseUrl}/rest/v1/rpc/reserve_profile_for_current_user`, (route) => route.fulfill({
    status: 400,
    contentType: "application/json",
    body: JSON.stringify({ message: "No employee profile matches this work email" })
  }));

  await page.goto("/");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("unknown@sport360.com");
  await page.getByLabel("Password", { exact: true }).fill("safe-password-123");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();

  await expect(page.getByRole("heading", { name: "We could not reserve your profile", exact: true })).toBeVisible();
  await expect(page.locator(".form-error")).toContainText("No employee profile matches this work email");
  await expect(page.getByRole("button", { name: "Use Another Account", exact: true })).toBeVisible();
  await expect(page.locator(".sidebar, .workspace")).toHaveCount(0);
});

test("signup confirmation keeps the employee on the claim page", async ({ page }) => {
  await configurePrelaunch(page);
  await page.route(`${supabaseUrl}/auth/v1/signup`, (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ user: { id: "confirmation-user", email: "artist@sport360.com" } })
  }));

  await page.goto("/");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("artist@sport360.com");
  await page.getByLabel("Password", { exact: true }).fill("safe-password-123");
  await page.getByRole("button", { name: "Create Account", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Claim your Sport360 profile", exact: true })).toBeVisible();
  await expect(page.locator(".form-notice")).toContainText("Check your email");
  await expect(page.locator(".sidebar, .workspace")).toHaveCount(0);
});

test("existing admins bypass the prelaunch holding page", async ({ page }) => {
  await configurePrelaunch(page);
  let reservationCalls = 0;
  await page.addInitScript((storedSession) => {
    localStorage.setItem("sport360-supabase-session", JSON.stringify({
      ...storedSession,
      expires_at: Date.now() + 3_600_000
    }));
  }, { ...session, user: { id: "admin-user", email: "admin@sport360.com" } });
  await page.route(`${supabaseUrl}/rest/v1/**`, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/rpc/current_role")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify("admin") });
    }
    if (url.pathname.endsWith("/rpc/reserve_profile_for_current_user")) {
      reservationCalls += 1;
      return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Admin must not reserve" }) });
    }
    if (url.pathname.endsWith("/rpc/claim_profile_for_current_user")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify("admin-profile") });
    }
    if (url.pathname.endsWith("/user_roles")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ user_id: "admin-user", role: "admin", created_at: "2026-10-10T10:00:00Z" }])
      });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.goto("/");

  await expect(page.locator(".sidebar")).toBeVisible();
  await expect(page.locator(".workspace")).toBeVisible();
  await expect(page.getByText("Profile reserved", { exact: true })).toHaveCount(0);
  expect(reservationCalls).toBe(0);
});

for (const width of [375, 768, 1024, 1280, 1440, 1920]) {
  test(`prelaunch profile confirmation fits ${width}px`, async ({ page }) => {
    await configurePrelaunch(page);
    await mockSuccessfulReservation(page);
    await page.addInitScript((storedSession) => {
      localStorage.setItem("sport360-supabase-session", JSON.stringify({
        ...storedSession,
        expires_at: Date.now() + 3_600_000
      }));
    }, session);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Your profile is ready for launch", exact: true })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}
