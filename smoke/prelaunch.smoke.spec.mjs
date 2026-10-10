import { expect, test } from "@playwright/test";

const supabaseUrl = "https://prelaunch-sport360-test.supabase.co";
const session = {
  access_token: "prelaunch-access",
  refresh_token: "prelaunch-refresh",
  expires_in: 3600,
  user: { id: "user-prelaunch", email: "artist@sport360.com" }
};
const pendingSubmission = [{
  user_id: "user-prelaunch",
  email: "artist@sport360.com",
  full_name: "Sport360 Artist",
  photo_url: null,
  status: "pending",
  linked_profile_id: null,
  created_at: "2026-10-10T10:00:00Z",
  updated_at: "2026-10-10T10:00:00Z"
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

async function storeSession(page, value = session) {
  await page.addInitScript((storedSession) => {
    localStorage.setItem("sport360-supabase-session", JSON.stringify({
      ...storedSession,
      expires_at: Date.now() + 3_600_000
    }));
  }, value);
}

async function mockEmployeeOnboarding(page, submission = null) {
  await page.route(`${supabaseUrl}/rest/v1/rpc/current_role`, (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify("employee")
  }));
  await page.route(`${supabaseUrl}/rest/v1/rpc/get_my_profile_onboarding`, (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(submission || [{
      user_id: "user-prelaunch",
      email: "artist@sport360.com",
      full_name: null,
      photo_url: null,
      status: null,
      linked_profile_id: null,
      created_at: null,
      updated_at: null
    }])
  }));
}

test("new accounts submit a basic profile without loading scheduler data", async ({ page }) => {
  await configurePrelaunch(page);
  await page.route(`${supabaseUrl}/auth/v1/signup`, (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(session)
  }));
  await mockEmployeeOnboarding(page);
  await page.route(`${supabaseUrl}/storage/v1/object/**`, (route) => {
    if (route.request().url().includes("/object/sign/")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ signedURL: "/storage/v1/object/sign/profile-onboarding-photos/test" }) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await page.route(`${supabaseUrl}/rest/v1/rpc/save_my_profile_onboarding`, async (route) => {
    const body = route.request().postDataJSON();
    expect(body.p_full_name).toBe("Sport360 Artist");
    expect(body.p_photo_url).toMatch(/^storage:profile-onboarding-photos\/user-prelaunch\//);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ ...pendingSubmission[0], photo_url: body.p_photo_url }]) });
  });
  const requests = [];
  page.on("request", (request) => requests.push(request.url()));

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Create your Sport360 account", exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("artist@sport360.com");
  await page.getByLabel("Password", { exact: true }).fill("safe-password-123");
  await page.getByRole("button", { name: "Create Account", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Tell us who you are", exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Sport360 Artist");
  await page.getByLabel("Choose profile photo").setInputFiles({
    name: "profile.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64")
  });
  await page.getByRole("button", { name: "Submit Profile", exact: true }).click();
  await expect(page.getByText("Waiting for Admin setup", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your details are saved", exact: true })).toBeVisible();
  await expect(page.locator(".sidebar, .workspace")).toHaveCount(0);

  for (const table of ["departments", "employee_profiles", "shift_statuses", "rotation_versions", "schedule_overrides", "vacation_requests"]) {
    expect(requests.some((url) => url.includes(`/rest/v1/${table}?`))).toBe(false);
  }
});

test("a pending profile stays editable and outside the scheduler", async ({ page }) => {
  await configurePrelaunch(page);
  await storeSession(page);
  await mockEmployeeOnboarding(page, pendingSubmission);
  await page.goto("/");

  await expect(page.getByText("Waiting for Admin setup", { exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Name", exact: true })).toHaveValue("Sport360 Artist");
  await expect(page.getByRole("textbox", { name: "Email", exact: true })).toHaveAttribute("readonly", "");
  await expect(page.locator(".sidebar, .workspace")).toHaveCount(0);
});

test("signup confirmation keeps the employee on account creation", async ({ page }) => {
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

  await expect(page.getByRole("heading", { name: "Create your Sport360 account", exact: true })).toBeVisible();
  await expect(page.locator(".form-notice")).toContainText("Check your email");
  await expect(page.locator(".sidebar, .workspace")).toHaveCount(0);
});

test("admins review pending profiles and can create an unassigned employee", async ({ page }) => {
  await configurePrelaunch(page);
  await storeSession(page, { ...session, user: { id: "admin-user", email: "admin@sport360.com" } });
  let approved = false;
  await page.route(`${supabaseUrl}/rest/v1/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/rpc/current_role")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify("admin") });
    if (url.pathname.endsWith("/rpc/claim_profile_for_current_user")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify("admin-profile") });
    if (url.pathname.endsWith("/rpc/list_profile_onboarding")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(approved ? [] : pendingSubmission) });
    if (url.pathname.endsWith("/rpc/approve_profile_onboarding")) {
      expect(route.request().postDataJSON()).toEqual({ p_user_id: "user-prelaunch", p_profile_id: null });
      approved = true;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{
        id: "new-profile", user_id: "user-prelaunch", department_id: null, employee_code: "ONB-USERPRELA",
        email: "artist@sport360.com", full_name: "Sport360 Artist", title: "Pending assignment", photo_url: null,
        yearly_vacation_days: 21, remaining_vacation_days: 21
      }]) });
    }
    if (url.pathname.endsWith("/user_roles")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ user_id: "admin-user", role: "admin", created_at: "2026-10-10T10:00:00Z" }]) });
    if (url.pathname.endsWith("/employee_profiles")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(approved ? [{
      id: "new-profile", user_id: "user-prelaunch", department_id: null, employee_code: "ONB-USERPRELA", email: "artist@sport360.com", full_name: "Sport360 Artist", title: "Pending assignment", photo_url: null, yearly_vacation_days: 21, remaining_vacation_days: 21
    }] : []) });
    return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "People", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Pending profiles", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Review New Account", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Approve Profile", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Employee Profile", exact: true })).toBeVisible();
});

for (const width of [375, 768, 1024, 1280, 1440, 1920]) {
  test(`self-service profile form fits ${width}px`, async ({ page }) => {
    await configurePrelaunch(page);
    await storeSession(page);
    await mockEmployeeOnboarding(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Tell us who you are", exact: true })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}
