import { test, expect } from '@playwright/test';

test.beforeEach(async({page})=>{
  await page.route('**/runtime-config.js',r=>r.fulfill({contentType:'text/javascript',body:'window.__SPORT360_CONFIG__={demoMode:true};'}));
  await page.clock.install({time:new Date('2026-11-10T12:00:00Z')});
  await page.goto('/');
  await page.evaluate(async()=>{
    const s=structuredClone((await import('/assets/data.js')).seedState);
    s.departments=[{id:'unit',name:'Video Unit'},{id:'ops',name:'Video Edit',parentDepartmentId:'unit'},{id:'support',name:'Motion Graphics',parentDepartmentId:'unit'}];
    s.profiles[1].seniorityLevel='manager';
    s.profiles[2].yearlyVacationDays=15;s.profiles[2].remainingVacationDays=5;
    Object.assign(s.profiles[4],{departmentId:'ops',departmentIds:['ops','support']});
    localStorage.setItem('sport360-scheduler-state',JSON.stringify(s));
  });await page.reload();
});
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('sport360-scheduler-state')));
async function edit(page,id='emp-003',button='Edit Profile') {
  await page.getByRole('button',{name:'Team',exact:true}).click();
  await page.locator(`.hierarchy-person[data-profile-id="${id}"]`).click();
  await page.getByRole('button',{name:button,exact:true}).click();
}

test('profile modal blocks the background, traps focus and fits five viewport widths',async({page})=>{
  await edit(page);
  const modal=page.locator('.profile-editor-modal');
  await expect(modal).toHaveAttribute('aria-modal','true');
  await expect(page.locator('.workspace')).toHaveAttribute('inert','');
  await expect(modal.getByRole('heading',{name:'Yearly allowance',exact:true})).toBeVisible();
  await expect(modal.getByRole('heading',{name:'2026 balance',exact:true})).toBeAttached();
  await expect(modal.locator('[name="employeeId"],[name="title"]')).toHaveCount(0);
  await expect(modal.getByRole('checkbox')).toHaveCount(2);
  await expect(modal).not.toContainText('Video Unit /');
  await page.getByRole('button',{name:'Save Profile',exact:true}).focus();await page.keyboard.press('Tab');
  await expect(page.locator('#close-drawer')).toBeFocused();
  await page.clock.runFor(400);
  for(const width of [375,768,1024,1280,1920]) {
    await page.setViewportSize({width,height:900});
    const box=await modal.evaluate(el=>({left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right,overflow:el.scrollWidth-el.clientWidth}));
    expect(box.left).toBeGreaterThanOrEqual(10);expect(box.right).toBeLessThanOrEqual(width-9);expect(box.overflow).toBeLessThanOrEqual(1);
    await expect(page.getByRole('button',{name:'Save Profile',exact:true})).toBeInViewport();
    await expect(modal).toHaveCSS('opacity','1');
    expect(await modal.evaluate(el=>el.contains(document.elementFromPoint(innerWidth/2,innerHeight/2)))).toBe(true);
    if(width===1280||width===375)await page.screenshot({path:`test-results/profile-modal-${width}.png`});
  }
  await page.getByLabel('Annual days left',{exact:true}).scrollIntoViewIfNeeded();
  await expect(page.getByLabel('Annual days left',{exact:true})).toBeInViewport();
  await expect(page.getByLabel('Annual days left',{exact:true})).toHaveCSS('font-size','32px');
  await page.screenshot({path:'test-results/profile-modal-balances.png',animations:'disabled'});
  await page.keyboard.press('Escape');await expect(modal).toHaveCount(0);
  await expect(page.locator('.workspace')).not.toHaveAttribute('inert','');
});

test('all nine derived titles preview and save without changing identity or operational history',async({page})=>{
  await edit(page);const before=await stored(page);
  const cases=[['ops','artist','Video Editor'],['ops','lead','Lead Video Editor'],['ops','manager','Head of Video Team'],['support','artist','Motion Graphics'],['support','lead','Lead Motion Graphics'],['support','manager','Head of Motion Graphics'],['both','artist','Hybrid Artist'],['both','lead','Lead Hybrid'],['both','manager','Head of Video Unit']];
  for(const [team,position,title] of cases) {
    await page.locator('[name="departmentMembership"][value="ops"]').setChecked(team!=='support');
    await page.locator('[name="departmentMembership"][value="support"]').setChecked(team!=='ops');
    await page.getByRole('combobox',{name:'Position',exact:true}).selectOption(position);
    await expect(page.locator('#profile-title-preview')).toHaveText(title);
  }
  await page.getByRole('button',{name:'Save Profile',exact:true}).click();
  const after=await stored(page),p=after.profiles.find(p=>p.id==='emp-003');
  expect(p.title).toBe('Head of Video Unit');expect(p.departmentIds).toEqual(['ops','support']);
  expect(p.employeeId).toBe(before.profiles[2].employeeId);expect(p.remainingVacationDays).toBe(5);expect(p.yearlyVacationDays).toBe(15);
  for(const key of ['rotationVersions','scheduleOverrides','vacationRequests','departmentLeadRotations'])expect(after[key]).toEqual(before[key]);
  await page.reload();await edit(page);await expect(page.locator('#profile-title-preview')).toHaveText('Head of Video Unit');
});

