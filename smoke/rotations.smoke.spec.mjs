import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/runtime-config.js', route => route.fulfill({
    contentType: 'text/javascript',
    body: 'window.__SPORT360_CONFIG__ = {demoMode:true};'
  }));
});

async function commit(page) {
  if (await page.locator('#rotation-done').count()) {
    await page.locator('#rotation-done').click();
    await expect(page.locator('.drawer')).toHaveCount(0);
  }
  await page.locator('#save-rotation-edit').click();
}
async function readState(page) {
  return page.evaluate(async () => JSON.parse(localStorage.getItem('sport360-scheduler-state')) || (await import('/assets/data.js')).seedState);
}

test('empty rotation cells create a week directly and can be edited again on the same start', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const { seedState } = await import('/assets/data.js');
    const clean = structuredClone(seedState);
    clean.rotationVersions = [];
    clean.departmentLeadRotations = [];
    localStorage.setItem('sport360-scheduler-state', JSON.stringify(clean));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Rotations', exact: true }).click();
  await expect(page.locator('#toggle-department-rotation-edit, #continue-department-rotation-edit, [data-rotation-profile-select]')).toHaveCount(0);
  await page.locator('.rotation-cell[data-profile-id="emp-001"][data-weekday="2"] .rotation-cell-open').click();
  await expect(page.locator('.pattern-slot.is-targeted .pattern-slot-head')).toContainText('Wed');
  await page.locator('[data-pattern-day="2"][data-pattern-status="night"]').click();
  await commit(page);
  await expect(page.locator('.app-notice.success')).toContainText('Saved');
  await page.reload();
  await page.getByRole('button', { name: 'Rotations', exact: true }).click();
  const cell = page.locator('.rotation-cell[data-profile-id="emp-001"][data-weekday="2"]');
  await expect(cell.locator('.shift-label')).toHaveText('Night');
  await cell.locator('.rotation-cell-open').click();
  await page.locator('[data-pattern-day="2"][data-pattern-status="midday"]').click();
  await commit(page);
  await expect(page.locator('.app-notice.success')).toContainText('Saved');
  const saved = await readState(page);
  expect(saved.rotationVersions.filter(r => r.profileId === 'emp-001')).toHaveLength(1);
  expect(saved.rotationVersions.find(r => r.profileId === 'emp-001').pattern[2]).toBe('midday');
});

test('rotation copy pastes to one person and a department while preserving history and exceptions', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Rotations', exact: true }).click();
  await page.locator('[data-copy-rotation="emp-002"]').click();
  const before = await readState(page);
  const copied = before.rotationVersions.find(r => r.profileId === 'emp-002').pattern;
  await page.locator('[data-paste-rotation="emp-001"]').click();
  await expect(page.locator('#rotation-form')).toContainText('Copied from Mona Saleh');
  await commit(page);
  await expect(page.locator('.app-notice.success')).toContainText('Saved');
  const single = await readState(page);
  expect(single.rotationVersions.filter(r => r.profileId === 'emp-001').at(-1).pattern).toEqual(copied);
  expect(single.rotationVersions.find(r => r.id === 'rot-001')).toEqual(before.rotationVersions.find(r => r.id === 'rot-001'));

  await page.locator('#paste-department-rotation').click();
  await expect(page.locator('#rotation-paste-form')).toContainText('3 people');
  await expect(page.locator('.rotation-paste-day')).toHaveCount(7);
  await page.getByRole('button', { name: 'Paste to 3 people', exact: true }).click();
  await commit(page);
  await expect(page.locator('.app-notice.success')).toContainText('Saved');
  const all = await readState(page);
  for (const id of ['emp-001', 'emp-002', 'emp-003']) {
    const versions = all.rotationVersions.filter(r => r.profileId === id);
    if (id !== 'emp-002') expect(versions.at(-1).pattern).toEqual(copied);
    expect(new Set(versions.map(r => r.effectiveStart)).size).toBe(versions.length);
  }
  for (const old of before.rotationVersions) expect(all.rotationVersions.find(r => r.id === old.id)).toEqual(old);
  expect(all.scheduleOverrides).toEqual(before.scheduleOverrides);
  expect(all.vacationRequests).toEqual(before.vacationRequests);
  expect(all.departmentLeadRotations).toEqual(before.departmentLeadRotations);
  await page.reload();
  await page.getByRole('button', { name: 'Rotations', exact: true }).click();
  await expect(page.locator('[data-paste-rotation="emp-001"]')).toBeDisabled();
});

