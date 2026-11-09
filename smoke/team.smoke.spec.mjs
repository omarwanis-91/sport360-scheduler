import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/runtime-config.js', route => route.fulfill({ contentType: 'text/javascript', body: 'window.__SPORT360_CONFIG__={demoMode:true};' }));
});
async function openTeam(page) {
  await page.getByRole('button', { name: 'Team', exact: true }).click();
}
async function stored(page) {
  return page.evaluate(async () => JSON.parse(localStorage.getItem('sport360-scheduler-state')) || (await import('/assets/data.js')).seedState);
}

test('department parents nest correctly regardless of source order and folding preserves selection', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const state = structuredClone((await import('/assets/data.js')).seedState);
    state.departments = [
      { id: 'ops', name: 'Video Edit', parentDepartmentId: 'unit' },
      { id: 'support', name: 'Motion', parentDepartmentId: 'unit' },
      { id: 'unit', name: 'Video Unit' },
      { id: 'field', name: 'Field Team' }
    ];
    state.profiles[2].title = 'Pending assignment';
    localStorage.setItem('sport360-scheduler-state', JSON.stringify(state));
  });
  await page.reload(); await openTeam(page);
  const unit = page.locator('[data-team-tree-node="unit"]');
  await expect(unit.locator(':scope > ul > li')).toHaveCount(2);
  await expect(unit.getByRole('button', { name: /Video Edit/ })).toBeVisible();
  await page.locator('[data-team-department="ops"]').click();
  await expect(page.locator('.hierarchy-person[data-profile-id="emp-003"]')).toContainText('Job title not set');
  expect((await stored(page)).profiles.find(p => p.id === 'emp-003').title).toBe('Pending assignment');
  await page.getByRole('button', { name: 'Collapse Video Unit', exact: true }).click();
  await expect(unit.locator(':scope > ul')).toBeHidden();
  await expect(page.locator('#team-department-select')).toHaveValue('ops');
  await page.getByRole('button', { name: 'Collapse all departments', exact: true }).click();
  await expect(page.locator('#team-department-tree-root')).toBeHidden();
  await page.locator('#team-department-select').selectOption('support');
  await expect(page.getByRole('button', { name: 'Collapse Video Unit', exact: true })).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('[data-team-department="support"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-team-department="support"]')).toBeVisible();
});

