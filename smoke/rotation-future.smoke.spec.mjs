import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.route('**/runtime-config.js', route => route.fulfill({ contentType:'text/javascript', body:'window.__SPORT360_CONFIG__={demoMode:true};' }));
  await page.goto('/');
  await page.evaluate(async () => {
    const state = structuredClone((await import('/assets/data.js')).seedState);
    state.rotationVersions.push({ id:'later-person', profileId:'emp-001', effectiveStart:'2026-11-08', pattern:Array(7).fill('night') });
    state.departmentLeadRotations.push({ id:'blank-later', departmentId:'ops', effectiveStart:'2026-11-08', pattern:Array(7).fill('') });
    localStorage.setItem('sport360-scheduler-state', JSON.stringify(state));
  });
  await page.reload(); await page.getByRole('button', { name:'Rotations', exact:true }).click();
});
async function stage(page) {
  await page.locator('#rotation-edit-effective-start').fill('2026-11-01');
  await page.locator('.rotation-cell[data-profile-id="emp-001"][data-weekday="0"] .rotation-cell-open').click();
  await page.locator('[data-pattern-day="0"][data-pattern-status="lead"]').click();
  await page.locator('#rotation-done').click(); await expect(page.locator('.drawer')).toHaveCount(0);
  await page.locator('#save-rotation-edit').click();
  await expect(page.getByRole('heading', { name:'Review later versions', exact:true })).toBeVisible();
  await expect(page.locator('.rotation-future-list')).toContainText('2026-11-08');
  await expect(page.locator('.rotation-future-list')).toContainText('Unassigned');
}
test('backdated save reviews the cutoff and Apply onward keeps Lead beyond the next week', async ({ page }) => {
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('sport360-scheduler-state')));
  await stage(page);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('sport360-scheduler-state')))).toEqual(before);
  await page.locator('#replace-later-rotations').click();
  await expect(page.locator('.app-notice.success')).toContainText('Saved');
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('sport360-scheduler-state')));
  expect(after.rotationVersions.some(row => row.id === 'later-person')).toBe(false);
  expect(after.departmentLeadRotations.find(row => row.id === 'blank-later').pattern[0]).toBe('emp-001');
  expect(after.rotationVersions.filter(row => row.profileId !== 'emp-001')).toEqual(before.rotationVersions.filter(row => row.profileId !== 'emp-001'));
  expect(after.scheduleOverrides).toEqual(before.scheduleOverrides);
  await page.reload(); await page.getByRole('button', { name:'Scheduler', exact:true }).click();
  await page.locator('#schedule-start-date').fill('2026-11-01');
  for (const date of ['2026-11-02','2026-11-09']) await expect(page.locator(`.shift-cell[data-profile-id="emp-001"][data-date="${date}"] .shift-label`)).toHaveText('Lead');
});
test('keeping later versions is explicit and reviewing edits writes nothing', async ({ page }) => {
  await stage(page);
  await page.locator('#review-rotation-edits').click(); await expect(page.locator('.drawer')).toHaveCount(0);
  await expect(page.locator('.rotation-dirty-marker')).toHaveCount(1);
  await page.locator('#save-rotation-edit').click(); await page.locator('#keep-later-rotations').click();
  await expect(page.locator('.app-notice.success')).toContainText('Later versions kept');
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('sport360-scheduler-state')));
  expect(after.rotationVersions.some(row => row.id === 'later-person')).toBe(true);
  expect(after.departmentLeadRotations.find(row => row.id === 'blank-later').pattern).toEqual(Array(7).fill(''));
});
test('week bands align with slightly wider week gaps at every Scheduler zoom', async ({ page }) => {
  await page.getByRole('button', { name:'Scheduler', exact:true }).click();
  await page.locator('#schedule-start-date').fill('2026-11-01');
  for (const range of [14,30,7]) {
    if (range === 30) await page.locator('#zoom-out-range').click();
    if (range === 7) { await page.locator('#zoom-in-range').click(); await page.locator('#zoom-in-range').click(); }
    const geometry = await page.evaluate(() => {
      const box = date => document.querySelector(`.date-head[data-date="${date}"]`).getBoundingClientRect();
      const sunday=box('2026-11-01'), monday=box('2026-11-02'), tuesday=box('2026-11-03'), wednesday=box('2026-11-04');
      return { weekGap:monday.left-sunday.right, dayGap:wednesday.left-tuesday.right,
        alignment:Math.abs(document.querySelector('.week-band.week-group-start').getBoundingClientRect().left-monday.left) };
    });
    expect(geometry.weekGap-geometry.dayGap).toBeGreaterThanOrEqual(11);
    expect(geometry.weekGap).toBeLessThanOrEqual(20);
    expect(geometry.alignment).toBeLessThan(1);
  }
});
