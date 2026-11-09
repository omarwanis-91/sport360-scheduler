import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.route('**/runtime-config.js', route => route.fulfill({ contentType:'text/javascript', body:'window.__SPORT360_CONFIG__={demoMode:true};' }));
  await page.clock.install({ time:new Date('2026-12-31T21:58:00Z') });
  await page.goto('/');
  await page.evaluate(async () => {
    const s=structuredClone((await import('/assets/data.js')).seedState);
    const p=s.profiles.find(p=>p.id==='emp-003');p.yearlyVacationDays=15;p.remainingVacationDays=5;
    s.rotationVersions.find(r=>r.profileId===p.id).pattern=Array(7).fill('morning');
    localStorage.setItem('sport360-scheduler-state',JSON.stringify(s));
  });
  await page.reload();
});
const state=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('sport360-scheduler-state')));
async function person(page) {
  await page.getByRole('button',{name:'Team',exact:true}).click();
  await page.locator('.hierarchy-person[data-profile-id="emp-003"]').click();
}
test('open app renews at Cairo New Year and preserves requests, shifts and the previous balance',async({page})=>{
  await page.locator('#department-select').selectOption('support');
  const before=await state(page);
  await page.clock.setSystemTime(new Date('2026-12-31T22:00:00Z'));
  await page.clock.runFor(61_000);
  await expect.poll(async()=>(await state(page)).profiles.find(p=>p.id==='emp-003').annualBalanceYear).toBe(2027);
  const after=await state(page);
  await expect(page.locator('#department-select')).toHaveValue('support');
  expect(after.profiles.find(p=>p.id==='emp-003').remainingVacationDays).toBe(15);
  expect(after.annualBalances.find(b=>b.profileId==='emp-003'&&b.year===2026).remaining).toBe(5);
  for(const key of ['vacationRequests','rotationVersions','scheduleOverrides']) expect(after[key]).toEqual(before[key]);
  await page.reload();await person(page);
  await expect(page.locator('.drawer')).toContainText('15 / 15');
  expect((await state(page)).auditLog.filter(a=>a.action==='annual.year_renewed'&&a.entityId==='emp-003')).toHaveLength(1);
  await page.locator('#close-drawer').click();await page.getByRole('button',{name:'Activity',exact:true}).click();
  await page.locator('[data-activity-filter="vacation"]').click();
  await expect(page.locator('.activity-item').filter({hasText:'Karim Adel'})).toContainText('Annual renewed');
  await expect(page.locator('.activity-item').filter({hasText:'Karim Adel'})).toContainText('2027: 15/15 Annual days');
});
test('a balance form opened before January cannot overwrite the renewed balance',async({page})=>{
  await person(page);await page.getByRole('button',{name:'Edit Profile',exact:true}).click();
  await page.getByLabel('Annual days left',{exact:true}).fill('3');
  await page.clock.setSystemTime(new Date('2026-12-31T22:00:00Z'));
  await page.getByRole('button',{name:'Save Profile',exact:true}).click();
  await expect(page.locator('.app-notice.error')).toContainText('Annual balance changed');
  expect((await state(page)).profiles.find(p=>p.id==='emp-003').remainingVacationDays).toBe(5);
  await page.reload();await person(page);
  await expect(page.locator('.drawer')).toContainText('15 / 15');
});
test('approval preview and saved deductions split December and January, then preserve advance leave on renewal',async({page})=>{
  await page.evaluate(()=>{
    const s=JSON.parse(localStorage.getItem('sport360-scheduler-state'));
    s.vacationRequests=[{id:'year-request',profileId:'emp-003',startDate:'2026-12-31',endDate:'2027-01-01',status:'pending',reason:'Year boundary',deductedDays:0}];
    localStorage.setItem('sport360-scheduler-state',JSON.stringify(s));
  });await page.reload();
  await page.getByRole('button',{name:'Requests',exact:true}).click();await page.locator('[data-request-id="year-request"]').click();
  await expect(page.locator('.approval-balance')).toHaveCount(2);
  await expect(page.locator('.approval-balance').nth(0)).toContainText('2026 Annual balance: 5');
  await expect(page.locator('.approval-balance').nth(1)).toContainText('2027 Annual balance: 15');
  for (const width of [375,768,1024,1280,1920]) {
    await page.setViewportSize({width,height:900});
    const overflow=await page.locator('.drawer').evaluate(el=>Math.max(el.scrollWidth-el.clientWidth,el.getBoundingClientRect().right-innerWidth));
    expect(overflow).toBeLessThanOrEqual(1);
    if (width===1280) await page.screenshot({path:'test-results/annual-year-request.png',fullPage:true});
  }
  await page.getByRole('button',{name:'Approve & Deduct',exact:true}).click();
  const approved=await state(page),p=approved.profiles.find(p=>p.id==='emp-003');
  expect(p.remainingVacationDays).toBe(4);expect(approved.vacationRequests[0].deductedDaysByYear).toEqual({2026:1,2027:1});
  await page.clock.setSystemTime(new Date('2026-12-31T22:00:00Z'));await page.reload();
  const renewed=await state(page);expect(renewed.profiles.find(p=>p.id==='emp-003').remainingVacationDays).toBe(14);
  expect(renewed.vacationRequests).toEqual(approved.vacationRequests);expect(renewed.scheduleOverrides).toEqual(approved.scheduleOverrides);
});

