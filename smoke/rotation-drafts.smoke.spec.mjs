import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.route('**/runtime-config.js', route => route.fulfill({ contentType: 'text/javascript', body: 'window.__SPORT360_CONFIG__ = {demoMode:true};' }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Rotations', exact: true }).click();
});
async function state(page) {
  return page.evaluate(async () => JSON.parse(localStorage.getItem('sport360-scheduler-state')) || (await import('/assets/data.js')).seedState);
}
function cell(page, id, day = 0) { return page.locator(`.rotation-cell[data-profile-id="${id}"][data-weekday="${day}"]`); }
async function edit(page, id, day, status) {
  await cell(page, id, day).locator('.rotation-cell-open').click();
  await page.locator(`[data-pattern-day="${day}"][data-pattern-status="${status}"]`).click();
}
async function done(page) { await page.locator('#rotation-done').click(); await expect(page.locator('.drawer')).toHaveCount(0); }
async function save(page) { await page.locator('#save-rotation-edit').click(); await expect(page.locator('.app-notice.success')).toContainText('Saved'); }

test('Lead previews before save, changed person is marked, and unchanged state remains stored', async ({ page }) => {
  const before = await state(page);
  await expect(page.locator('#save-rotation-edit')).toBeDisabled();
  await edit(page, 'emp-001', 0, 'lead');
  await expect(cell(page, 'emp-001').locator('.shift-label')).toHaveText('Lead');
  await expect(page.locator('[data-rotation-person="emp-001"] .rotation-dirty-marker')).toHaveText(' Edited');
  expect(await state(page)).toEqual(before);
  await done(page);
  await page.getByRole('button', { name: 'Scheduler', exact: true }).click();
  await page.getByRole('button', { name: 'Rotations', exact: true }).click();
  await page.reload(); await page.getByRole('button', { name: 'Rotations', exact: true }).click();
  await expect(cell(page, 'emp-001').locator('.shift-label')).toHaveText('Lead');
  await expect(page.locator('#save-rotation-edit')).toContainText('(1)');
  await save(page);
  await expect(page.locator('.rotation-dirty-marker')).toHaveCount(0);
  await expect(page.locator('#save-rotation-edit')).toBeDisabled();
});

test('page date follows changed people while personal dates win and untouched people stay intact', async ({ page }) => {
  const before = await state(page);
  await page.locator('#rotation-edit-effective-start').fill('2099-01-01');
  await edit(page, 'emp-001', 0, 'midday'); await done(page);
  await edit(page, 'emp-002', 1, 'night');
  await page.locator('#rotation-form input[name="effectiveStart"]').fill('2099-02-01'); await done(page);
  await page.locator('#rotation-edit-effective-start').fill('2099-01-15');
  await expect(page.locator('#save-rotation-edit')).toContainText('(2)');
  await expect(page.locator('[data-rotation-person="emp-001"]')).toContainText('2099-01-15');
  await expect(page.locator('[data-rotation-person="emp-002"]')).toContainText('2099-02-01');
  await save(page);
  const after = await state(page);
  expect(after.rotationVersions.find(r => r.profileId === 'emp-001' && r.effectiveStart === '2099-01-15').pattern[0]).toBe('midday');
  expect(after.rotationVersions.find(r => r.profileId === 'emp-002' && r.effectiveStart === '2099-02-01').pattern[1]).toBe('night');
  expect(after.rotationVersions.filter(r => r.profileId === 'emp-003')).toEqual(before.rotationVersions.filter(r => r.profileId === 'emp-003'));
  for (const old of before.rotationVersions) expect(after.rotationVersions.find(r => r.id === old.id)).toEqual(old);
  expect(after.scheduleOverrides).toEqual(before.scheduleOverrides);
  expect(after.vacationRequests).toEqual(before.vacationRequests);
});

