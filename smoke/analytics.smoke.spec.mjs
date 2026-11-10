import {test,expect} from '@playwright/test';
import {seedState} from '../src/data.js';
const fixture=()=>{
  const s=structuredClone(seedState);
  s.rotationVersions=s.profiles.filter(p=>p.id!=='emp-005').map(p=>({id:p.id,profileId:p.id,effectiveStart:'2026-11-01',pattern:['morning','morning','midday','night','night','weekend','weekend']}));
  s.scheduleOverrides=[{id:'annual',profileId:'emp-003',date:'2026-11-10',statusId:'vacation'},
    {id:'sick',profileId:'emp-001',date:'2026-11-12',statusId:'sick'},
    {id:'ground',profileId:'emp-002',date:'2026-11-05',statusId:'ground'}];
  s.departmentLeads=[];s.departmentLeadRotations=[{id:'lead',departmentId:'ops',effectiveStart:'2026-11-01',pattern:['emp-002','emp-002','emp-002','emp-002','emp-002','','']}];
  s.vacationRequests=[{id:'pending',profileId:'emp-003',startDate:'2026-11-16',endDate:'2026-11-18',status:'pending',reason:'Test'}];
  return s;
};
test.beforeEach(async({page})=>{
  await page.route('**/runtime-config.js',r=>r.fulfill({contentType:'text/javascript',body:'window.__SPORT360_CONFIG__={demoMode:true};'}));
  await page.clock.install({time:new Date('2026-11-09T12:00:00Z')});
  await page.addInitScript(s=>{if(!localStorage.getItem('sport360-scheduler-state'))localStorage.setItem('sport360-scheduler-state',JSON.stringify(s));},fixture());
  await page.goto('/');
});
const open=async page=>{await page.getByRole('button',{name:'Analytics',exact:true}).click();await expect(page.locator('.analytics-dashboard')).toBeVisible();};
test('Admin sees accurate saved counts, unknown data, interactive charts, sortable rows and CSV without writes',async({page})=>{
  const before=await page.evaluate(()=>localStorage.getItem('sport360-scheduler-state'));
  await open(page);
  await expect(page.locator('.analytics-kpi').nth(0)).toContainText('82');
  await expect(page.locator('.analytics-kpi').nth(2)).toContainText('1 Annual · 1 Sick');
  await expect(page.locator('.analytics-kpi').nth(3)).toContainText('1');
  await expect(page.locator('.analytics-quality')).toContainText('80%');
  await expect(page.locator('.analytics-legend')).toContainText('Lead');
  await expect(page.getByRole('slider',{name:'Inspect date'})).toHaveCount(0);
  const point=page.locator('[data-analytics-point="1"]');await point.hover();
  const popup=page.getByRole('tooltip');await expect(popup).toBeVisible();await expect(popup).toContainText('2 Nov 2026');
  await expect(popup.locator('dl>div').filter({hasText:'Working'})).toContainText('4');
  await point.focus();await point.press('ArrowRight');await expect(popup).toContainText('3 Nov 2026');
  await page.keyboard.press('Escape');await expect(popup).toBeHidden();
  await page.getByText('View daily data',{exact:true}).click();await expect(page.locator('.analytics-data tbody tr')).toHaveCount(30);
  await page.getByRole('button',{name:'Work',exact:true}).click();await expect(page.locator('th[aria-sort="ascending"]').filter({hasText:'Work'})).toHaveCount(1);
  const download=page.waitForEvent('download');await page.locator('#analytics-export').click();expect((await download).suggestedFilename()).toBe('sport360-analytics-2026-11-01-2026-11-30.csv');
  expect(await page.evaluate(()=>localStorage.getItem('sport360-scheduler-state'))).toBe(before);
});
test('team, month, quarter and year controls recalculate; monthly chart navigates and refresh retains filters',async({page})=>{
  await open(page);await page.locator('#analytics-department').selectOption('ops');
  await expect(page.locator('.analytics-people tbody tr')).toHaveCount(3);
  await expect(page.locator('.analytics-quality')).toContainText('100%');
  await page.locator('#analytics-period').selectOption('quarter');await expect(page.locator('.topbar')).toContainText('Q4 · 2026');
  await page.locator('#analytics-period').selectOption('year');await expect(page.locator('.analytics-data tbody tr')).toHaveCount(365);
  await page.locator('[data-analytics-month="2026-10"]').click();await expect(page.locator('#analytics-month')).toHaveValue('10');
  await expect(page.locator('.analytics-staffing')).toContainText('No saved shifts');await expect(page.locator('.analytics-completeness')).toContainText('0%');
  await page.locator('#analytics-refresh').click();await expect(page.locator('.analytics-dashboard')).toBeVisible();await expect(page.locator('#analytics-month')).toHaveValue('10');
  await page.locator('#analytics-month').selectOption('01');await page.locator('#analytics-year').selectOption('2027');
  await expect(page.locator('.analytics-dashboard')).toBeVisible();await expect(page.locator('.analytics-monthly h2')).toContainText('2027');
});
test('readable reports use full-width people totals, dropdown dates and value-weighted diffuse glows',async({page})=>{
  await page.setViewportSize({width:1920,height:1080});await open(page);
  await expect(page.getByRole('combobox',{name:'Month',exact:true})).toHaveValue('11');
  await expect(page.getByRole('combobox',{name:'Year',exact:true})).toHaveValue('2026');
  await expect(page.locator('input[type="month"]')).toHaveCount(0);
  const values=await page.evaluate(()=>{
    const grid=document.querySelector('.analytics-grid'),people=document.querySelector('.analytics-people');
    return {body:Number.parseFloat(getComputedStyle(people.querySelector('tbody td')).fontSize),heading:Number.parseFloat(getComputedStyle(people.querySelector('h2')).fontSize),width:people.getBoundingClientRect().width/grid.getBoundingClientRect().width,
      workGlow:Number(document.querySelector('[data-mix-glow="morning"]').getAttribute('opacity')),groundGlow:Number(document.querySelector('[data-mix-glow="ground"]').getAttribute('opacity')),
      noWork:[...document.querySelectorAll('.analytics-work-halo path')].some(p=>Number(p.getAttribute('opacity'))===0)};
  });
  expect(values.body).toBeGreaterThanOrEqual(16);expect(values.heading).toBeGreaterThanOrEqual(18);expect(values.width).toBeGreaterThan(.95);
  expect(values.workGlow).toBeGreaterThan(values.groundGlow);expect(values.noWork).toBe(true);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.getByRole('button',{name:'Scheduler',exact:true}).click();await open(page);
  expect(await page.locator('.analytics-panel').first().evaluate(e=>getComputedStyle(e).animationName)).toBe('none');
});
test('point popups support taps, edge dates and direct Annual/Sick values',async({page})=>{
  await page.setViewportSize({width:1280,height:1000});await open(page);
  const point=page.locator('[data-analytics-point="11"]'),box=await point.boundingBox();
  for(const type of ['pointerdown','pointerup'])await point.dispatchEvent(type,{pointerType:'touch',clientX:box.x+box.width/2,clientY:box.y+box.height/2});
  const popup=page.getByRole('tooltip');await expect(popup).toBeVisible();await expect(popup).toContainText('12 Nov 2026');
  await page.locator('.analytics-line-wrap').dispatchEvent('pointerleave',{pointerType:'touch'});await page.waitForTimeout(250);await expect(popup).toBeVisible();
  await expect(popup.locator('dl>div').filter({hasText:'Sick'})).toContainText('1');
  const end=page.locator('[data-analytics-point="29"]');await end.focus();await end.press('End');await expect(popup).toContainText('30 Nov 2026');
  const tipBox=await popup.boundingBox(),panel=await page.locator('.analytics-staffing').boundingBox();
  expect(tipBox.x).toBeGreaterThanOrEqual(panel.x);expect(tipBox.x+tipBox.width).toBeLessThanOrEqual(panel.x+panel.width);
  const endBox=await end.boundingBox();expect(tipBox.x+tipBox.width).toBeLessThan(endBox.x);
  await page.screenshot({path:'test-results/analytics-point-popup.png'});
  await page.locator('.analytics-kpi').first().click();await expect(popup).toBeHidden();
});
test('Lead reads assigned team only; Employee has no nav and a forged Analytics click cannot expose cached Admin data',async({page})=>{
  await open(page);await page.locator('#user-switcher').selectOption('user-lead');await open(page);
  await expect(page.locator('#analytics-department option')).toHaveCount(2);
  await expect(page.locator('.analytics-people tbody tr')).toHaveCount(3);
  await expect(page.locator('.analytics-dashboard')).not.toContainText('Youssef Nabil');
  await page.locator('#user-switcher').selectOption('user-employee');await expect(page.getByRole('button',{name:'Analytics',exact:true})).toHaveCount(0);
  await page.locator('[data-view="scheduler"]').evaluate(el=>el.dataset.view='analytics');await page.locator('[data-view="analytics"]').click();
  await expect(page.locator('.workspace')).toContainText('You do not have access to Analytics.');
  await expect(page.locator('.analytics-dashboard,#analytics-export')).toHaveCount(0);
});
test('Admin Lead preview shows one direct team; Employee preview has no Analytics',async({page})=>{
  await page.getByRole('button',{name:'Settings',exact:true}).click();await page.locator('#role-preview-department').selectOption('ops');
  await page.locator('#role-preview-profile').selectOption('emp-002');await page.getByRole('button',{name:'Start Preview',exact:true}).click();
  await open(page);await expect(page.locator('#analytics-department option')).toHaveCount(1);await expect(page.locator('.analytics-people tbody tr')).toHaveCount(3);
  await page.locator('.role-preview-sidebar').getByRole('button',{name:'Exit Preview',exact:true}).click();
  await page.getByRole('button',{name:'Settings',exact:true}).click();await page.locator('#role-preview-role').selectOption('employee');
  await page.locator('#role-preview-profile').selectOption('emp-003');await page.getByRole('button',{name:'Start Preview',exact:true}).click();
  await expect(page.getByRole('button',{name:'Analytics',exact:true})).toHaveCount(0);
});
test('remote RPC errors stay inside Analytics and Retry succeeds; in-year filters reuse one protected snapshot',async({page})=>{
  const url='https://analytics-test.supabase.co';let fail=true,calls=0;const payloads=[];
  await page.route('**/runtime-config.js',r=>r.fulfill({contentType:'text/javascript',body:`window.__SPORT360_CONFIG__=${JSON.stringify({supabaseUrl:url,supabaseAnonKey:'test-key',demoMode:false})};`}));
  await page.evaluate(()=>localStorage.setItem('sport360-supabase-session',JSON.stringify({access_token:'test-access',refresh_token:'test-refresh',expires_at:Date.now()+3600000,user:{id:'admin-user',email:'admin@test'}})));
  const {scopedAnalyticsState}=await import('../src/analyticsLogic.mjs');const snapshot=scopedAnalyticsState(fixture(),{year:2026,role:'admin'});
  await page.route(`${url}/rest/v1/**`,async r=>{
    const name=new URL(r.request().url()).pathname.split('/').at(-1);
    if(name==='get_schedule_analytics') {
      calls++;payloads.push(r.request().postDataJSON());
      if(fail)return r.fulfill({status:404,contentType:'application/json',body:JSON.stringify({message:'Analytics setup unavailable'})});
      return r.fulfill({contentType:'application/json',body:JSON.stringify(snapshot)});
    }
    const tables={departments:[{id:'ops',name:'Operations'}],employee_profiles:[{id:'a',user_id:'admin-user',department_id:'ops',employee_code:'A',full_name:'Admin',title:'Admin',email:'admin@test',yearly_vacation_days:15,remaining_vacation_days:15,annual_balance_year:2026}],user_roles:[{user_id:'admin-user',role:'admin'}]};
    return r.fulfill({contentType:'application/json',body:JSON.stringify(tables[name]||[])});
  });
  await page.reload();await page.getByRole('button',{name:'Analytics',exact:true}).click();await expect(page.locator('.analytics-error')).toContainText('Analytics setup unavailable');
  fail=false;await page.getByRole('button',{name:'Retry',exact:true}).click();await expect(page.locator('.analytics-dashboard')).toBeVisible();
  await page.locator('#analytics-period').selectOption('year');await page.locator('[data-analytics-month="2026-10"]').click();expect(calls).toBe(2);
  expect(payloads[1]).toEqual({p_year:2026,p_department_id:null,p_direct_only:false});
});
test('late responses cannot replace the selected scope and Employee sends no Analytics request',async({page})=>{
  const url='https://analytics-race.supabase.co';let release;const waiting=new Promise(resolve=>release=resolve);let calls=0;const payloads=[];
  const {scopedAnalyticsState}=await import('../src/analyticsLogic.mjs');
  await page.route('**/runtime-config.js',r=>r.fulfill({contentType:'text/javascript',body:`window.__SPORT360_CONFIG__=${JSON.stringify({supabaseUrl:url,supabaseAnonKey:'test-key',demoMode:false})};`}));
  await page.evaluate(()=>localStorage.setItem('sport360-supabase-session',JSON.stringify({access_token:'test',refresh_token:'test',expires_at:Date.now()+3600000,user:{id:'admin-user',email:'admin@test'}})));
  await page.route(`${url}/rest/v1/**`,async r=>{
    const name=new URL(r.request().url()).pathname.split('/').at(-1);
    if(name==='get_schedule_analytics') {
      calls++;const params=r.request().postDataJSON();payloads.push(params);
      if(!params.p_department_id)await waiting;
      return r.fulfill({contentType:'application/json',body:JSON.stringify(scopedAnalyticsState(fixture(),{year:params.p_year,role:'admin',departmentId:params.p_department_id,directOnly:params.p_direct_only}))});
    }
    const tables={departments:[{id:'ops',name:'Operations'},{id:'support',name:'Customer Support'}],employee_profiles:[{id:'a',user_id:'admin-user',department_id:'ops',employee_code:'A',full_name:'Admin',title:'Admin',email:'admin@test',yearly_vacation_days:15,remaining_vacation_days:15,annual_balance_year:2026}],user_roles:[{user_id:'admin-user',role:'admin'}]};
    return r.fulfill({contentType:'application/json',body:JSON.stringify(tables[name]||[])});
  });
  await page.reload();await page.getByRole('button',{name:'Analytics',exact:true}).click();await expect(page.locator('.analytics-loading')).toBeVisible();
  await page.locator('#analytics-department').selectOption('ops');await expect(page.locator('.analytics-people tbody tr')).toHaveCount(3);
  const oldResponse=page.waitForResponse(r=>r.url().includes('get_schedule_analytics')&&r.request().postDataJSON().p_department_id===null);
  release();await oldResponse;await page.waitForTimeout(100);
  await expect(page.locator('.analytics-people tbody tr')).toHaveCount(3);await expect(page.locator('.analytics-dashboard')).not.toContainText('Youssef Nabil');
  await page.getByRole('button',{name:'Settings',exact:true}).click();await page.locator('#role-preview-role').selectOption('lead');
  await page.locator('#role-preview-department').selectOption('ops');await page.getByRole('button',{name:'Start Preview',exact:true}).click();await open(page);
  await expect(page.locator('#analytics-department option')).toHaveCount(1);expect(calls).toBe(3);
  expect(payloads[2]).toEqual({p_year:2026,p_department_id:'ops',p_direct_only:true});
  await page.locator('.role-preview-sidebar').getByRole('button',{name:'Exit Preview',exact:true}).click();
  await page.getByRole('button',{name:'Settings',exact:true}).click();await page.locator('#role-preview-role').selectOption('employee');
  await page.getByRole('button',{name:'Start Preview',exact:true}).click();
  await page.locator('[data-view="scheduler"]').evaluate(el=>el.dataset.view='analytics');await page.locator('[data-view="analytics"]').click();
  await expect(page.locator('.workspace')).toContainText('You do not have access to Analytics.');expect(calls).toBe(3);
});
for(const width of [375,768,1024,1280,1920])test(`Analytics viewport ${width}: no page overflow, readable cards and controls`,async({page})=>{
  await page.setViewportSize({width,height:1000});await open(page);
  await expect(page.locator('.analytics-kpi')).toHaveCount(4);await expect(page.getByRole('heading',{name:'Daily staffing',exact:true})).toBeVisible();
  const chart=await page.locator('.analytics-line').boundingBox();expect(chart.height).toBeGreaterThan(width<600?70:100);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:`test-results/analytics-${width}.png`,fullPage:true});
});