test('Employees and role preview cannot edit or paste rotations', async ({ page }) => {
  await page.goto('/');
  await page.locator('#user-switcher').selectOption('user-employee');
  await page.getByRole('button', { name: 'Rotations', exact: true }).click();
  await expect(page.locator('.rotation-cell-open, [data-copy-rotation], [data-paste-rotation], #paste-department-rotation, .lead-shift-button')).toHaveCount(0);
  await page.locator('#user-switcher').selectOption('user-admin');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.locator('#role-preview-role').selectOption('lead');
  await page.locator('#role-preview-profile').selectOption('emp-002');
  await page.getByRole('button', { name: 'Start Preview', exact: true }).click();
  await page.getByRole('button', { name: 'Rotations', exact: true }).click();
  await expect(page.locator('.rotation-cell-open, [data-copy-rotation], [data-paste-rotation], #paste-department-rotation, .lead-shift-button')).toHaveCount(0);
});

test('weekly lead stars save directly without a rotation edit-mode gate', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Rotations', exact: true }).click();
  await page.locator('.rotation-cell[data-profile-id="emp-001"][data-weekday="0"] .lead-shift-button').click();
  await commit(page);
  await expect(page.locator('.app-notice.success')).toContainText('Saved');
  await page.reload();
  await page.getByRole('button', { name: 'Rotations', exact: true }).click();
  await expect(page.locator('.rotation-cell[data-profile-id="emp-001"][data-weekday="0"] .shift-label')).toHaveText('Lead');
});

test('Lead is explicit in each day and never defaults to the first person', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const { seedState } = await import('/assets/data.js');
    const clean = structuredClone(seedState);
    clean.rotationVersions = [];
    clean.departmentLeadRotations = [];
    clean.departmentLeads = [];
    localStorage.setItem('sport360-scheduler-state', JSON.stringify(clean));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Rotations', exact: true }).click();
  await page.locator('.rotation-cell[data-profile-id="emp-001"][data-weekday="0"] .rotation-cell-open').click();
  await expect(page.locator('[data-pattern-status="lead"]')).toHaveCount(7);
  await page.locator('[data-pattern-day="0"][data-pattern-status="night"]').click();
  await commit(page);
  await expect(page.locator('.app-notice.success')).toContainText('Saved');
  expect((await readState(page)).departmentLeadRotations).toHaveLength(0);
  await expect(page.locator('.rotation-cell.lead')).toHaveCount(0);

  const wednesday = page.locator('.rotation-cell[data-profile-id="emp-001"][data-weekday="2"]');
  await wednesday.locator('.rotation-cell-open').click();
  await page.locator('[data-pattern-day="2"][data-pattern-status="lead"]').click();
  await expect(page.locator('.pattern-slot').nth(2).locator('.pattern-slot-head strong')).toHaveText('Lead');
  await commit(page);
  await expect(wednesday.locator('.shift-label')).toHaveText('Lead');
  const explicit = await readState(page);
  expect(explicit.departmentLeadRotations[0].pattern).toEqual(['', '', 'emp-001', '', '', '', '']);
  await page.reload();
  await page.getByRole('button', { name: 'Rotations', exact: true }).click();
  await wednesday.locator('.rotation-cell-open').click();
  await expect(page.locator('[data-pattern-day="2"][data-pattern-status="lead"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-pattern-day="2"][data-pattern-status="morning"]').click();
  await commit(page);
  await expect(page.locator('.rotation-cell.lead')).toHaveCount(0);
  expect((await readState(page)).departmentLeadRotations[0].pattern).toEqual(Array(7).fill(''));
  await expect(page.locator('.rotation-cell[data-profile-id="emp-001"][data-weekday="0"] .shift-label')).toHaveText('Night');
});