test('remote profile saves send the original balance, preserve stored values on rejection, and never fall back to unsafe writes',async({page})=>{
  const url='https://annual-test.supabase.co';let saved=5,payload,fail=true;const writes=[];
  await page.route('**/runtime-config.js',r=>r.fulfill({contentType:'text/javascript',body:`window.__SPORT360_CONFIG__=${JSON.stringify({supabaseUrl:url,supabaseAnonKey:'test-key',demoMode:false})};`}));
  await page.evaluate(()=>localStorage.setItem('sport360-supabase-session',JSON.stringify({access_token:'test-access',refresh_token:'test-refresh',expires_at:Date.now()+3600000,user:{id:'admin-user',email:'admin@test'}})));
  await page.route(`${url}/rest/v1/**`,async r=>{
    const name=new URL(r.request().url()).pathname.split('/').at(-1);
    if (r.request().method()!=='GET') writes.push(name);
    if (name==='save_admin_profile_annual') {
      payload=r.request().postDataJSON();
      if(fail)return r.fulfill({status:409,contentType:'application/json',body:JSON.stringify({message:'Annual balance changed. Refresh before editing so approved leave is preserved'})});
      saved=payload.p_remaining_vacation_days;
    }
    const tables={departments:[{id:'ops',name:'Operations'}],employee_profiles:[{id:'a',user_id:'admin-user',department_id:'ops',employee_code:'A',full_name:'Person A',title:'Editor',email:'admin@test',yearly_vacation_days:15,remaining_vacation_days:saved,annual_balance_year:2026}],user_roles:[{user_id:'admin-user',role:'admin'}],annual_balance_years:[{profile_id:'a',balance_year:2026,allowance_days:15,remaining_days:saved,source:'opening'}]};
    return r.fulfill({contentType:'application/json',body:JSON.stringify(tables[name]||[])});
  });await page.reload();
  await page.getByRole('button',{name:'Team',exact:true}).click();await page.locator('.hierarchy-person[data-profile-id="a"]').click();
  await page.getByRole('button',{name:'Edit Profile',exact:true}).click();
  await page.getByLabel('Annual days left',{exact:true}).fill('3');await page.getByRole('button',{name:'Save Profile',exact:true}).click();
  await expect(page.locator('.app-notice.error')).toContainText('Annual balance changed');
  expect(saved).toBe(5);expect(payload.p_expected_balance_year).toBe(2026);expect(payload.p_expected_allowance).toBe(15);expect(payload.p_expected_remaining).toBe(5);expect(payload.p_remaining_vacation_days).toBe(3);
  await expect(page.getByLabel('Annual days left',{exact:true})).toHaveValue('5');fail=false;
  await page.locator('#dismiss-notice').click();
  await page.getByLabel('Annual days left',{exact:true}).fill('3');
  await page.getByRole('button',{name:'Save Profile',exact:true}).click();await expect(page.locator('.app-notice.success')).toContainText('Profile saved');
  await page.reload();await page.getByRole('button',{name:'Team',exact:true}).click();await page.locator('.hierarchy-person[data-profile-id="a"]').click();
  await expect(page.locator('.drawer')).toContainText('3 / 15');
  expect(writes.filter(name=>!['claim_profile_for_current_user','refresh_annual_balances','save_admin_profile_annual','audit_log','list_profile_onboarding'].includes(name))).toEqual([]);
});
