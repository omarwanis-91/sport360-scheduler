// Run with: npm exec --yes --package=@electric-sql/pglite -- node test/rotationRpc.integration.mjs
// Uses an isolated PostgreSQL engine with minimal authorization fixtures.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, delimiter } from 'node:path';
import { pathToFileURL } from 'node:url';

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
await db.close();
console.log(`${checks} isolated PostgreSQL checks passed, including audit 017.`);
