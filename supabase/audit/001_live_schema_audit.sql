-- Read-only audit. This script does not create, alter, or delete database objects.

-- One consolidated statement for the Supabase SQL editor.
with expected_tables(table_name) as (
  values
    ('departments'),
    ('user_roles'),
    ('employee_profiles'),
    ('shift_statuses'),
    ('rotation_versions'),
    ('schedule_overrides'),
    ('department_daily_leads'),
    ('department_lead_rotation_versions'),
    ('employee_profile_departments'),
    ('vacation_requests'),
    ('audit_log')
),
expected_functions(routine_name) as (
  values
    ('current_role'),
    ('current_profile_department'),
    ('current_profile_id'),
    ('profile_belongs_to_department'),
    ('is_claimed_user'),
    ('claim_profile_for_current_user'),
    ('update_own_profile'),
    ('update_admin_profile'),
    ('delete_admin_profile'),
    ('vacation_workday_count'),
    ('apply_vacation_overrides'),
    ('decide_vacation_request')
),
audit_checks as (
  select
    'table'::text as audit_area,
    expected.table_name as check_name,
    case when actual.table_name is null then 'fail' else 'pass' end as audit_status,
    case when actual.table_name is null then 'missing' else 'present' end as details
  from expected_tables expected
  left join information_schema.tables actual
    on actual.table_schema = 'public'
   and actual.table_name = expected.table_name

  union all

  select
    'rls',
    expected.table_name,
    case when coalesce(relation.relrowsecurity, false) then 'pass' else 'fail' end,
    case when coalesce(relation.relrowsecurity, false) then 'enabled' else 'disabled or missing' end
  from expected_tables expected
  left join (
    select class.relname, class.relrowsecurity
    from pg_catalog.pg_class class
    join pg_catalog.pg_namespace namespace on namespace.oid = class.relnamespace
    where namespace.nspname = 'public'
  ) relation on relation.relname = expected.table_name

  union all

  select
    'function',
    expected.routine_name,
    case when actual.routine_name is null then 'fail' else 'pass' end,
    case when actual.routine_name is null then 'missing' else 'present' end
  from expected_functions expected
  left join information_schema.routines actual
    on actual.routine_schema = 'public'
   and actual.routine_name = expected.routine_name

  union all

  select
    'column',
    'departments.min_available_people',
    case when exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'departments'
        and column_name = 'min_available_people'
    ) then 'pass' else 'fail' end,
    'required coverage target column'

  union all

  select
    'column',
    'employee_profiles.department_id nullable',
    case when exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'employee_profiles'
        and column_name = 'department_id'
        and is_nullable = 'YES'
    ) then 'pass' else 'fail' end,
    'required for unassigned profiles'

  union all

  select
    'column',
    'employee_profiles lead fields',
    case when (
      select count(*)
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'employee_profiles'
        and column_name in ('seniority_level', 'is_department_lead')
    ) = 2 then 'pass' else 'fail' end,
    'seniority and department lead eligibility'

  union all

  select
    'security',
    'apply_vacation_overrides browser execution',
    case when exists (
      select 1
      from information_schema.routine_privileges
      where routine_schema = 'public'
        and routine_name = 'apply_vacation_overrides'
        and grantee in ('PUBLIC', 'anon', 'authenticated')
    ) then 'risk' else 'pass' end,
    case when exists (
      select 1
      from information_schema.routine_privileges
      where routine_schema = 'public'
        and routine_name = 'apply_vacation_overrides'
        and grantee in ('PUBLIC', 'anon', 'authenticated')
    ) then 'browser role can execute internal SECURITY DEFINER helper' else 'not browser-executable' end

  union all

  select
    'security',
    'unclaimed authenticated profile reads',
    case when exists (
      select 1
      from pg_catalog.pg_policies
      where schemaname = 'public'
        and tablename = 'employee_profiles'
        and policyname = 'profiles visible to authenticated'
    ) then 'risk' else 'pass' end,
    case when exists (
      select 1
      from pg_catalog.pg_policies
      where schemaname = 'public'
        and tablename = 'employee_profiles'
        and policyname = 'profiles visible to authenticated'
    ) then 'legacy broad-read policy is active' else 'legacy broad-read policy absent' end
)
select audit_area, check_name, audit_status, details
from audit_checks
order by
  case audit_status when 'fail' then 1 when 'risk' then 2 else 3 end,
  audit_area,
  check_name;
