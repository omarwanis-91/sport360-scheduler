// Isolated PostgreSQL: real RPC, actual login roles, no production connections.
import assert from 'node:assert/strict';
import { existsSync,readFileSync } from 'node:fs';
import { dirname,join,delimiter } from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveAnalyticsDays,aggregateAnalytics } from '../src/analyticsLogic.mjs';
const runtime=process.env.PATH.split(delimiter).map(bin=>join(dirname(bin),'@electric-sql/pglite')).find(root=>existsSync(join(root,'package.json')));
if(!runtime)throw new Error('Run npm run test:analytics-db.');
const {PGlite}=await import(pathToFileURL(join(runtime,'dist/index.js')).href),db=new PGlite();
const file=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const admin=id(1),lead=id(2),employee=id(3),unclaimed=id(4),parent=id(11),a=id(12),b=id(13),outside=id(14);
const pa=id(21),pl=id(22),pe=id(23),pb=id(24),pu=id(25),po=id(26);
await db.exec(`create role anon;create role authenticated;create schema auth;
 create table auth.users(id uuid primary key,email text);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.uid',true),'')::uuid $$;
 grant usage on schema auth to authenticated,anon;
 insert into auth.users values('${admin}','admin@test'),('${lead}','lead@test'),('${employee}','employee@test'),('${unclaimed}','unclaimed@test');`);
await db.exec(file('../supabase/migrations/001_initial_scheduler_schema.sql').replace('create extension if not exists "pgcrypto";',''));
await db.exec(`alter table public.departments add column parent_department_id uuid;
 alter table public.employee_profiles alter column department_id drop not null;
 create table public.employee_profile_departments(profile_id uuid,department_id uuid,primary key(profile_id,department_id));
 create table public.department_lead_rotation_versions(id uuid primary key default gen_random_uuid(),department_id uuid,effective_start date,pattern jsonb);
 create function public.current_profile_id() returns uuid language sql stable security definer set search_path=public as $$ select id from employee_profiles where user_id=auth.uid() $$;
 create function public.is_claimed_user() returns boolean language sql stable security definer set search_path=public as $$ select public.current_profile_id() is not null $$;
 insert into public.departments(id,name,parent_department_id) values('${parent}','Video Unit',null),('${a}','Video Edit','${parent}'),('${b}','Motion','${parent}'),('${outside}','Hidden',null);
 insert into public.user_roles(user_id,role) values('${admin}','admin'),('${lead}','lead'),('${employee}','employee'),('${unclaimed}','lead');
 insert into public.employee_profiles(id,user_id,department_id,employee_code,email,full_name,title) values
 ('${pa}','${admin}','${parent}','A','admin@test','Admin','Admin'),('${pl}','${lead}','${a}','L','lead@test','Lead','Lead'),
 ('${pe}','${employee}','${a}','E','employee@test','Employee','Editor'),('${pb}',null,'${b}','B','motion@test','Motion person','Editor'),
 ('${pu}',null,null,'U','pending@test','Unassigned person','Pending'),('${po}',null,'${outside}','O','hidden@test','Hidden person','Editor');
 insert into public.employee_profile_departments values('${pl}','${b}'),('${pe}','${outside}');
 insert into public.rotation_versions(profile_id,effective_start,pattern) values
 ('${pl}','2025-01-01',array_fill('night'::text,array[7])),('${pl}','2025-12-01',array_fill('morning'::text,array[7])),
 ('${pl}','2026-11-15',array_fill('night'::text,array[7])),('${pl}','2027-01-01',array_fill('weekend'::text,array[7])),
 ('${pe}','2026-11-01',array_fill('morning'::text,array[7])),('${pb}','2026-11-01',array_fill('midday'::text,array[7])),('${po}','2026-11-01',array_fill('morning'::text,array[7]));
 insert into public.schedule_overrides(profile_id,shift_date,status_id,note) values('${pe}','2026-11-02','vacation','Private reason'),('${pl}','2026-11-03','sick','Private sick note'),('${po}','2026-11-04','vacation','Hidden reason'),('${pe}','2027-01-01','vacation','Next year');
 insert into public.department_lead_rotation_versions(department_id,effective_start,pattern) values
 ('${a}','2025-12-01','["${pl}","${pl}","${pl}","${pl}","${pl}","${pl}","${pl}"]'),
 ('${a}','2026-11-15','["${pe}","${pe}","${pe}","${pe}","${pe}","${pe}","${pe}"]'),
 ('${outside}','2026-01-01','["${po}","${po}","${po}","${po}","${po}","${po}","${po}"]');
 insert into public.department_daily_leads(department_id,lead_profile_id,lead_date) values('${a}','${pe}','2026-11-04'),('${outside}','${po}','2026-11-04');
 insert into public.vacation_requests(profile_id,start_date,end_date,status,reason) values('${pe}','2026-10-30','2026-11-02','pending','Private request'),('${po}','2026-11-01','2026-11-04','pending','Hidden request');`);