test('undo one person, reverting a shift, using page date, and discard all write nothing', async ({ page }) => {
  const before = await state(page);
  await edit(page, 'emp-001', 0, 'midday');
  await page.locator('[data-pattern-day="0"][data-pattern-status="morning"]').click();
  await expect(page.locator('.rotation-dirty-marker')).toHaveCount(0);
  await page.locator('[data-pattern-day="0"][data-pattern-status="midday"]').click();
  await page.locator('#rotation-form input[name="effectiveStart"]').fill('2099-01-01');
  await page.locator('#use-page-rotation-date').click();
  await expect(page.locator('.rotation-date-source')).toHaveText('Page date');
  await page.locator('#discard-person-rotation').click();
  await expect(page.locator('.rotation-dirty-marker')).toHaveCount(0);
  await edit(page, 'emp-002', 0, 'night'); await done(page);
  await page.locator('#discard-rotation-changes').click();
  await expect(page.locator('#save-rotation-edit')).toBeDisabled();
  expect(await state(page)).toEqual(before);
});

test('a new Lead choice removes the earlier unsaved choice without resaving the reverted person', async ({ page }) => {
  await edit(page, 'emp-001', 0, 'lead'); await done(page);
  await edit(page, 'emp-003', 0, 'lead'); await done(page);
  await expect(cell(page, 'emp-003').locator('.shift-label')).toHaveText('Lead');
  await expect(cell(page, 'emp-001').locator('.shift-label')).toHaveText('Morning');
  await expect(page.locator('#save-rotation-edit')).toContainText('(1)');
  await save(page);
});

test('correcting a saved date moves the selected version instead of duplicating it', async ({ page }) => {
  const before = await state(page);
  const source = before.rotationVersions.find(r => r.profileId === 'emp-001');
  await cell(page, 'emp-001').locator('.rotation-cell-open').click();
  await page.locator('.rotation-versions summary').click();
  await page.locator(`[data-correct-rotation-date="${source.id}"]`).click();
  await page.locator('#rotation-form input[name="effectiveStart"]').fill('2099-01-01');
  await done(page); await save(page);
  const after = await state(page);
  expect(after.rotationVersions).toHaveLength(before.rotationVersions.length);
  expect(after.rotationVersions.find(r => r.id === source.id)).toEqual({ ...source, effectiveStart: '2099-01-01' });
  expect(after.rotationVersions.filter(r => r.profileId !== 'emp-001')).toEqual(before.rotationVersions.filter(r => r.profileId !== 'emp-001'));
});

test('future blank Lead versions do not mask Lead on an earlier displayed rotation', async ({ page }) => {
  await page.evaluate(async () => {
    const data = structuredClone((await import('/assets/data.js')).seedState);
    data.departmentLeadRotations[0].pattern[0] = 'emp-001';
    data.departmentLeadRotations.push({ id: 'future-leads', departmentId: 'ops', effectiveStart: '2099-01-01', pattern: Array(7).fill('') });
    localStorage.setItem('sport360-scheduler-state', JSON.stringify(data));
  });
  await page.reload(); await page.getByRole('button', { name: 'Rotations', exact: true }).click();
  await expect(cell(page, 'emp-001').locator('.shift-label')).toHaveText('Lead');
});

test('date correction refuses a collision and lets the Admin recover without losing other versions', async ({ page }) => {
  await page.evaluate(async () => {
    const data = structuredClone((await import('/assets/data.js')).seedState);
    data.rotationVersions.push({ id: 'future', profileId: 'emp-001', effectiveStart: '2099-01-01', pattern: Array(7).fill('night') });
    localStorage.setItem('sport360-scheduler-state', JSON.stringify(data));
  });
  await page.reload(); await page.getByRole('button', { name: 'Rotations', exact: true }).click();
  const before = await state(page);
  const source = before.rotationVersions.find(row => row.id === 'rot-001');
  await cell(page, 'emp-001').locator('.rotation-cell-open').click();
  await page.locator('.rotation-versions summary').click();
  await page.locator(`[data-correct-rotation-date="${source.id}"]`).click();
  await page.locator('#rotation-form input[name="effectiveStart"]').fill('2099-01-01');
  await expect(page.locator('.app-notice.error')).toContainText('already exists');
  expect((await state(page)).rotationVersions).toEqual(before.rotationVersions);
  await page.locator('#dismiss-notice').click();
  await page.locator('#rotation-form input[name="effectiveStart"]').fill('2099-02-01');
  await done(page); await save(page);
  const after = await state(page);
  expect(after.rotationVersions).toHaveLength(before.rotationVersions.length);
  expect(after.rotationVersions.find(row => row.id === 'future')).toEqual(before.rotationVersions.find(row => row.id === 'future'));
});
