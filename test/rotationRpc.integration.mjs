// Run with: npm exec --yes --package=@electric-sql/pglite -- node test/rotationRpc.integration.mjs
// Uses an isolated PostgreSQL engine with minimal authorization fixtures.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, delimiter } from 'node:path';
import { pathToFileURL } from 'node:url';
import { rotationFutureVersions } from '../src/scheduleLogic.mjs';

const runtime = process.env.PATH.split(delimiter).map(bin => join(dirname(bin), '@electric-sql/pglite'))
  .find(root => existsSync(join(root, 'package.json')));
if (!runtime) throw new Error('Run this test using npm exec --package=@electric-sql/pglite.');
const { PGlite } = await import(pathToFileURL(join(runtime, 'dist/index.js')).href);
const db = new PGlite();
const dept = '10000000-0000-0000-0000-000000000001';
const otherDept = '10000000-0000-0000-0000-000000000002';
const person = '20000000-0000-0000-0000-000000000001';
const second = '20000000-0000-0000-0000-000000000002';
const outsider = '20000000-0000-0000-0000-000000000003';
const morning = Array(7).fill('morning');
const night = Array(7).fill('night');

await db.exec(`
  create role anon;
  create role authenticated;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$
    select case when current_setting('app.claimed', true) = 'false' then null
      else '30000000-0000-0000-0000-000000000001'::uuid end
  $$;
  create table public.employee_profiles(id uuid primary key, department_id uuid);
  create table public.rotation_versions(
    id uuid primary key default gen_random_uuid(), profile_id uuid references public.employee_profiles(id),
    effective_start date not null, pattern text[] not null, created_by uuid,
    created_at timestamptz default now()
  );
  create function public.current_role() returns text language sql stable as $$
    select coalesce(nullif(current_setting('app.role', true), ''), 'admin')
  $$;
  create function public.is_claimed_user() returns boolean language sql stable as $$
    select auth.uid() is not null
  $$;
  create function public.current_user_can_manage_department(id uuid) returns boolean language sql stable as $$
    select public.current_role() = 'admin' or (public.current_role() = 'lead' and id = '${dept}')
  $$;
  create function public.profile_directly_belongs_to_department(profile uuid, department uuid) returns boolean language sql stable as $$
    select exists(select 1 from public.employee_profiles where id = profile and department_id = department)
  $$;
  create function public.profile_belongs_to_department(profile uuid, department uuid) returns boolean language sql stable as $$
    select public.profile_directly_belongs_to_department(profile, department)
  $$;
  insert into public.employee_profiles values ('${person}', '${dept}'), ('${second}', '${dept}'), ('${outsider}', '${otherDept}');
`);
await db.exec(readFileSync(new URL('../supabase/migrations/029_direct_rotation_patterns.sql', import.meta.url), 'utf8'));
let checks = 0;
async function call(patterns, date = '2099-01-01', department = dept) {
  return (await db.query('select * from public.apply_rotation_patterns($1::uuid, $2::date, $3::jsonb)', [department, date, JSON.stringify(patterns)])).rows;
}
async function rejected(patterns, message, date, department) {
  const before = (await db.query('select * from public.rotation_versions order by id')).rows;
  await assert.rejects(() => call(patterns, date, department), message);
  assert.deepEqual((await db.query('select * from public.rotation_versions order by id')).rows, before);
  checks++;
}

const historical = await call([{ profileId: person, pattern: morning }], '2000-01-01');
const created = await call([{ profileId: person, pattern: night }]);
const updated = await call([{ profileId: person, pattern: morning }]);
assert.equal(created[0].id, updated[0].id);
assert.deepEqual((await db.query('select * from public.rotation_versions where id = $1', [historical[0].id])).rows, historical);
checks++;

const batch = await call([{ profileId: person, pattern: night }, { profileId: second, pattern: night }]);
assert.equal(batch.length, 2);
assert.deepEqual(batch.map(r => r.pattern), [night, night]);
checks++;