test('Team tabs work with keyboard, preserve department and directory view, and respect reduced motion', async ({ page }) => {
  await page.goto('/'); await openTeam(page);
  await expect(page.getByRole('tabpanel', { name: 'Hierarchy', exact: true })).toBeVisible();
  await expect(page.locator('.team-directory-panel')).toHaveCount(0);
  await page.locator('#team-department-select').selectOption('ops');
  await page.getByRole('tab', { name: 'Hierarchy', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Directory', exact: true })).toBeFocused();
  await expect(page.locator('.team-structure-panel')).toHaveCount(0);
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('tab', { name: 'Directory', exact: true }).focus();
  await page.keyboard.press('Home');
  await expect(page.getByRole('tab', { name: 'Hierarchy', exact: true })).toBeFocused();
  expect(await page.locator('.team-structure-panel').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  await page.keyboard.press('End');
  await expect(page.getByRole('button', { name: 'List', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#team-department-select')).toHaveValue('ops');
  await expect(page.locator('.person-list-row')).toHaveCount(3);
});

test('drag and level menu persist hierarchy only and do not open the profile after a drop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto('/'); await openTeam(page);
  const before = await stored(page);
  await page.locator('.view-stage').evaluate(async element => {
    await Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished));
  });
  const source = await page.locator('[data-hierarchy-drag="emp-003"]').boundingBox();
  const target = await page.locator('[data-hierarchy-drop-level="manager"]').boundingBox();
  // Gradual native movement crosses the drag threshold in Edge as well as Firefox/Chromium.
  await page.mouse.move(source.x + 45, source.y + 20);
  await page.mouse.down();
  await page.mouse.move(source.x + 60, source.y + 20, { steps: 4 });
  await page.mouse.move(target.x + 30, target.y + 25, { steps: 12 });
  await page.mouse.move(target.x + 35, target.y + 30);
  await page.mouse.up();
  await expect(page.locator('.app-notice.success')).toContainText('Karim Adel moved to Manager');
  await expect(page.locator('.level-manager [data-hierarchy-drag="emp-003"]')).toBeVisible();
  await expect(page.locator('.drawer')).toHaveCount(0);
  await page.getByLabel('Hierarchy level for Karim Adel', { exact: true }).focus();
  await page.getByLabel('Hierarchy level for Karim Adel', { exact: true }).selectOption('lead');
  await expect(page.locator('.app-notice.success')).toContainText('Karim Adel moved to Lead');
  await expect(page.getByLabel('Hierarchy level for Karim Adel', { exact: true })).toBeFocused();
  const after = await stored(page);
  const changed = after.profiles.find(p => p.id === 'emp-003');
  expect(changed.seniorityLevel).toBe('lead');
  expect({ ...changed, seniorityLevel: 'artist' }).toEqual(before.profiles.find(p => p.id === changed.id));
  for (const key of ['users', 'departments', 'rotationVersions', 'departmentLeadRotations', 'scheduleOverrides', 'vacationRequests']) expect(after[key]).toEqual(before[key]);
  await page.reload(); await openTeam(page);
  await expect(page.locator('.level-lead [data-hierarchy-drag="emp-003"]')).toBeVisible();
});

test('Lead edits remain department scoped and Employee and Role Preview cannot drag or change levels', async ({ page }) => {
  await page.goto('/');
  await page.locator('#user-switcher').selectOption('user-lead'); await openTeam(page);
  await expect(page.locator('[data-hierarchy-drag]')).toHaveCount(3);
  await expect(page.locator('[data-team-department="support"]')).toHaveCount(0);
  await expect(page.locator('[data-hierarchy-drag="emp-004"]')).toHaveCount(0);
  await page.getByLabel('Hierarchy level for Karim Adel', { exact: true }).selectOption('manager');
  await expect(page.locator('.app-notice.success')).toContainText('moved to Manager');
  await page.locator('#user-switcher').selectOption('user-employee'); await openTeam(page);
  await expect(page.locator('[data-hierarchy-drag], [data-hierarchy-level-picker], [data-hierarchy-drop-level]')).toHaveCount(0);
  await page.locator('#user-switcher').selectOption('user-admin');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.locator('#role-preview-role').selectOption('lead');
  await page.locator('#role-preview-department').selectOption('ops');
  await page.locator('#role-preview-profile').selectOption('emp-002');
  await page.getByRole('button', { name: 'Start Preview', exact: true }).click(); await openTeam(page);
  await expect(page.locator('[data-hierarchy-drag], [data-hierarchy-level-picker], [data-hierarchy-drop-level]')).toHaveCount(0);
});

test('remote hierarchy saves use the guarded RPC and rejected saves keep the original level', async ({ page }) => {
  const url = 'https://team-test.supabase.co';
  await page.route('**/runtime-config.js', route => route.fulfill({ contentType: 'text/javascript', body: `window.__SPORT360_CONFIG__=${JSON.stringify({ supabaseUrl: url, supabaseAnonKey: 'test-key', demoMode: false })};` }));
  await page.addInitScript(() => localStorage.setItem('sport360-supabase-session', JSON.stringify({ access_token: 'test-access', refresh_token: 'test-refresh', expires_at: Date.now() + 3600000, user: { id: 'test-admin', email: 'admin@example.test' } })));
  let fail = true, payload, level = 'artist';
  const writes = [];
  await page.route(`${url}/rest/v1/**`, async route => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1);
    if (route.request().method() !== 'GET') writes.push(name);
    if (name === 'update_profile_hierarchy') {
      payload = route.request().postDataJSON();
      if (fail) return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ message: 'Hierarchy permission rejected' }) });
      level = payload.p_seniority_level;
    }
    const tables = {
      departments: [{ id: 'ops', name: 'Operations' }],
      employee_profiles: [{ id: 'person', user_id: 'test-admin', full_name: 'Test Admin', department_id: 'ops', title: 'Editor', seniority_level: level, yearly_vacation_days: 21, remaining_vacation_days: 18 }],
      user_roles: [{ user_id: 'test-admin', role: 'admin' }]
    };
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(tables[name] || []) });
  });
  await page.goto('/'); await openTeam(page);
  await page.getByLabel('Hierarchy level for Test Admin', { exact: true }).selectOption('lead');
  await expect(page.locator('.app-notice.error')).toContainText('Hierarchy permission rejected');
  await expect(page.getByLabel('Hierarchy level for Test Admin', { exact: true })).toHaveValue('artist');
  expect(payload).toEqual({ p_profile_id: 'person', p_seniority_level: 'lead' });
  fail = false;
  await page.getByLabel('Hierarchy level for Test Admin', { exact: true }).selectOption('lead');
  await expect(page.locator('.app-notice.success')).toContainText('moved to Lead');
  await page.reload(); await openTeam(page);
  await expect(page.locator('.level-lead .hierarchy-person')).toContainText('Test Admin');
  expect(writes.filter(name => !['claim_profile_for_current_user', 'list_profile_onboarding', 'refresh_annual_balances', 'update_profile_hierarchy'].includes(name))).toEqual([]);
});
