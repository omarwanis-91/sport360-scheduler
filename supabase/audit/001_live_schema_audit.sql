-- Read-only audit. This script does not create, alter, or delete database objects.

select
  information_table.table_name,
  relation.relrowsecurity as row_security
from information_schema.tables information_table
join pg_catalog.pg_class relation on relation.relname = information_table.table_name
join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
  and namespace.nspname = information_table.table_schema
where information_table.table_schema = 'public'
  and information_table.table_type = 'BASE TABLE'
order by table_name;

select
  table_name,
  ordinal_position,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;

select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_catalog.pg_policies
where schemaname = 'public'
order by tablename, policyname;

select
  routine_name,
  security_type,
  data_type
from information_schema.routines
where routine_schema = 'public'
order by routine_name;

select
  routine_name,
  grantee,
  privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
order by routine_name, grantee;

with expected_tables(table_name) as (
  values
    ('departments'),
    ('user_roles'),
    ('employee_profiles'),
    ('shift_statuses'),
    ('rotation_versions'),
    ('schedule_overrides'),
    ('department_daily_leads'),
    ('vacation_requests'),
    ('audit_log')
)
select
  expected.table_name,
  case when actual.table_name is null then 'missing' else 'present' end as audit_status
from expected_tables expected
left join information_schema.tables actual
  on actual.table_schema = 'public'
 and actual.table_name = expected.table_name
order by expected.table_name;

with expected_functions(routine_name) as (
  values
    ('current_role'),
    ('current_profile_department'),
    ('current_profile_id'),
    ('is_claimed_user'),
    ('claim_profile_for_current_user'),
    ('update_own_profile'),
    ('vacation_workday_count'),
    ('apply_vacation_overrides'),
    ('decide_vacation_request')
)
select
  expected.routine_name,
  case when actual.routine_name is null then 'missing' else 'present' end as audit_status
from expected_functions expected
left join information_schema.routines actual
  on actual.routine_schema = 'public'
 and actual.routine_name = expected.routine_name
order by expected.routine_name;