await db.exec("set app.role = 'lead'");
await rejected([{ profileId: person, pattern: morning }, { profileId: outsider, pattern: night }], /direct members/);
await rejected([{ profileId: person, pattern: morning }], /past rotation/, '2000-01-01');
await rejected([{ profileId: outsider, pattern: night }], /inside your department/, '2099-01-01', otherDept);
await rejected([{ profileId: person, pattern: ['morning'] }], /seven weekday/);
await rejected([{ profileId: person, pattern: Array(7).fill('sick') }], /rotational shifts/);
await rejected([{ profileId: person, pattern: night }, { profileId: person, pattern: morning }], /exactly once/);
await rejected([{ profileId: person, pattern: [null, ...morning.slice(1)] }], /rotational shifts/);
await rejected([{ profileId: '20000000-0000-0000-0000-999999999999', pattern: morning }], /not found/);
await db.exec("set app.role = 'employee'");
await rejected([{ profileId: person, pattern: morning }], /inside your department/);
await db.exec("set app.claimed = 'false'");
await rejected([{ profileId: person, pattern: morning }], /Authentication required/);
await db.exec("set app.claimed = 'true'; set app.role = 'admin'; set role anon;");
await assert.rejects(() => call([{ profileId: person, pattern: morning }]), /permission denied/);
await db.exec('reset role');
checks++;

const audit = await db.exec(readFileSync(new URL('../supabase/audit/017_direct_rotation_patterns_audit.sql', import.meta.url), 'utf8'));
for (const result of audit) for (const row of result.rows) assert.equal(row.passed, true, row.check_name);
checks++;
await db.exec(`
  create table public.departments(id uuid primary key);
  insert into public.departments values ('${dept}'), ('${otherDept}');
  create table public.department_lead_rotation_versions (
    id uuid primary key default gen_random_uuid(), department_id uuid not null,
    effective_start date not null, pattern jsonb not null, created_by uuid,
    created_at timestamptz default now(), unique(department_id, effective_start)
  );
  create table public.audit_log (
    id uuid default gen_random_uuid(), actor_id uuid, action text, entity_type text,
    entity_id text, detail jsonb, created_at timestamptz default now()
  );
  create table public.schedule_overrides(id integer primary key, profile_id uuid, status_id text);
  insert into public.schedule_overrides values (1, '${person}', 'sick');
`);
await db.exec(readFileSync(new URL('../supabase/migrations/030_explicit_rotation_leads_and_reset.sql', import.meta.url), 'utf8'));
await db.exec('create trigger validate_leads before insert or update on public.department_lead_rotation_versions for each row execute function public.validate_department_lead_rotation()');
const noLeads = Array(7).fill(false);
const leadMonday = [true, ...noLeads.slice(1)];
async function personSave(id, pattern, days, date = '2099-01-01', department = dept) {
  return (await db.query('select public.save_person_rotation($1::uuid,$2::uuid,$3::date,$4::text[],$5::boolean[]) as result',
    [department, id, date, `{${pattern.join(',')}}`, `{${days.join(',')}}`])).rows[0].result;
}
await personSave(person, morning, noLeads);
assert.equal((await db.query('select count(*)::int as n from public.department_lead_rotation_versions')).rows[0].n, 0);
checks++;
await personSave(person, morning, leadMonday);
let leadRow = (await db.query('select * from public.department_lead_rotation_versions')).rows[0];
assert.deepEqual(leadRow.pattern, [person, '', '', '', '', '', '']);
await personSave(second, night, noLeads);
assert.deepEqual((await db.query('select * from public.department_lead_rotation_versions')).rows[0].pattern, leadRow.pattern);
checks++;
await personSave(second, night, [false, true, ...noLeads.slice(2)]);
await personSave(person, morning, noLeads);
assert.deepEqual((await db.query('select * from public.department_lead_rotation_versions')).rows[0].pattern, ['', second, '', '', '', '', '']);
checks++;
const priorRotations = (await db.query('select * from public.rotation_versions order by id')).rows;
await assert.rejects(() => personSave(person, Array(7).fill('weekend'), leadMonday), /working day/);
await assert.rejects(() => personSave(person, morning, [true]), /seven explicit/);
assert.deepEqual((await db.query('select * from public.rotation_versions order by id')).rows, priorRotations);
checks++;
await db.exec("set app.role = 'lead'");
await assert.rejects(() => personSave(outsider, morning, leadMonday), /direct members/);
await assert.rejects(() => personSave(person, morning, noLeads, '2000-01-01'), /past rotation/);
await assert.rejects(() => db.query('select public.reset_person_rotation($1::uuid)', [person]), /Only Admin/);
await db.exec("set app.role = 'employee'");
await assert.rejects(() => personSave(person, morning, leadMonday), /Not allowed/);
await assert.rejects(() => db.query('select public.reset_person_rotation($1::uuid)', [person]), /Only Admin/);
checks++;
await db.exec("set app.role = 'admin'");
await personSave(person, morning, leadMonday);
const otherVersions = (await db.query('select * from public.rotation_versions where profile_id <> $1 order by id', [person])).rows;
await db.query('select public.reset_person_rotation($1::uuid)', [person]);
assert.equal((await db.query('select count(*)::int as n from public.rotation_versions where profile_id = $1', [person])).rows[0].n, 0);
assert.deepEqual((await db.query('select * from public.rotation_versions where profile_id <> $1 order by id', [person])).rows, otherVersions);
assert.deepEqual((await db.query('select * from public.department_lead_rotation_versions')).rows[0].pattern, ['', second, '', '', '', '', '']);
assert.equal((await db.query('select count(*)::int as n from public.schedule_overrides')).rows[0].n, 1);
assert.equal((await db.query("select count(*)::int as n from public.audit_log where action = 'rotation.reset'")).rows[0].n, 1);
checks++;
const explicitAudit = await db.exec(readFileSync(new URL('../supabase/audit/018_explicit_rotation_leads_and_reset_audit.sql', import.meta.url), 'utf8'));
for (const result of explicitAudit) for (const row of result.rows) assert.equal(row.passed, true, row.check_name);
checks++;
await db.exec(readFileSync(new URL('../supabase/migrations/031_staged_rotation_changes.sql', import.meta.url), 'utf8'));
const draft = (profileId, effectiveStart, pattern = morning, leadDays = Array(7).fill(false), extra = {}) =>
  ({ profileId, effectiveStart, pattern, leadDays, ...extra });
