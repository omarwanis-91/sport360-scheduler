import assert from 'node:assert/strict';
import { existsSync,readFileSync } from 'node:fs';
import { dirname,join,delimiter } from 'node:path';
import { pathToFileURL } from 'node:url';
process.on('uncaughtException',error=>{console.error(error.message,error.query||'',error.where||'');process.exit(1);});
const runtime=process.env.PATH.split(delimiter).map(bin=>join(dirname(bin),'@electric-sql/pglite')).find(root=>existsSync(join(root,'package.json')));
if(!runtime)throw new Error('Run npm run test:structure-db.');
const {PGlite}=await import(pathToFileURL(join(runtime,'dist/index.js')).href),db=new PGlite();
const file=p=>readFileSync(new URL(p,import.meta.url),'utf8'),id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const admin=id(1),manager=id(2),lead=id(3),artist=id(4),employeeManager=id(5),hybridManager=id(6);
const unit=id(10),edit=id(11),motion=id(12),outside=id(13);
const pa=id(21),pm=id(22),pl=id(23),pe=id(24),pem=id(25),phm=id(26),unassigned=id(27),hybrid=id(28),outsider=id(29);
await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
 create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.uid',true),'')::uuid $$;
 grant usage on schema auth to authenticated,anon;
 insert into auth.users values('${admin}','admin@test'),('${manager}','manager@test'),('${lead}','lead@test'),('${artist}','artist@test'),('${employeeManager}','employee-manager@test'),('${hybridManager}','hybrid-manager@test');
 set app.uid='${admin}';`);
await db.exec(file('../supabase/migrations/001_initial_scheduler_schema.sql').replace('create extension if not exists "pgcrypto";',''));
await db.exec(`alter table public.employee_profiles add column seniority_level text default 'artist',add column is_department_lead boolean default true;alter table public.employee_profiles alter column department_id drop not null;
 alter table public.departments add column parent_department_id uuid;
 create table public.employee_profile_departments(profile_id uuid references public.employee_profiles(id),department_id uuid references public.departments(id),created_at timestamptz default now(),primary key(profile_id,department_id));
 alter table public.employee_profile_departments enable row level security;
 create function public.current_profile_id() returns uuid language sql stable security definer set search_path=public as $$ select id from public.employee_profiles where user_id=auth.uid() $$;
 create function public.is_claimed_user() returns boolean language sql stable security definer set search_path=public as $$ select public.current_profile_id() is not null $$;
 create function public.apply_vacation_overrides(uuid,date,date,uuid) returns void language plpgsql as $$ begin return; end $$;
 insert into public.departments(id,name,parent_department_id) values('${unit}','Video Unit',null),('${edit}','Video Edit','${unit}'),('${motion}','Motion Graphics','${unit}'),('${outside}','Other',null);
 insert into public.user_roles(user_id,role) values('${admin}','admin'),('${manager}','lead'),('${lead}','lead'),('${artist}','employee'),('${employeeManager}','employee'),('${hybridManager}','lead');
 insert into public.employee_profiles(id,user_id,department_id,employee_code,email,full_name,title,seniority_level,yearly_vacation_days,remaining_vacation_days) values
 ('${pa}','${admin}','${edit}','A','admin@test','Admin','Manual Admin','manager',15,5),
 ('${pm}','${manager}','${edit}','M','manager@test','Manager','Manual Manager','manager',15,5),
 ('${pl}','${lead}','${edit}','L','lead@test','Lead','Manual Lead','lead',21,9),
 ('${pe}','${artist}','${edit}','E','artist@test','Artist','Manual Artist','artist',21,8),
 ('${pem}','${employeeManager}','${edit}','EM','employee-manager@test','Employee Manager','Manual Manager','manager',21,7),
 ('${phm}','${hybridManager}','${edit}','HM','hybrid-manager@test','Hybrid Manager','Manual Manager','manager',21,6),
 ('${unassigned}',null,null,'U','unassigned@test','Unassigned','Pending assignment','artist',21,4),
 ('${hybrid}',null,'${edit}','H','hybrid@test','Hybrid','Manual Hybrid','artist',21,3),
 ('${outsider}',null,'${outside}','O','outsider@test','Outside','Manual Outside','artist',21,2);
 insert into public.employee_profile_departments(profile_id,department_id) values('${phm}','${motion}'),('${hybrid}','${motion}'),('${pe}','${unit}');
 insert into public.rotation_versions(profile_id,effective_start,pattern) values('${pe}','2026-11-01',array_fill('morning'::text,array[7]));
 insert into public.schedule_overrides(profile_id,shift_date,status_id) values('${pe}','2026-11-03','sick');
 insert into public.vacation_requests(profile_id,start_date,end_date,status) values('${pe}','2026-11-10','2026-11-11','pending');`);
const boundaries=file('../supabase/migrations/027_strict_role_department_boundaries.sql');
await db.exec(boundaries.split('drop policy if exists "claimed users can read departments"')[0]);
await db.exec(boundaries.match(/create(?: or replace)? function public.update_own_profile\(\s*p_profile_id uuid,\s*p_full_name text,\s*p_photo_url text\s*\)[\s\S]+?\$\$;/)[0]);
await db.exec(file('../supabase/migrations/023_simplify_profile_hierarchy.sql').match(/create or replace function public.save_admin_profile\([\s\S]+?\$\$;/)[0]);
await db.exec(file('../supabase/migrations/033_annual_year_rollover.sql').replace(/-- BEGIN CRON INSTALL[\s\S]*?-- END CRON INSTALL/,''));
await db.exec(`grant usage on schema public to authenticated;grant select,insert,update,delete on all tables in schema public to authenticated;
 drop policy "profiles visible to authenticated" on public.employee_profiles;
 create policy "role scoped profiles read" on public.employee_profiles for select to authenticated using(public.current_user_can_read_profile(id));
 create policy "role scoped profile departments read" on public.employee_profile_departments for select to authenticated using(public.current_user_can_access_department(department_id) and public.current_user_can_read_profile(profile_id));
 create policy "admins manage profile departments" on public.employee_profile_departments for all to authenticated using(public.current_role()='admin') with check(public.current_role()='admin');`);
const rows=async(q,p=[])=>(await db.query(q,p)).rows;
const original=async()=>({rotations:await rows('select * from public.rotation_versions order by id'),overrides:await rows('select * from public.schedule_overrides order by id'),requests:await rows('select * from public.vacation_requests order by id'),balances:await rows('select profile_id,balance_year,allowance_days,remaining_days,source,created_at from public.annual_balance_years order by profile_id,balance_year')});
const before=await original();
await db.exec('begin');
await rows("insert into public.employee_profiles(id,department_id,employee_code,email,full_name,title) values($1,$2,'PF','preflight@test','Needs team choice','Old')",[id(90),unit]);
await assert.rejects(()=>db.exec(file('../supabase/migrations/035_team_profile_structure.sql')),/Container-only assignments need Admin review/);
await db.exec('rollback');
await db.exec(file('../supabase/migrations/035_team_profile_structure.sql'));
let checks=1;const equal=(a,b)=>{assert.deepEqual(a,b);checks++;};
let selectedRole='postgres';
async function inspect(q,p=[]) {await db.exec('reset role');try{return await rows(q,p);}finally{if(selectedRole!=='postgres')await db.exec(`set role ${selectedRole}`);}}
const profile=async(p=pe)=>(await inspect('select * from public.employee_profiles where id=$1',[p]))[0];
async function login(user,role='authenticated'){selectedRole=role;await db.exec(`reset role;set app.uid='${user||''}';set role ${role};`);}
async function structure(p,level,departments,name=null){return(await rows('select public.save_managed_profile_structure($1,$2,$3::uuid[],$4,null) result',[p,level,`{${departments.join(',')}}`,name]))[0].result;}
async function deny(fn,pattern){await assert.rejects(fn,pattern);checks++;}
equal(await original(),before);equal((await profile()).title,'Video Editor');equal((await profile(hybrid)).title,'Hybrid Artist');equal((await profile(phm)).title,'Head of Video Unit');
equal((await rows('select count(*)::int n from public.employee_profile_departments where department_id=$1',[unit]))[0].n,0);
equal((await rows(file('../supabase/audit/024_team_profile_structure_audit.sql'))).every(r=>r.passed),true);
await login(artist);await deny(()=>structure(pe,'manager',[edit]),/Only Admin or a Manager/);
await deny(()=>rows('select public.update_profile_hierarchy($1,$2)',[pe,'manager']),/Only Admin or a Manager/);
await deny(()=>rows('select public.add_profile_to_department($1,$2)',[pe,motion]),/Only Admin or a Manager/);
await login(lead);await deny(()=>structure(pe,'manager',[edit]),/Only Admin or a Manager/);
equal((await rows('select id from public.employee_profiles where id=$1',[unassigned])).length,0);
equal((await rows('update public.employee_profiles set seniority_level=$1 where id=$2 returning id',['manager',pl])).length,0);
await deny(()=>rows('select public.remove_profile_from_department($1,$2)',[pe,edit]),/Only Admin or a Manager/);
await login(employeeManager);await deny(()=>structure(pe,'manager',[edit]),/Only Admin or a Manager/);
await login(manager);equal((await structure(pe,'lead',[edit])).profile.title,'Lead Video Editor');
equal((await rows('select id from public.employee_profiles where id=$1',[unassigned])).length,1);
equal((await rows('select id from public.employee_profiles where id=$1',[outsider])).length,0);
const permissions=(await rows('select public.get_profile_structure_permissions() result'))[0].result;
equal(permissions.find(p=>p.profile_id===hybrid).can_edit_position,false);equal(permissions.some(p=>p.profile_id===outsider),false);
equal((await structure(pm,'manager',[edit],'Updated Manager')).profile.full_name,'Updated Manager');
await deny(()=>structure(outsider,'manager',[outside]),/Only Admin or a Manager/);
await deny(()=>structure(pe,'manager',[motion]),/own teams/);
await deny(()=>structure(hybrid,'manager',[edit]),/all of this person/);
await deny(()=>structure(pa,'artist',[edit]),/Only Admin or a Manager/);
await deny(()=>structure(pm,'manager',[]),/own team access/);
await deny(()=>structure(pe,'lead',[unit]),/containers/);
await deny(()=>structure(pe,'artist',[edit],'Forged name'),/profile owner/);
equal((await profile()).seniority_level,'lead');
await rows('select public.add_profile_to_department($1,$2)',[unassigned,edit]);equal((await profile(unassigned)).title,'Video Editor');
const hybridResult=await structure(hybrid,'artist',[]);equal(hybridResult.profile.title,'Motion Graphics');
equal(hybridResult.department_ids,[]);equal((await inspect('select public.profile_team_ids($1) ids',[hybrid]))[0].ids,[motion]);
await login(hybridManager);await rows('select public.add_profile_to_department($1,$2)',[hybrid,edit]);
equal((await structure(hybrid,'manager',[edit,motion])).profile.title,'Head of Video Unit');
await login(admin);
for(const [level,expected] of [['artist',['Video Editor','Motion Graphics','Hybrid Artist']],['lead',['Lead Video Editor','Lead Motion Graphics','Lead Hybrid']],['manager',['Head of Video Team','Head of Motion Graphics','Head of Video Unit']]]) {
  for(const [i,teams] of [[edit],[motion],[edit,motion]].entries())equal((await structure(pe,level,teams)).profile.title,expected[i]);
}
await deny(()=>rows('insert into public.employee_profile_departments(profile_id,department_id) values($1,$2)',[pe,unit]),/containers/);
await deny(()=>rows('update public.employee_profiles set department_id=$1 where id=$2',[unit,pe]),/containers/);
await rows('update public.employee_profiles set title=$1 where id=$2',['Manual override',pe]);equal((await profile()).title,'Head of Video Unit');
await deny(()=>rows('insert into public.departments(name,parent_department_id) values($1,$2)',['Invalid child',edit]),/Move people/);
equal((await rows('select is_container from public.departments where id=$1',[edit]))[0].is_container,false);
const p=await profile();await rows('select public.save_admin_profile_annual($1,$2,$3,$4,$5,$6,$7::uuid[],$8,$9,$10,$11,$12,$13,$14)',
  [pe,p.employee_code,p.email,p.full_name,'Forged title','artist',`{${edit}}`,p.photo_url,21,8,p.user_id,p.annual_balance_year,p.yearly_vacation_days,p.remaining_vacation_days]);
equal((await profile()).title,'Video Editor');equal((await profile()).employee_code,'E');
await deny(()=>rows('select public.save_admin_profile_annual($1,$2,$3,$4,$5,$6,$7::uuid[],$8,$9,$10,$11,$12,$13,$14)',
  [pe,p.employee_code,p.email,p.full_name,'x','artist',`{${edit}}`,null,21,7,p.user_id,p.annual_balance_year,99,8]),/Annual balance changed/);
await login(manager);await deny(()=>rows('select public.create_admin_team_profile($1,$2,$3,$4,$5::uuid[],null,21,21)',[id(80),'fake@test','New','artist',`{${edit}}`]),/Only Admins/);
await login(null);await deny(()=>structure(pe,'manager',[edit]),/Authentication required/);
await login(null,'anon');await deny(()=>structure(pe,'manager',[edit]),/permission denied/);
await db.exec('reset role');selectedRole='postgres';equal(await original(),before);
await login(admin);
await rows('select public.create_admin_team_profile($1,$2,$3,$4,$5::uuid[],null,18,7)',[id(80),'new@test','New Hybrid','lead',`{${edit},${motion}}`]);
const created=await profile(id(80));equal(created.title,'Lead Hybrid');equal(created.yearly_vacation_days,18);equal(created.remaining_vacation_days,7);assert.match(created.employee_code,/^SCH-/);checks++;
console.log(`${checks} team structure PostgreSQL checks passed.`);
const beforeCalendarChecks = checks;
await db.exec('reset role');
selectedRole = 'postgres';
await db.exec(file('../supabase/migrations/014_profile_seniority_and_lead_rotations.sql')
  .match(/create table if not exists public\.department_lead_rotation_versions \([\s\S]+?\n\);/i)[0]);
const annualGuard = file('../supabase/migrations/028_harden_annual_eligibility.sql');
await db.exec(annualGuard.slice(annualGuard.indexOf('create or replace function public.validate_vacation_request_eligibility'),
  annualGuard.indexOf('create or replace function public.decide_vacation_request')));
await db.exec(file('../supabase/migrations/034_department_analytics.sql'));
await db.exec(file('../supabase/migrations/036_low_days_and_public_holidays.sql'));
const at = async (days) => (await rows("select ((now() at time zone 'Africa/Cairo')::date + $1::int)::text as value", [days]))[0].value;
const [worked, holidayWork, overdueWork, today, replacement, closedDate, staffedDate, deadline, tooLate] =
  await Promise.all([-24, -23, -35, 0, 1, 2, 3, 6, 7].map(at));
const calendar = async () => (await rows('select public.get_low_day_calendar() value'))[0].value;
const saveHoliday = async (date, name, teamIds, off) =>
  (await rows('select public.save_public_holiday(null,$1,$2,$3::uuid[],$4) value', [date, name, teamIds, off]))[0].value;
const confirm = async (person, day, shift = 'night') =>
  (await rows('select public.confirm_low_day_work($1,$2,$3,$4) value', [person, day, shift, 'Confirmed work']))[0].value;
const book = async (credit, date) =>
  (await rows('select public.book_low_day($1,$2) value', [credit, date]))[0].value;
const eligible = async (person, date) => (await inspect('select * from public.annual_eligible_dates($1,$2,$2)', [person, date])).length;

const audit = await rows(file('../supabase/audit/025_low_days_and_public_holidays_audit.sql'));
equal(audit.map((result) => result.passed), [true, true, true, true, true]);
await rows('delete from public.rotation_versions where profile_id = $1', [pe]);
await rows('delete from public.schedule_overrides where profile_id = $1', [pe]);
await rows("insert into public.rotation_versions(profile_id,effective_start,pattern) select id,$1,array_fill('morning'::text,array[7]) from public.employee_profiles where id=any($2::uuid[])",
  [await at(-90), [pe, phm, outsider]]);
await rows("insert into public.schedule_overrides(profile_id,shift_date,status_id,note) values($1,$2,'weekend','Off'),($1,$3,'weekend','Off'),($1,$4,'midday','Keep this schedule'),($1,$5,'vacation','Approved Annual')",
  [pe, worked, overdueWork, replacement, staffedDate]);
const balanceBefore = (await profile()).remaining_vacation_days;

await login(lead);
await deny(() => saveHoliday(holidayWork, 'Lead cannot add a holiday', [], true), /Only Admin/);
await deny(() => confirm(outsider, worked), /only confirm work/);
await deny(() => confirm(pe, replacement), /already started/);
await deny(() => confirm(pe, today), /scheduled day off or public holiday/);
await login(admin);
await deny(() => saveHoliday(closedDate, 'Container is invalid', [unit], true), /leaf teams/);
equal((await saveHoliday(closedDate, 'Motion closed', [motion], true)).holidays[0].name, 'Motion closed');
await saveHoliday(holidayWork, 'Organization coverage', [], false);
await saveHoliday(staffedDate, 'Video closure', [edit], true);
await deny(() => saveHoliday(closedDate, 'Duplicate', [], false), /already a public holiday/);
equal(await eligible(pe, closedDate), 1);
equal(await eligible(phm, closedDate), 0);
equal(await eligible(outsider, closedDate), 1);
equal(await eligible(pe, staffedDate), 0);

await login(lead);
const snapshot = (await rows("select public.get_schedule_analytics(extract(year from $1::date)::int,$2) value", [closedDate, edit]))[0].value;
const scopedHoliday = snapshot.publicHolidays.find((holiday) => holiday.date === closedDate);
equal(scopedHoliday.profileIds.includes(phm), true);
equal(scopedHoliday.profileIds.includes(pe), false);
equal(scopedHoliday.departmentIds, []);
const earned = (await confirm(pe, worked)).credit;
equal(earned.due_date, deadline);
equal(earned.reason, 'day_off');
equal(await eligible(pe, worked), 0);
await deny(() => confirm(pe, worked), /already exists/);
equal((await confirm(pe, holidayWork)).credit.reason, 'public_holiday');
const overdue = (await confirm(pe, overdueWork)).credit;
await deny(() => book(overdue.id, today), /upcoming working day/);
await deny(() => book(earned.id, tooLate), /upcoming working day/);
await deny(() => book(earned.id, staffedDate), /regular working day/);
const booked = await book(earned.id, replacement);
equal(booked.override.status_id, 'low_day');
equal(await eligible(pe, replacement), 0);
await deny(() => rows("update public.schedule_overrides set status_id='morning' where id=$1", [booked.override.id]), /Team Alerts/);
await deny(() => rows('delete from public.schedule_overrides where id=$1', [booked.override.id]), /Team Alerts/);
await login(admin);
await deny(() => saveHoliday(replacement, 'Overlapping holiday', [], true), /replacement day is booked/);
await deny(() => rows("insert into public.schedule_overrides(profile_id,shift_date,status_id) values($1,$2,'low_day')", [pe, tooLate]), /Team Alerts/);
await login(artist);
equal((await calendar()).credits.length, 3);
await deny(() => rows('insert into public.vacation_requests(profile_id,start_date,end_date) values($1,$2,$2)', [pe, replacement]), /eligible working day/);
await deny(() => book(earned.id, deadline), /only book replacement/);
await deny(() => confirm(pe, worked), /only confirm work/);
await deny(() => rows('select * from public.low_day_credits'), /permission denied/);
await login(lead);
const moved = await book(earned.id, deadline);
equal(moved.credit.replacement_date, deadline);
equal(moved.restoredOverride.note, 'Keep this schedule');
equal(moved.restoredOverride.status_id, 'midday');
equal(await eligible(pe, deadline), 0);
equal((await book(earned.id, null)).credit.replacement_date, null);
equal(await eligible(pe, deadline), 1);
equal(await eligible(pe, replacement), 1);
equal((await profile()).remaining_vacation_days, balanceBefore);
await login(null, 'anon');
await deny(calendar, /permission denied/);
console.log(`${checks - beforeCalendarChecks} Low Days and public holidays PostgreSQL checks passed.`);

const beforeEventChecks = checks;
await db.exec('reset role');
await db.exec(file('../supabase/migrations/037_schedule_events_and_manager_preview.sql'));
equal((await rows(file('../supabase/audit/026_schedule_events_and_manager_preview_audit.sql')))
  .map((result) => result.passed), [true, true, true, true, true]);
const schedulerTools = async () => (await rows('select public.get_scheduler_tools() value'))[0].value;
const saveEvent = async (name, teamIds, eventId = null, remove = false, endDate = deadline) =>
  (await rows('select public.save_schedule_event($1,$2,$3,$4,$5::uuid[],$6) value',
    [eventId, name, today, endDate, teamIds, remove]))[0].value;

const operationalBefore = await original();
await login(admin);
await deny(() => saveEvent('Invalid team', [unit]), /Choose valid teams/);
await deny(() => saveEvent('Invalid dates', [edit], null, false, worked), /valid date range/);
await saveEvent('Company event', []);
await saveEvent('Motion event', [motion]);
const joint = (await saveEvent('Joint championship', [edit, motion])).events.find((e) => e.title === 'Joint championship');
equal(joint.departmentIds, [edit, motion]);
equal(joint.endsOn, deadline);
await deny(() => rows('select * from public.schedule_events'), /permission denied/);
await login(manager);
const managerTools = await schedulerTools();
equal(managerTools.previewProfiles.find((p) => p.profileId === pe), { profileId: pe, departmentIds: [edit] });
equal(managerTools.previewProfiles.some((p) => [pa, pm, pl, phm, outsider, hybrid].includes(p.profileId)), false);
equal(managerTools.events.map((e) => [e.title, e.departmentIds, e.editable]),
  [['Company event', [], false], ['Joint championship', [edit], false]]);
await deny(() => saveEvent('Company event', []), /Choose only teams/);
await deny(() => saveEvent('Rename', [edit], joint.id), /within your teams/);
const live = (await saveEvent('Live match', [edit])).events.find((e) => e.title === 'Live match');
equal(live.editable, true);
await saveEvent('Live final', [edit], live.id);
await login(lead);
equal((await schedulerTools()).previewProfiles, null);
await login(employeeManager);
equal((await schedulerTools()).previewProfiles, null);
await login(artist);
equal((await schedulerTools()).events.map((e) => e.title), ['Company event', 'Joint championship', 'Live final']);
await deny(() => saveEvent('Employee event', [edit]), /Only Admin and Lead/);
await login(admin);
await saveEvent(null, [], live.id, true);
equal((await schedulerTools()).events.some((e) => e.id === live.id), false);
equal((await inspect("select count(*)::int n from public.audit_log where entity_type='schedule_event'"))[0].n, 6);
await login(null, 'anon');
await deny(schedulerTools, /permission denied/);
await db.exec('reset role');
equal(await original(), operationalBefore);
console.log(`${checks - beforeEventChecks} Scheduler events and manager preview PostgreSQL checks passed.`);

const beforeHolidaySelection = checks;
await db.exec(file('../supabase/migrations/038_scheduler_holiday_selections.sql'));
equal((await rows(file('../supabase/audit/027_scheduler_holiday_selections_audit.sql'))).map((result) => result.passed),
  [true, true, true, true, true]);
const saveHolidaySelection = async (name, cells, batch = null, remove = false) =>
  (await rows('select public.save_scheduler_holiday($1,$2,$3::jsonb,$4) value',
    [batch, name, JSON.stringify(cells.map(([profile_id, day]) => ({ profile_id, day }))), remove]))[0].value;
const [annualDay, sickDay, firstHoliday, secondHoliday] = await Promise.all([-6, -5, -4, -3].map(at));
await rows("insert into public.schedule_overrides(profile_id,shift_date,status_id,note) values($1,$2,'sick','Sick'),($1,$3,'night','Saved shift')",
  [pe, sickDay, firstHoliday]);
await login(lead);
await deny(() => saveHolidaySelection('Cannot save', [[pe, firstHoliday]]), /Only Admin/);
await login(admin);
const batchCalendar = await saveHolidaySelection('Eid', [[pe, firstHoliday], [pe, secondHoliday], [phm, firstHoliday]]);
equal(batchCalendar.holidaySelectionEnabled, true);
const holidayBatch = batchCalendar.holidays.find((h) => h.name === 'Eid').batchId;
equal(batchCalendar.holidays.filter((h) => h.batchId === holidayBatch).map((h) => h.profileIds.length), [2, 1]);
await saveHolidaySelection('Another team', [[outsider, firstHoliday]]);
await deny(() => saveHolidaySelection('Overlapping holiday', [[pe, firstHoliday]]), /already has a public holiday/);
equal(await eligible(pe, firstHoliday), 0);
equal(await eligible(phm, secondHoliday), 1);
await login(lead);
equal((await calendar()).holidays.some((h) => h.name === 'Another team'), false);

const requestId = (await inspect("insert into public.vacation_requests(profile_id,start_date,end_date,status) values($1,$2,$2,'pending') returning id", [pe, annualDay]))[0].id;
await rows("select public.decide_vacation_request($1,'approved')", [requestId]);
const charged = (await profile()).remaining_vacation_days;
const workedAnnual = await confirm(pe, annualDay, 'morning');
equal(workedAnnual.refund.request.deducted_days, 0);
equal(workedAnnual.refund.balance.remaining_days, charged + 1);
equal((await profile()).remaining_vacation_days, charged + 1);
await deny(() => confirm(pe, annualDay), /already exists/);
equal((await confirm(pe, sickDay)).refund, null);
equal((await confirm(pe, firstHoliday)).credit.reason, 'public_holiday');
const updatedAnalytics = (await rows("select public.get_schedule_analytics(extract(year from $1::date)::int,$2) value", [firstHoliday, edit]))[0].value;
equal(updatedAnalytics.publicHolidays.find((h) => h.batchId === holidayBatch && h.date === firstHoliday).profileIds.includes(pe), false);
await login(admin);
await saveHolidaySelection('Eid adjusted', [[pe, secondHoliday]], holidayBatch);
equal((await calendar()).holidays.filter((h) => h.batchId === holidayBatch).map((h) => h.name), ['Eid adjusted']);
await saveHolidaySelection(null, [], holidayBatch, true);
equal((await calendar()).holidays.some((h) => h.batchId === holidayBatch), false);
await login(artist);
await deny(() => confirm(pe, secondHoliday), /only confirm work/);
await db.close();
console.log(`${checks - beforeHolidaySelection} Scheduler holiday selection PostgreSQL checks passed.`);