const helpers=file('../supabase/migrations/027_strict_role_department_boundaries.sql').split('create or replace function public.profile_is_unassigned')[0];
await db.exec(helpers);
await db.exec(file('../supabase/migrations/034_department_analytics.sql'));
let checks=0;
const rows=async(q,params=[]) => (await db.query(q,params)).rows;
async function login(uid,role='authenticated') {await db.exec(`reset role;set app.uid='${uid||''}';set role ${role};`);}
async function snapshot(dept=null,direct=false,year=2026) {return (await rows('select public.get_schedule_analytics($1,$2,$3) result',[year,dept,direct]))[0].result;}
const check=(actual,expected)=>{assert.deepEqual(actual,expected);checks++;};
await login(admin);const all=await snapshot();check(all.profiles.length,6);check(new Set(all.profiles.map(p=>p.id)).size,6);
check((await snapshot(parent)).profiles.length,4);check((await snapshot(parent,true)).profiles.length,1);
const scoped=await snapshot(a);check(scoped.profiles.length,2);check(scoped.rotationVersions.filter(r=>r.profileId===pl).map(r=>r.effectiveStart).sort(),['2025-12-01','2026-11-15']);
const days=resolveAnalyticsDays(scoped),m=aggregateAnalytics(scoped,days,'2026-11');
check(days.find(d=>d.profileId===pl&&d.date==='2026-11-09').statusId,'lead');
check(days.find(d=>d.profileId===pe&&d.date==='2026-11-16').statusId,'lead');
check(days.find(d=>d.profileId===pl&&d.date==='2026-11-16').statusId,'night');
check(days.find(d=>d.profileId===pe&&d.date==='2026-11-04').statusId,'lead');
check(m.totals.vacation,1);check(m.totals.sick,1);check(m.totals.working,58);check(m.pending,1);
await login(lead);const leadAll=await snapshot();check(leadAll.departments.map(d=>d.id).sort(),[a,b].sort());check(leadAll.profiles.length,3);
check((await snapshot(a)).profiles.length,2);check((await snapshot(b,true)).profiles.length,2);
check(leadAll.profiles.find(p=>p.id===pe).departmentIds,[a]);
for(const key of ['@test','Private','Hidden','remainingVacation','yearlyVacation']){check(JSON.stringify(leadAll).includes(key),false);}
await assert.rejects(()=>snapshot(parent),/denied/);checks++;
await assert.rejects(()=>snapshot(outside),/denied/);checks++;
await assert.rejects(()=>snapshot(id(99)),/denied/);checks++;
await assert.rejects(()=>snapshot(null,false,1999),/2000 and 2100/);checks++;
await assert.rejects(()=>snapshot(null,false,null),/2000 and 2100/);checks++;
await login(employee);await assert.rejects(()=>snapshot(a),/Admin and Lead/);checks++;
await login(unclaimed);await assert.rejects(()=>snapshot(a),/Admin and Lead/);checks++;
await login(null);await assert.rejects(()=>snapshot(),/Admin and Lead/);checks++;
await login(null,'anon');await assert.rejects(()=>snapshot(),/permission denied/);checks++;
await db.exec('reset role');
const audit=await rows(file('../supabase/audit/022_department_analytics_audit.sql'));check(audit.length,5);check(audit.every(r=>r.passed),true);
// The migration and calls are read-only: operational tables retain original counts.
check((await rows('select count(*)::int n from public.schedule_overrides'))[0].n,4);
check((await rows('select count(*)::int n from public.rotation_versions'))[0].n,7);
await db.close();console.log(`${checks} analytics PostgreSQL checks passed.`);