async function saveDrafts(changes, department = dept) {
  return (await db.query('select public.save_rotation_drafts($1::uuid, $2::jsonb) result', [department, JSON.stringify(changes)])).rows[0].result;
}
async function rejectedDrafts(changes, message, department = dept) {
  const before = (await db.query('select * from public.rotation_versions order by id')).rows;
  const leads = (await db.query('select * from public.department_lead_rotation_versions order by id')).rows;
  const auditBefore = (await db.query('select count(*)::int n from public.audit_log')).rows;
  await assert.rejects(() => saveDrafts(changes, department), message);
  assert.deepEqual((await db.query('select * from public.rotation_versions order by id')).rows, before);
  assert.deepEqual((await db.query('select * from public.department_lead_rotation_versions order by id')).rows, leads);
  assert.deepEqual((await db.query('select count(*)::int n from public.audit_log')).rows, auditBefore);
  checks++;
}
const changed = await saveDrafts([draft(person, '2099-03-01', morning, leadMonday), draft(second, '2099-04-01', night)]);
assert.equal(changed.rotations.length, 2);
assert.deepEqual(changed.rotations.map(r => r.effective_start), ['2099-03-01', '2099-04-01']);
const source = changed.rotations[0];
checks++;
await rejectedDrafts([draft(person, '2099-05-01', night, leadMonday), draft(second, '2099-05-01', morning, leadMonday)], /Only one person/);
await rejectedDrafts([draft(person, '2099-05-01', night), draft(outsider, '2099-06-01', morning)], /outside your department/);
await rejectedDrafts([draft(person, '2099-05-01', night), draft(second, '2099-06-01', ['sick'])], /seven weekday/);
const leadBeforePaste = (await db.query('select * from public.department_lead_rotation_versions order by id')).rows;
await saveDrafts([draft(person, '2099-05-01', Array(7).fill('weekend'), Array(7).fill(false), { preserveLeads: true })]);
assert.deepEqual((await db.query('select * from public.department_lead_rotation_versions order by id')).rows, leadBeforePaste);
checks++;
const move = { action: 'move', sourceVersionId: source.id, sourceEffectiveStart: source.effective_start, sourcePattern: source.pattern };
await rejectedDrafts([draft(person, '2099-05-01', morning, leadMonday, move)], /already exists on that date/);
await rejectedDrafts([draft(person, '2099-02-01', morning, leadMonday, { ...move, sourcePattern: night })], /saved version changed/);
const moved = await saveDrafts([draft(person, '2099-03-15', morning, leadMonday, move)]);
assert.equal(moved.rotations[0].id, source.id);
assert.equal(moved.rotations[0].effective_start, '2099-03-15');
assert.equal((await db.query('select count(*)::int n from public.rotation_versions where profile_id=$1 and effective_start=$2', [person, '2099-03-01'])).rows[0].n, 0);
assert.equal((await db.query("select count(*)::int n from public.department_lead_rotation_versions where department_id=$1 and effective_start='2099-03-01' and pattern->>0=$2", [dept, person])).rows[0].n, 0);
assert.equal((await db.query("select pattern->>0 value from public.department_lead_rotation_versions where department_id=$1 and effective_start='2099-03-15'", [dept])).rows[0].value, person);
checks++;
await saveDrafts([draft(person, '2099-02-15', morning, leadMonday, { ...move, sourceEffectiveStart: '2099-03-15' })]);
assert.equal((await db.query("select pattern->>0 value from public.department_lead_rotation_versions where department_id=$1 and effective_start='2099-03-15'", [dept])).rows[0].value, person);
assert.equal((await db.query("select pattern->>0 value from public.department_lead_rotation_versions where department_id=$1 and effective_start='2099-02-15'", [dept])).rows[0].value, person);
checks++;
await db.exec("set app.role='lead'");
await rejectedDrafts([draft(person, '2099-06-01', morning, leadMonday, { ...move, sourceEffectiveStart: '2099-03-15' })], /Only Admin/);
await rejectedDrafts([{ profileId: person, action: 'reset' }], /Only Admin/);
await rejectedDrafts([draft(person, '2000-01-01')], /past rotation/);
await rejectedDrafts([draft(outsider, '2099-07-01')], /outside your department/);
await rejectedDrafts([draft(outsider, '2099-07-01')], /Not allowed/, otherDept);
await db.exec("set app.role='employee'");
await rejectedDrafts([draft(person, '2099-07-01')], /Not allowed/);
await db.exec("set app.role='admin'; set role anon;");
await assert.rejects(() => saveDrafts([draft(person, '2099-07-01')]), /permission denied/);
await db.exec('reset role'); checks++;
const finalReset = await saveDrafts([{ profileId: person, action: 'reset' }, draft(second, '2099-08-01', night)]);
assert.deepEqual(finalReset.reset_profile_ids, [person]);
assert.equal((await db.query('select count(*)::int n from public.rotation_versions where profile_id=$1', [person])).rows[0].n, 0);
assert.equal((await db.query('select count(*)::int n from public.schedule_overrides')).rows[0].n, 1);
checks++;
const draftAudit = await db.exec(readFileSync(new URL('../supabase/audit/019_staged_rotation_changes_audit.sql', import.meta.url), 'utf8'));
for (const result of draftAudit) for (const row of result.rows) assert.equal(row.passed, true, row.check_name);
checks++;
await db.exec(readFileSync(new URL('../supabase/migrations/032_rotation_future_version_review.sql', import.meta.url), 'utf8'));
await db.query('select public.save_reviewed_rotation_drafts($1::uuid,$2::jsonb)', [dept, JSON.stringify([draft(second,'2099-09-01',night)])]);
checks++;
await db.exec('delete from public.rotation_versions; delete from public.department_lead_rotation_versions;');
await call([draft(person, '', night), draft(second, '', morning)], '2099-11-08');
await db.query('insert into public.department_lead_rotation_versions(department_id,effective_start,pattern) values ($1,$2,$3::jsonb),($1,$4,$5::jsonb),($6,$2,$7::jsonb)',
  [dept, '2099-11-08', JSON.stringify(Array(7).fill('')), '2099-11-15', JSON.stringify(['', second, '', '', '', '', '']), otherDept, JSON.stringify(Array(7).fill(outsider))]);