test('only Manager plus Lead can edit team structure, with other identity and annual fields locked',async({page})=>{
  await page.locator('#user-switcher').selectOption('user-lead');await edit(page,'emp-003','Edit Team');
  await expect(page.getByRole('combobox',{name:'Position',exact:true})).toBeEnabled();
  await expect(page.getByRole('checkbox',{name:'Video Edit',exact:true})).toBeEnabled();
  await expect(page.getByRole('checkbox',{name:'Motion Graphics',exact:true})).toHaveCount(0);
  for(const name of ['Name','Email','Annual allowance','Annual days left'])await expect(page.getByLabel(name,{exact:true})).toBeDisabled();
  await expect(page.locator('[name="role"]')).toHaveCount(0);
  await page.getByRole('combobox',{name:'Position',exact:true}).selectOption('lead');await page.getByRole('button',{name:'Save Profile',exact:true}).click();
  expect((await stored(page)).profiles[2].title).toBe('Lead Video Editor');
  await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('sport360-scheduler-state'));s.profiles[1].seniorityLevel='lead';localStorage.setItem('sport360-scheduler-state',JSON.stringify(s));});await page.reload();
  await page.getByRole('button',{name:'Team',exact:true}).click();await expect(page.locator('[data-hierarchy-drag]')).toHaveCount(0);
  await page.locator('.hierarchy-person[data-profile-id="emp-003"]').click();await expect(page.getByRole('button',{name:'Edit Team',exact:true})).toHaveCount(0);
  await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('sport360-scheduler-state'));s.profiles[1].seniorityLevel='manager';s.users.find(u=>u.id==='user-lead').role='employee';localStorage.setItem('sport360-scheduler-state',JSON.stringify(s));});await page.reload();
  await page.getByRole('button',{name:'Team',exact:true}).click();await expect(page.locator('[data-hierarchy-drag]')).toHaveCount(0);
});

test('one-team manager cannot change hybrid position or erase hidden team membership',async({page})=>{
  await page.locator('#user-switcher').selectOption('user-lead');await edit(page,'emp-005','Edit Team');
  await expect(page.getByRole('combobox',{name:'Position',exact:true})).toBeDisabled();
  await page.getByRole('checkbox',{name:'Video Edit',exact:true}).uncheck();
  await page.getByRole('button',{name:'Save Profile',exact:true}).click();
  await expect(page.locator('.drawer')).toHaveCount(0);
  const p=(await stored(page)).profiles.find(p=>p.id==='emp-005');expect(p.departmentIds).toEqual(['support']);expect(p.title).toBe('Motion Graphics');
});

test('employee edits only own name and photo; containers are absent from person tags and assignment',async({page})=>{
  await page.getByRole('button',{name:'Team',exact:true}).click();
  expect(await page.locator('#team-department-select').evaluate(el=>el.clientWidth)).toBeLessThanOrEqual(250);
  expect(await page.locator('.hierarchy-person .hierarchy-team-tags').allTextContents()).not.toContain('Video Unit');
  await page.locator('#user-switcher').selectOption('user-employee');
  await page.getByRole('button',{name:'My Profile',exact:true}).click();await page.getByRole('button',{name:'Edit My Profile',exact:true}).click();
  await expect(page.getByLabel('Name',{exact:true})).toBeEnabled();await expect(page.getByLabel('Profile photo',{exact:true})).toBeEnabled();
  await expect(page.getByRole('combobox',{name:'Position',exact:true})).toBeDisabled();
  for(const name of ['Email','Annual allowance','Annual days left'])await expect(page.getByLabel(name,{exact:true})).toBeDisabled();
  await expect(page.getByRole('checkbox',{name:'Motion Graphics',exact:true})).toBeDisabled();
  await page.getByLabel('Name',{exact:true}).fill('Updated Artist');await page.getByRole('button',{name:'Save Profile',exact:true}).click();
  const p=(await stored(page)).profiles.find(p=>p.id==='emp-004');expect(p.name).toBe('Updated Artist');expect(p.title).toBe('Motion Graphics');expect(p.departmentIds).toEqual(['support']);
});

