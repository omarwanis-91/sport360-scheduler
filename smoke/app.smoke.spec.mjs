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
  await expect(page.getByRole("region", { name: "Schedule controls", exact: true })).toBeVisible();

  const destinations = [
    ["Team", "Team"],
    ["Rotations", "Rotations"],
    ["My Profile", "My Profile"]
  ];

  for (const [navigationLabel, heading] of destinations) {
    await page.getByRole("button", { name: navigationLabel, exact: true }).click();
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: navigationLabel, exact: true })).toHaveAttribute("aria-current", "page");
  }
});

test("Lead sees and manages only the directly assigned department", async ({ page }) => {
  await page.goto("/");
  await page.locator("#user-switcher").selectOption("user-lead");

  await expect(page.locator("#department-select option")).toHaveCount(1);
  await expect(page.locator("#department-select")).toHaveValue("ops");
  await expect(page.getByRole("button", { name: "Edit daily leads", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Activity", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Settings", exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Team", exact: true }).click();
  await expect(page.locator(".person-card")).toHaveCount(3);
  await expect(page.locator(".person-card").filter({ hasText: "Omar Wanis" })).toBeVisible();
  await expect(page.locator(".person-card").filter({ hasText: "Mona Saleh" })).toBeVisible();
  await expect(page.locator(".person-card").filter({ hasText: "Karim Adel" })).toBeVisible();
  await expect(page.getByText("Youssef Nabil", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Layla Hassan", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "New Profile", exact: true })).toHaveCount(0);

  await page.locator(".person-card").filter({ hasText: "Karim Adel" }).click();
  await page.getByRole("button", { name: "Edit Hierarchy", exact: true }).click();
  await expect(page.getByLabel("Name", { exact: true })).toBeDisabled();
  await expect(page.getByLabel("Title", { exact: true })).toBeDisabled();
  await expect(page.getByRole("combobox", { name: "Hierarchy role", exact: true })).toBeEnabled();
  await page.locator("#close-drawer").click();

  await page.locator("#team-department-select").selectOption("ops");
  await expect(page.getByRole("button", { name: /Member$/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "New Department", exact: true })).toHaveCount(0);
});

test("Employee has department read access and own identity editing only", async ({ page }) => {
  await page.goto("/");
  await page.locator("#user-switcher").selectOption("user-employee");

  await expect(page.locator("#department-select option")).toHaveCount(1);
  await expect(page.locator("#department-select")).toHaveValue("support");
  await expect(page.getByRole("button", { name: "Edit daily leads", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Activity", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Settings", exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Team", exact: true }).click();
  await expect(page.locator(".person-card")).toHaveCount(1);
  await expect(page.locator(".person-card").filter({ hasText: "Youssef Nabil" })).toBeVisible();
  await expect(page.getByText("Omar Wanis", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Mona Saleh", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "My Profile", exact: true }).click();
  await page.getByRole("button", { name: "Edit My Profile", exact: true }).click();
  await expect(page.getByLabel("Name", { exact: true })).toBeEnabled();
  await expect(page.locator("#photo-input")).toBeEnabled();
  await expect(page.getByLabel("Title", { exact: true })).toBeDisabled();
  await expect(page.getByRole("combobox", { name: "Hierarchy role", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Save Profile", exact: true })).toBeEnabled();
});

test("Admin can preview Employee access without changing the signed-in user", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();

  await page.locator("#role-preview-role").selectOption("employee");
  await page.locator("#role-preview-department").selectOption("support");
  await page.locator("#role-preview-profile").selectOption("emp-004");
  await page.getByRole("button", { name: "Start Preview", exact: true }).click();

  const banner = page.getByRole("region", { name: "Role Preview is active" });
  await expect(banner).toContainText("Previewing Employee · Customer Support");
  await expect(banner).toContainText("Supabase session remains Admin");
  await expect(page.locator("#department-select option")).toHaveCount(1);
  await expect(page.locator("#department-select")).toHaveValue("support");
  await expect(page.getByRole("button", { name: "Edit daily leads", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Activity", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Settings", exact: true })).toHaveCount(0);
  await expect(page.locator(".user-tile")).toContainText("Youssef Nabil");
  await expect(page.locator(".user-tile")).toContainText("employee preview");

  await page.getByRole("button", { name: "My Profile", exact: true }).click();
  await page.getByRole("button", { name: "Edit My Profile", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Preview Must Not Save");
  await page.getByRole("button", { name: "Save Profile", exact: true }).click();
  await expect(page.locator(".app-notice.warning")).toContainText("Role Preview is read-only");
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Youssef Nabil");

  await page.locator(".role-preview-sidebar").getByRole("button", { name: "Exit Preview", exact: true }).click();
  await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeVisible();
  await expect(page.locator(".user-tile")).toContainText("Omar Wanis");
  await expect(page.locator(".role-preview-banner")).toHaveCount(0);
});

test("Admin can preview Lead scope for one selected department", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();

  await page.locator("#role-preview-role").selectOption("lead");
  await page.locator("#role-preview-department").selectOption("ops");
  await page.locator("#role-preview-profile").selectOption("emp-002");
  await page.getByRole("button", { name: "Start Preview", exact: true }).click();

  await expect(page.getByRole("region", { name: "Role Preview is active" })).toContainText("Previewing Lead · Operations");
  await expect(page.locator("#department-select option")).toHaveCount(1);
  await expect(page.locator("#department-select")).toHaveValue("ops");
  await expect(page.getByRole("button", { name: "Edit daily leads", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Activity", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Settings", exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Team", exact: true }).click();
  await expect(page.locator(".person-card")).toHaveCount(3);
  await expect(page.getByText("Youssef Nabil", { exact: true })).toHaveCount(0);
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

  await page.getByRole("button", { name: "Team", exact: true }).click();
  await expect(page.getByRole("button", { name: "Default", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Kanban", exact: true })).toHaveAttribute("aria-pressed", "false");

  await page.getByRole("button", { name: "My Profile", exact: true }).click();
  await page.getByRole("button", { name: "Edit My Profile", exact: true }).click();
  await expect(page.locator("#close-drawer")).toHaveAccessibleName(/^Close /);
});

test("primary views reveal their panels and cards with a staggered entrance", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Team", exact: true }).click();

  const stage = page.locator('.view-stage[data-active-view="team"]');
  await expect(stage).toHaveClass(/is-entering/);
  await expect(page.locator(".person-card").first()).toBeVisible();
  const animationName = await page.locator(".person-card").first().evaluate((element) => getComputedStyle(element).animationName);
  expect(animationName).toContain("sport360CascadeIn");

  await page.locator("#team-department-select").selectOption("all");
  await expect(stage).not.toHaveClass(/is-entering/);
});

test("schedule, rotation, and profile surfaces keep a restrained status tint", async ({ page }) => {
  await page.goto("/");

  const morningCell = page.locator(".shift-cell.morning").first();
  const nightCell = page.locator(".shift-cell.night").first();
  await expect(morningCell).toBeVisible();
  await expect(nightCell).toBeVisible();

  const morningSurface = await morningCell.evaluate((element) => {
    const style = getComputedStyle(element);
    const iconStyle = getComputedStyle(element.querySelector(".shift-icon"));
    return { backgroundColor: style.backgroundColor, backgroundImage: style.backgroundImage, iconColor: iconStyle.color };
  });
  const nightSurface = await nightCell.evaluate((element) => {
    const style = getComputedStyle(element);
    const iconStyle = getComputedStyle(element.querySelector(".shift-icon"));
    return { backgroundColor: style.backgroundColor, backgroundImage: style.backgroundImage, iconColor: iconStyle.color };
  });

  expect(morningSurface.backgroundColor).toBe(nightSurface.backgroundColor);
  expect(morningSurface.backgroundImage).not.toBe(nightSurface.backgroundImage);
  expect(morningSurface.iconColor).not.toBe(nightSurface.iconColor);

  const scheduleSurfaces = await page.locator(".schedule-grid .shift-cell").evaluateAll((elements) => [
    ...new Set(elements.map((element) => {
      const style = getComputedStyle(element);
      return `${style.backgroundColor}|${style.backgroundImage}`;
    }))
  ]);
  expect(scheduleSurfaces.length).toBeGreaterThan(1);
  expect(scheduleSurfaces.length).toBeLessThanOrEqual(7);

  const cardGeometry = await morningCell.evaluate((element) => {
    const style = getComputedStyle(element);
    const gridStyle = getComputedStyle(element.closest(".schedule-grid"));
    return { borderRadius: parseFloat(style.borderRadius), columnGap: parseFloat(gridStyle.columnGap) };
  });
  expect(cardGeometry.borderRadius).toBeGreaterThan(0);
  expect(cardGeometry.columnGap).toBeGreaterThan(0);

  await page.getByRole("button", { name: "My Profile", exact: true }).click();
  const calendarSurfaces = await page.locator(".month-day:not(.empty):not(.today):not(.selected)").evaluateAll((elements) => [
    ...new Set(elements.map((element) => {
      const style = getComputedStyle(element);
      return `${style.backgroundColor}|${style.backgroundImage}`;
    }))
  ]);
  expect(calendarSurfaces.length).toBeGreaterThan(1);

  await page.getByRole("button", { name: "Rotations", exact: true }).click();
  const rotationMorning = page.locator(".rotation-cell.morning").first();
  const rotationNight = page.locator(".rotation-cell.night").first();
  await expect(rotationMorning).toBeVisible();
  await expect(rotationNight).toBeVisible();
  expect(await rotationMorning.evaluate((element) => getComputedStyle(element).backgroundImage))
    .not.toBe(await rotationNight.evaluate((element) => getComputedStyle(element).backgroundImage));
});

test("lead shifts replace their underlying rotation and non-working states stay subdued", async ({ page }) => {
  await page.goto("/");

  const leadHeader = page.locator('.date-head[aria-label*="Lead: Mona"]').first();
  await expect(leadHeader).toBeVisible();
  const leadDate = await leadHeader.getAttribute("data-date");
  const schedulerLead = page.locator(`.shift-cell[data-profile-id="emp-002"][data-date="${leadDate}"]`);
  await expect(schedulerLead).toHaveClass(/lead/);
  await expect(schedulerLead.locator(".shift-label")).toHaveText("Lead");
  await expect(schedulerLead).not.toContainText("Morning");
  await expect(schedulerLead.locator(".lead-marker")).toHaveCount(0);

  const morningRail = await page.locator(".shift-cell.morning").first().evaluate((element) => getComputedStyle(element, "::before").backgroundColor);
  const nightRail = await page.locator(".shift-cell.night").first().evaluate((element) => getComputedStyle(element, "::before").backgroundColor);
  expect(morningRail).not.toBe(nightRail);

  const weekendCell = page.locator(".shift-cell.weekend").first();
  const weekendTexture = await weekendCell.evaluate((element) => getComputedStyle(element).backgroundImage);
  expect(weekendTexture).toContain("repeating-linear-gradient");
  const restingOffDay = await weekendCell.evaluate((element) => ({
    opacity: Number(getComputedStyle(element).opacity),
    railOpacity: Number(getComputedStyle(element, "::before").opacity),
    railColor: getComputedStyle(element, "::before").backgroundColor,
    labelOpacity: Number(getComputedStyle(element.querySelector(".shift-label")).opacity),
    labelFilter: getComputedStyle(element.querySelector(".shift-label")).filter
  }));
  expect(restingOffDay.opacity).toBe(1);
  expect(restingOffDay.railOpacity).toBeGreaterThanOrEqual(0.9);
  expect(restingOffDay.railColor).not.toBe("rgba(0, 0, 0, 0)");
  expect(restingOffDay.labelOpacity).toBeLessThanOrEqual(0.5);
  expect(restingOffDay.labelFilter).toContain("blur");
  expect(restingOffDay.labelFilter).toContain("brightness");

  await weekendCell.hover();
  await expect.poll(() => weekendCell.locator(".shift-label").evaluate((element) => Number(getComputedStyle(element).opacity))).toBe(1);
  const activeOffDayFilter = await weekendCell.locator(".shift-label").evaluate((element) => getComputedStyle(element).filter);
  expect(activeOffDayFilter).toContain("brightness(1.08)");
  expect(activeOffDayFilter).toContain("blur(0px)");

  await page.locator("#department-select").selectOption("support");
  await page.locator("#schedule-start-date").fill("2026-05-18");
  await page.locator("#schedule-start-date").press("Tab");
  const sickShift = page.locator('.shift-cell[data-profile-id="emp-004"][data-date="2026-05-18"]');
  await expect(sickShift).toHaveClass(/sick/);
  await page.mouse.move(0, 0);
  expect(await sickShift.evaluate((element) => getComputedStyle(element).backgroundImage)).toContain("repeating-linear-gradient");

  const weekBands = page.locator(".week-band");
  await expect(weekBands).toHaveCount(2);
  await expect(weekBands.first()).toContainText(/Week\s+21/);
  await expect(weekBands.nth(1)).toContainText(/Week\s+22/);
  const weekBandStyle = await weekBands.first().evaluate((element) => ({
    borderLeftWidth: getComputedStyle(element).borderLeftWidth,
    borderRightWidth: getComputedStyle(element).borderRightWidth,
    borderRadius: parseFloat(getComputedStyle(element).borderRadius)
  }));
  expect(weekBandStyle.borderLeftWidth).toBe("1px");
  expect(weekBandStyle.borderRightWidth).toBe("1px");
  expect(weekBandStyle.borderRadius).toBeGreaterThan(0);

  const weekSeparator = page.locator(".date-head.week-start").first();
  const weekSeparatorStyle = await weekSeparator.evaluate((element) => ({
    marginLeft: getComputedStyle(element).marginLeft,
    borderLeftWidth: getComputedStyle(element).borderLeftWidth,
    boxShadow: getComputedStyle(element).boxShadow
  }));
  expect(weekSeparatorStyle.marginLeft).toBe("12px");
  expect(weekSeparatorStyle.borderLeftWidth).toBe("1px");
  expect(weekSeparatorStyle.boxShadow).not.toBe("none");

  await page.locator("#user-switcher").selectOption("user-lead");
  await page.getByRole("button", { name: "My Profile", exact: true }).click();
  await expect(page.locator(".my-shifts .request-row.lead").first()).toContainText("Lead - Department lead");

  await page.getByRole("button", { name: "Rotations", exact: true }).click();
  const rotationLead = page.locator('.rotation-cell[data-profile-id="emp-002"][data-weekday="4"]');
  await expect(rotationLead).toHaveClass(/lead/);
  await expect(rotationLead.locator(".shift-label")).toHaveText("Lead");
  await expect(rotationLead).not.toContainText("Night");
});

test("pending annual appears only on affected working days and stays on one line", async ({ page }) => {
  await page.goto("/");
  await page.locator("#schedule-start-date").fill("2026-05-22");
  await page.locator("#schedule-start-date").press("Tab");

  const workingDay = page.locator('.shift-cell[data-profile-id="emp-003"][data-date="2026-05-22"]');
  const saturday = page.locator('.shift-cell[data-profile-id="emp-003"][data-date="2026-05-23"]');
  const sunday = page.locator('.shift-cell[data-profile-id="emp-003"][data-date="2026-05-24"]');
  await expect(workingDay.locator(".cell-alert")).toHaveText("Pending annual");
  await expect(saturday.locator(".cell-alert")).toHaveCount(0);
  await expect(sunday.locator(".cell-alert")).toHaveCount(0);
  expect(await workingDay.locator(".cell-alert").evaluate((element) => getComputedStyle(element).whiteSpace)).toBe("nowrap");
});

test("annual requests reject ranges containing only protected non-working days", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Requests", exact: true }).click();
  await page.getByRole("button", { name: "New Request", exact: true }).click();
  await page.locator('#request-form select[name="profileId"]').selectOption("emp-004");
  await page.locator('#request-form input[name="startDate"]').fill("2026-05-18");
  await page.locator('#request-form input[name="endDate"]').fill("2026-05-18");
  await page.getByRole("button", { name: "Submit Request", exact: true }).click();

  await expect(page.locator(".app-notice.error")).toContainText("no eligible working days");
  await expect(page.locator("#request-form")).toBeVisible();
});

test("scheduler headers stay concise and keep lead context accessible", async ({ page }) => {
  await page.goto("/");

  const missingLeadHeader = page.locator(".date-head.lead-missing").first();
  await expect(missingLeadHeader).toBeVisible();
  await expect(missingLeadHeader).toHaveAccessibleName(/Lead missing/);
  await expect(page.locator(".date-head em")).toHaveCount(0);
  await expect(page.locator(".coverage-cell, .coverage-head, #schedule-status-filter, [data-filter]")).toHaveCount(0);
});

test("creation opens centered while editing stays in the right sidebar", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Team", exact: true }).click();

  await page.getByRole("button", { name: "New Department", exact: true }).click();
  await expect(page.locator(".drawer.creation-modal")).toBeVisible();
  await expect(page.getByRole("heading", { name: "New Department", exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Department name", exact: true }).fill("Motion Graphics");
  await page.getByRole("combobox", { name: "Parent department", exact: true }).selectOption("ops");
  await page.getByRole("button", { name: "Create Department", exact: true }).click();
  const subDepartmentOption = page.locator(".team-department-option").filter({ hasText: "Motion Graphics" });
  await expect(subDepartmentOption).toContainText("Operations");
  await expect(subDepartmentOption).toContainText("0");

  await page.locator("#close-drawer").click();
  await subDepartmentOption.click();
  await page.getByRole("button", { name: "Edit department", exact: true }).click();
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

test("authorized scheduler clicks open one-time shift editing without lead edit mode", async ({ page }) => {
  await page.goto("/");
  const beforeRotations = await page.evaluate(async () => (JSON.parse(localStorage.getItem('sport360-scheduler-state')) || (await import('/assets/data.js')).seedState).rotationVersions);

  const shift = page.locator('.schedule-grid .shift-cell[data-profile-id="emp-001"]').first();
  const date = await shift.getAttribute("data-date");
  const originalLabel = await shift.locator(".shift-label").textContent();
  await expect(shift).toHaveAttribute("data-open-drawer", "shift");
  await shift.click();

  await expect(page.getByRole("heading", { name: "Shift Override", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save Daily Change", exact: true })).toBeEnabled();
  await expect(page.getByText("Saving creates a manual daily change.", { exact: false })).toBeVisible();
  await page.locator('#shift-form .status-choice.sick').click();
  await expect(page.locator('#shift-form input[name="statusId"][value="sick"]')).toBeChecked();
  await page.getByRole("button", { name: "Save Daily Change", exact: true }).click();
  await expect(page.locator(".app-notice.success")).toContainText("Daily change saved.");
  const savedState = await page.evaluate(() => JSON.parse(localStorage.getItem('sport360-scheduler-state')));
  expect(savedState.rotationVersions).toEqual(beforeRotations);
  expect(savedState.scheduleOverrides.filter(row => row.profileId === 'emp-001' && row.date === date)).toHaveLength(1);
  await page.reload();
  const savedShift = page.locator(`.schedule-grid .shift-cell[data-profile-id="emp-001"][data-date="${date}"]`);
  await expect(savedShift.locator(".shift-label")).toHaveText("Sick");
  await savedShift.click();
  await page.getByRole("button", { name: "Clear Override", exact: true }).click();
  await expect(page.locator(".app-notice.success")).toContainText("Daily change cleared.");
  await page.reload();
  await expect(savedShift.locator(".shift-label")).toHaveText(originalLabel);
});

test("annual request review includes the affected team rotation mini view", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Requests", exact: true }).click();
  await page.locator(".request-row").first().click();

  await expect(page.locator(".drawer.request-review-modal")).toBeVisible();
  const reviewGeometry = await page.locator(".drawer.request-review-modal").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { width: rect.width, centerDelta: Math.abs((rect.left + rect.width / 2) - window.innerWidth / 2) };
  });
  expect(reviewGeometry.width).toBeGreaterThan(700);
  expect(reviewGeometry.centerDelta).toBeLessThan(2);
  await expect(page.getByText("Team Rotation Impact", { exact: true })).toBeVisible();
  await expect(page.locator(".leave-team-impact")).toContainText("Operations team");
  await expect(page.locator(".leave-impact-person.requested")).toContainText("Karim Adel");
  const projectedAnnual = page.locator(".leave-impact-shift.projected").first();
  await expect(projectedAnnual).toBeVisible();
  expect(await projectedAnnual.evaluate((element) => getComputedStyle(element).backgroundImage)).toContain("repeating-linear-gradient");
});

test("rotation pattern choices update in place without refreshing the workspace", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Rotations", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit Rotation", exact: true })).toHaveCount(0);
  await page.locator('.rotation-cell [data-open-drawer="rotation-detail"]').first().click();

  await page.getByPlaceholder("Preset name", { exact: true }).fill("Unsaved draft");
  await page.evaluate(() => { window.__sport360WorkspaceBeforePatternEdit = document.querySelector(".workspace"); });
  const option = page.locator(".pattern-slot").first().locator(".pattern-chip:not(.active)").first();
  const selectedStatus = await option.getAttribute("data-pattern-status");
  await option.click();

  await expect(page.getByPlaceholder("Preset name", { exact: true })).toHaveValue("Unsaved draft");
  expect(await page.evaluate(() => window.__sport360WorkspaceBeforePatternEdit === document.querySelector(".workspace"))).toBe(true);
  await expect(page.locator(".pattern-slot").first().locator(`[data-pattern-status="${selectedStatus}"]`)).toHaveAttribute("aria-pressed", "true");
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
  await expect(page.locator('.rotation-cell[data-profile-id="emp-002"][data-weekday="0"]')).toHaveClass(/lead/);
  await expect(page.locator('.rotation-cell[data-profile-id="emp-002"][data-weekday="0"] .shift-label')).toHaveText("Lead");
  await expect(page.getByRole("button", { name: "Edit Rotation", exact: true })).toHaveCount(0);
  const newMondayLead = page.locator('.rotation-cell[data-profile-id="emp-001"][data-weekday="0"] .lead-shift-button');
  await newMondayLead.click();
  await expect(page.locator('.rotation-cell[data-profile-id="emp-001"][data-weekday="0"]')).toHaveClass(/lead/);
  await expect(page.locator('.rotation-cell[data-profile-id="emp-001"][data-weekday="0"] .shift-label')).toHaveText("Lead");
  await expect(page.locator('.rotation-cell[data-profile-id="emp-002"][data-weekday="0"]')).toHaveClass(/morning/);

  await page.getByRole("button", { name: "Scheduler", exact: true }).click();
  if (weekend) {
    await expect(page.locator(`.date-head[data-date="${today}"]`)).toHaveAccessibleName(/Lead missing/);
    await expect(page.locator(`.shift-cell[data-profile-id="${expectedLeadProfileId}"][data-date="${today}"] .lead-marker`)).toHaveCount(0);
  } else {
    await expect(page.locator(`.date-head[data-date="${today}"]`)).toHaveAccessibleName(new RegExp(`Lead: ${expectedLead}`));
    const scheduledLeadCell = page.locator(`.shift-cell[data-profile-id="${expectedLeadProfileId}"][data-date="${today}"]`);
    await expect(scheduledLeadCell).toHaveClass(/lead/);
    await expect(scheduledLeadCell.locator(".shift-label")).toHaveText("Lead");
    await expect(scheduledLeadCell.locator(".lead-marker")).toHaveCount(0);
  }
  await expect(page.locator(".date-head.today")).toContainText("Today");
  if (weekend) {
    await page.getByRole("button", { name: "Edit daily leads", exact: true }).click();
  }
  await page.locator(".date-head.today").click();
  if (weekend) {
    await expect(page.getByRole("combobox", { name: "Daily lead override", exact: true })).toBeVisible();
  } else {
    await expect(page.getByRole("heading", { name: "Coverage", exact: true })).toBeVisible();
  }
});

test("parent department daily lead overrides can return to weekly rotation", async ({ page }) => {
  const today = localIso();
  await page.goto("/");
  await page.evaluate(async (date) => {
    const { seedState } = await import("/assets/data.js");
    const storedState = structuredClone(seedState);
    storedState.departments.push({ id: "ops-edit", name: "Editing", parentDepartmentId: "ops" });
    storedState.profiles
      .filter((profile) => profile.departmentId === "ops")
      .forEach((profile) => {
        profile.departmentId = "ops-edit";
        profile.departmentIds = ["ops-edit"];
      });
    storedState.rotationVersions
      .filter((rotation) => rotation.profileId === "emp-002")
      .forEach((rotation) => {
        rotation.pattern = Array(7).fill("morning");
      });
    storedState.departmentLeads.push({
      id: "parent-daily-lead",
      departmentId: "ops",
      date,
      profileId: "emp-002"
    });
    localStorage.setItem("sport360-scheduler-state", JSON.stringify(storedState));
  }, today);
  await page.reload();

  await page.getByRole("button", { name: "Edit daily leads", exact: true }).click();
  await page.locator(`.date-head[data-date="${today}"]`).click();

  const dailyLeadSelect = page.getByRole("combobox", { name: "Daily lead override", exact: true });
  await expect(dailyLeadSelect).toHaveValue("emp-002");
  await dailyLeadSelect.selectOption("");
  await page.getByRole("button", { name: "Save Lead", exact: true }).click();

  await expect(page.getByText("Daily lead returned to weekly rotation.", { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate((date) => {
    const storedState = JSON.parse(localStorage.getItem("sport360-scheduler-state"));
    return storedState.departmentLeads.some((lead) => lead.departmentId === "ops" && lead.date === date);
  }, today)).toBe(false);
});

test("scheduler zoom switches week, two-week, and month density", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator(".scheduler-month-bar")).toContainText(currentMonthLabel());
  await expect(page.locator('#schedule-status-filter, #range-select, [data-filter]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: /New Profile/, exact: false })).toHaveCount(0);
  await expect(page.locator(".schedule-grid.range-two-weeks")).toBeVisible();
  await page.getByTitle("Zoom in").click();
  await expect(page.locator(".schedule-grid.range-week")).toBeVisible();
  await page.getByTitle("Zoom out").click();
  await page.getByTitle("Zoom out").click();
  await expect(page.locator(".schedule-grid.range-month")).toBeVisible();
  await expect(page.getByLabel("Schedule zoom level", { exact: true })).toHaveText("50%");
  const toolbarBefore = await page.locator(".scheduler-toolbar").boundingBox();
  await page.locator(".scheduler-shell").evaluate((element) => { element.scrollLeft = element.scrollWidth; });
  const toolbarAfter = await page.locator(".scheduler-toolbar").boundingBox();
  expect(toolbarAfter.x).toBe(toolbarBefore.x);
  await expect(page.getByTitle("Zoom in", { exact: true })).toBeInViewport();
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
  await page.getByRole("button", { name: "Team", exact: true }).click();

  await page.locator('.person-card[data-profile-id="emp-003"]').click();
  await expect(page.getByRole("button", { name: "Delete Profile", exact: true })).toBeVisible();

  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });
  await page.getByRole("button", { name: "Delete Profile", exact: true }).click();
  await expect(page.getByText("Karim Adel", { exact: true })).toHaveCount(0);
});

test("unified Team workspace groups people as managers, leads, and artists", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "My Profile", exact: true }).click();
  await page.getByRole("button", { name: "Edit My Profile", exact: true }).click();
  await page.getByRole("checkbox", { name: "Customer Support", exact: true }).check();
  await page.getByRole("button", { name: "Save Profile", exact: true }).click();

  await page.getByRole("button", { name: "Team", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Team", exact: true })).toBeVisible();
  await page.locator("#team-department-select").selectOption("ops");
  const operations = page.locator('[data-hierarchy-department="ops"]');
  await expect(operations).toBeVisible();
  await expect(operations.getByText("Manager", { exact: true })).toBeVisible();
  await expect(operations.getByText("Lead", { exact: true })).toBeVisible();
  await expect(operations.getByText("Artist", { exact: true })).toBeVisible();
  await expect(operations.getByText("Omar Wanis", { exact: true })).toBeVisible();
  await page.locator("#team-department-select").selectOption("support");
  const support = page.locator('[data-hierarchy-department="support"]');
  await expect(support).toBeVisible();
  await expect(support.getByText("Omar Wanis", { exact: true })).toBeVisible();
  await expect(page.locator('[data-hierarchy-department="ops"]')).toHaveCount(0);
});
