-- Read-only audit for seniority and department lead rotations.

with checks as (
  select
    'column'::text as audit_area,
    'employee profile seniority'::text as check_name,
    case when exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'employee_profiles'
        and column_name = 'seniority_level'
    ) then 'pass' else 'fail' end as audit_status,
    'employee_profiles.seniority_level'::text as details

  union all

  select
    'column',
    'department lead eligibility',
    case when exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'employee_profiles'
        and column_name = 'is_department_lead'
    ) then 'pass' else 'fail' end,
    'employee_profiles.is_department_lead'

  union all

  select
    'table',
    'department lead rotations',
    case when exists (
      select 1 from information_schema.tables
      where table_schema = 'public'
        and table_name = 'department_lead_rotation_versions'
    ) then 'pass' else 'fail' end,
    'effective-dated weekly lead patterns'

  union all

  select
    'rls',
    'department lead rotations',
    case when exists (
      select 1
      from pg_catalog.pg_class class
      join pg_catalog.pg_namespace namespace on namespace.oid = class.relnamespace
      where namespace.nspname = 'public'
        and class.relname = 'department_lead_rotation_versions'
        and class.relrowsecurity
    ) then 'pass' else 'fail' end,
    'row-level security enabled'

  union all

  select
    'policy',
    expected.policy_name,
    case when exists (
      select 1 from pg_policies policy
      where policy.schemaname = 'public'
        and policy.tablename = 'department_lead_rotation_versions'
        and policy.policyname = expected.policy_name
    ) then 'pass' else 'fail' end,
    'department lead rotation policy'
  from (
    values
      ('claimed users read lead rotations'::text),
      ('admins and leads manage lead rotations'::text)
  ) expected(policy_name)
)
select audit_area, check_name, audit_status, details
from checks
order by case audit_status when 'fail' then 1 else 2 end, audit_area, check_name;