test('new profiles have automatic titles and internal IDs',async({page})=>{
  await page.getByRole('button',{name:'Team',exact:true}).click();await page.getByRole('button',{name:'New Profile',exact:true}).click();
  await page.getByLabel('Name',{exact:true}).fill('New Artist');await page.getByLabel('Email',{exact:true}).fill('artist@example.test');
  await page.getByRole('checkbox',{name:'Video Edit',exact:true}).check();
  await page.getByRole('button',{name:'Create Profile',exact:true}).click();
  const p=(await stored(page)).profiles.find(p=>p.name==='New Artist');expect(p.title).toBe('Video Editor');expect(p.employeeId).toMatch(/^SCH-/);expect(p.departmentIds).toEqual(['ops']);
});

test('remote Manager permissions and saves use guarded RPCs and preserve values on rejection',async({page})=>{
  const url='https://structure-test.supabase.co',writes=[];let fail=true,payload,level='artist';
  await page.route('**/runtime-config.js',r=>r.fulfill({contentType:'text/javascript',body:`window.__SPORT360_CONFIG__=${JSON.stringify({supabaseUrl:url,supabaseAnonKey:'test-key',demoMode:false})};`}));
  await page.evaluate(()=>localStorage.setItem('sport360-supabase-session',JSON.stringify({access_token:'test-access',refresh_token:'test-refresh',expires_at:Date.now()+3600000,user:{id:'manager-user',email:'manager@example.test'}})));
  const target=()=>({id:'target',full_name:'Test Artist',employee_code:'A',department_id:'ops',seniority_level:level,title:level==='lead'?'Lead Video Editor':'Video Editor',yearly_vacation_days:15,remaining_vacation_days:5,annual_balance_year:2026});
  await page.route(`${url}/rest/v1/**`,async r=>{
    const name=new URL(r.request().url()).pathname.split('/').at(-1);
    if(r.request().method()!=='GET')writes.push(name);
    if(name==='get_profile_structure_permissions')return r.fulfill({contentType:'application/json',body:JSON.stringify([{profile_id:'target',can_edit_teams:true,can_edit_position:true},{profile_id:'hybrid',can_edit_teams:true,can_edit_position:false}])});
    if(name==='save_managed_profile_structure'){
      payload=r.request().postDataJSON();
      if(fail)return r.fulfill({status:403,contentType:'application/json',body:JSON.stringify({message:'Team permission changed. Refresh and try again.'})});
      level=payload.p_seniority_level;
      return r.fulfill({contentType:'application/json',body:JSON.stringify({profile:target(),department_ids:['ops'],can_edit_teams:true,can_edit_position:true})});
    }
    const tables={departments:[{id:'ops',name:'Video Edit'}],employee_profiles:[{id:'manager',user_id:'manager-user',full_name:'Manager',department_id:'ops',seniority_level:'manager',title:'Head of Video Team',yearly_vacation_days:21,remaining_vacation_days:21},target(),{...target(),id:'hybrid',full_name:'Hybrid Person',title:'Hybrid Artist'}],user_roles:[{user_id:'manager-user',role:'lead'}]};
    return r.fulfill({contentType:'application/json',body:JSON.stringify(tables[name]||[])});
  });await page.reload();await edit(page,'target','Edit Team');
  await page.getByRole('combobox',{name:'Position',exact:true}).selectOption('lead');await page.getByRole('button',{name:'Save Profile',exact:true}).click();
  await expect(page.locator('.profile-editor-modal .app-notice.error')).toContainText('Team permission changed');
  expect(payload).toEqual({p_profile_id:'target',p_seniority_level:'lead',p_department_ids:['ops'],p_full_name:null,p_photo_url:null});
  await page.getByRole('button',{name:'Cancel',exact:true}).click();await page.locator('.hierarchy-person[data-profile-id="target"]').click();await expect(page.locator('.drawer')).toContainText('Video Editor');
  await page.getByRole('button',{name:'Edit Team',exact:true}).click();fail=false;
  await page.getByRole('combobox',{name:'Position',exact:true}).selectOption('lead');await page.getByRole('button',{name:'Save Profile',exact:true}).click();
  await expect(page.locator('.drawer')).toContainText('Lead Video Editor');
  await page.locator('#close-drawer').click();await edit(page,'hybrid','Edit Team');
  await expect(page.getByRole('combobox',{name:'Position',exact:true})).toBeDisabled();await expect(page.locator('#profile-title-preview')).toHaveText('Hybrid Artist');
  expect(writes.filter(n=>!['claim_profile_for_current_user','refresh_annual_balances','get_profile_structure_permissions','save_managed_profile_structure'].includes(n))).toEqual([]);
});