test('Admin can confirm a full rotation reset without older versions or leads resurfacing', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const { seedState } = await import('/assets/data.js');
    const setup = structuredClone(seedState);
    setup.rotationVersions.push({ id: 'future', profileId: 'emp-001', effectiveStart: '2099-01-01', pattern: Array(7).fill('morning') });
    setup.departmentLeadRotations[0].pattern = ['emp-001', 'emp-002', 'emp-001', 'emp-002', 'emp-002', 'emp-003', 'emp-003'];
    localStorage.setItem('sport360-scheduler-state', JSON.stringify(setup));
  });
  await page.reload();
  const before = await readState(page);
  await page.getByRole('button', { name: 'Rotations', exact: true }).click();
  await page.getByRole('button', { name: 'Edit rotation for Omar Wanis', exact: true }).click();
  await page.getByRole('button', { name: 'Delete Rotation', exact: true }).click();
  await expect(page.locator('.drawer')).toContainText('all 2 weekly rotation versions');
  await page.getByRole('button', { name: 'Keep Rotation', exact: true }).click();
  expect((await readState(page)).rotationVersions).toEqual(before.rotationVersions);
  await page.getByRole('button', { name: 'Delete Rotation', exact: true }).click();
  await page.getByRole('button', { name: 'Stage Rotation Reset', exact: true }).click();
  await commit(page);
  await expect(page.locator('.app-notice.success')).toContainText('Saved');
  await expect(page.locator('.rotation-cell[data-profile-id="emp-001"].missing')).toHaveCount(7);
  const after = await readState(page);
  expect(after.rotationVersions).toEqual(before.rotationVersions.filter(r => r.profileId !== 'emp-001'));
  expect(after.departmentLeadRotations[0].pattern).toEqual(['', 'emp-002', '', 'emp-002', 'emp-002', 'emp-003', 'emp-003']);
  expect(after.scheduleOverrides).toEqual(before.scheduleOverrides);
  expect(after.vacationRequests).toEqual(before.vacationRequests);
  expect(after.profiles).toEqual(before.profiles);
  await page.reload();
  await page.getByRole('button', { name: 'Rotations', exact: true }).click();
  await expect(page.locator('.rotation-cell[data-profile-id="emp-001"].missing')).toHaveCount(7);
  await page.locator('#user-switcher').selectOption('user-lead');
  await page.getByRole('button', { name: 'Rotations', exact: true }).click();
  await page.getByRole('button', { name: 'Edit rotation for Mona Saleh', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Delete Rotation', exact: true })).toHaveCount(0);
});

test('remote rotation save uses the atomic RPC and retains the draft on failure', async ({ page }) => {
  const url = 'https://rotations-test.supabase.co';
  await page.route('**/runtime-config.js', route => route.fulfill({
    contentType: 'text/javascript',
    body: `window.__SPORT360_CONFIG__ = ${JSON.stringify({ supabaseUrl: url, supabaseAnonKey: 'test-key', demoMode: false })};`
  }));
  await page.addInitScript(() => localStorage.setItem('sport360-supabase-session', JSON.stringify({
    access_token: 'test-access', refresh_token: 'test-refresh', expires_at: Date.now() + 3600000,
    user: { id: 'test-admin', email: 'admin@example.test' }
  })));
  let shouldFail = true;
  let sentPayload;
  let saved = [];
  const tables = {
    departments: [{ id: 'ops', name: 'Operations' }],
    employee_profiles: [{ id: 'person', user_id: 'test-admin', full_name: 'Test Admin', email: 'admin@example.test', department_id: 'ops', employee_code: 'T1', title: 'Admin', yearly_vacation_days: 21, remaining_vacation_days: 21 }],
    user_roles: [{ user_id: 'test-admin', role: 'admin' }],
    shift_statuses: ['morning', 'midday', 'night', 'weekend'].map(id => ({ id, label: id, kind: id === 'weekend' ? 'off' : 'working', color: '#999999' }))
  };
  await page.route(`${url}/rest/v1/**`, async route => {
    const path = new URL(route.request().url()).pathname.split('/').at(-1);
    if (path === 'save_rotation_drafts') {
      sentPayload = route.request().postDataJSON();
      if (shouldFail) return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'Test save rejected' }) });
      saved = [{ id: 'saved', profile_id: sentPayload.p_changes[0].profileId, effective_start: sentPayload.p_changes[0].effectiveStart, pattern: sentPayload.p_changes[0].pattern }];
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ rotations: saved, lead_rotations: [], reset_profile_ids: [] }) });
    }
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(path === 'rotation_versions' ? saved : tables[path] || []) });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Rotations', exact: true }).click();
  await page.locator('.rotation-cell[data-weekday="0"] .rotation-cell-open').click();
  await page.locator('[data-pattern-day="0"][data-pattern-status="night"]').click();
  await commit(page);
  await expect(page.locator('.app-notice.error')).toContainText('Test save rejected');
  expect(saved).toEqual([]);
  await expect(page.locator('.rotation-cell[data-weekday="0"] .shift-label')).toHaveText('night');
  expect(sentPayload.p_department_id).toBe('ops');
  expect(sentPayload.p_changes[0].pattern[0]).toBe('night');
  expect(sentPayload.p_changes[0].leadDays).toEqual(Array(7).fill(false));
  await page.locator('#dismiss-notice').click();
  shouldFail = false;
  await commit(page);
  await expect(page.locator('.app-notice.success')).toContainText('Saved');
  await page.reload();
  await page.getByRole('button', { name: 'Rotations', exact: true }).click();
  await expect(page.locator('.rotation-cell[data-weekday="0"] .shift-label')).toHaveText('night');
});