async function reviewed(change, policy = 'replace') {
  const rotations = (await db.query('select id, profile_id, effective_start::text, pattern from public.rotation_versions')).rows.map(row => ({ id:row.id, profileId:row.profile_id, effectiveStart:row.effective_start, pattern:row.pattern }));
  const leads = (await db.query('select id, department_id, effective_start::text, pattern from public.department_lead_rotation_versions')).rows.map(row => ({ id:row.id, departmentId:row.department_id, effectiveStart:row.effective_start, pattern:row.pattern }));
  return { ...change, futurePolicy:policy, expectedFuture:rotationFutureVersions({rotationVersions:rotations, departmentLeadRotations:leads}, dept, change) };
}
const backdated = draft(person, '2099-11-01', morning, leadMonday);
await rejectedDrafts([backdated], /Later versions exist/);
await rejectedDrafts([{ ...backdated, futurePolicy:'replace' }], /Later versions changed/);
await rejectedDrafts([{ ...backdated, futurePolicy:'discard' }], /Unknown later/);
const kept = await saveDrafts([await reviewed(backdated, 'keep')]);
assert.equal(kept.removed_rotation_ids.length, 0);
assert.equal((await db.query("select pattern->>0 value from public.department_lead_rotation_versions where department_id=$1 and effective_start='2099-11-08'", [dept])).rows[0].value, '');
checks++;
const staleReview = await reviewed(backdated);
await db.query('insert into public.department_lead_rotation_versions(department_id,effective_start,pattern) values ($1,$2,$3::jsonb)', [dept, '2099-11-22', JSON.stringify(Array(7).fill(''))]);
await rejectedDrafts([staleReview], /Later versions changed/);
const replaced = await saveDrafts([await reviewed(backdated)]);
assert.equal(replaced.removed_rotation_ids.length, 1);
assert.equal((await db.query("select count(*)::int n from public.rotation_versions where profile_id=$1 and effective_start>'2099-11-01'", [person])).rows[0].n, 0);
for (const date of ['2099-11-08','2099-11-15','2099-11-22']) {
  assert.equal((await db.query('select pattern->>0 value from public.department_lead_rotation_versions where department_id=$1 and effective_start=$2', [dept,date])).rows[0].value, person);
}
assert.equal((await db.query("select pattern->>1 value from public.department_lead_rotation_versions where department_id=$1 and effective_start='2099-11-15'", [dept])).rows[0].value, second);
assert.equal((await db.query('select pattern->>0 value from public.department_lead_rotation_versions where department_id=$1', [otherDept])).rows[0].value, outsider);
assert.equal((await db.query('select count(*)::int n from public.schedule_overrides')).rows[0].n, 1);
checks++;
await saveDrafts([await reviewed(backdated), await reviewed(draft(second, '2099-11-15', morning, leadMonday))]);
assert.equal((await db.query("select pattern->>0 value from public.department_lead_rotation_versions where department_id=$1 and effective_start='2099-11-08'", [dept])).rows[0].value, person);
assert.equal((await db.query("select pattern->>0 value from public.department_lead_rotation_versions where department_id=$1 and effective_start='2099-11-15'", [dept])).rows[0].value, second);
checks++;
await call([draft(person, '', night)], '2099-12-01');
await rejectedDrafts([await reviewed(backdated), await reviewed(draft(second,'2099-11-16',['sick']))], /seven weekday/);
await db.exec("set app.role='lead'");
await rejectedDrafts([await reviewed(draft(person, '2000-01-01'))], /past rotation/);
await rejectedDrafts([await reviewed(draft(outsider, '2099-12-01'))], /outside your department/);
await saveDrafts([await reviewed(draft(person,'2099-11-01',night))]);
checks++;
await db.exec("set app.role='employee'");
await rejectedDrafts([backdated], /Not allowed/);
await db.exec("set app.role='admin'");
for (const auditPath of ['019_staged_rotation_changes_audit.sql','020_rotation_future_version_review_audit.sql']) {
  const results = await db.exec(readFileSync(new URL(`../supabase/audit/${auditPath}`, import.meta.url), 'utf8'));
  for (const result of results) for (const row of result.rows) assert.equal(row.passed, true, row.check_name);
}
checks++;
await db.close();
console.log(`${checks} isolated PostgreSQL checks passed, including audits 017–020.`);
