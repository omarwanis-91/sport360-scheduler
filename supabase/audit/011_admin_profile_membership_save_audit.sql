-- Read-only audit for Admin profile saves with equal department memberships.

with audit_checks as (
  select
    'function'::text as audit_area,
    'save_admin_profile exists'::text as check_name,
    case when exists (
      select 1
      from pg_catalog.pg_proc procedure
      join pg_catalog.pg_namespace namespace on namespace.oid = procedure.pronamespace
      where namespace.nspname = 'public'
        and procedure.proname = 'save_admin_profile'
        and procedure.pronargs = 11
    ) then 'pass' else 'fail' end as audit_status,
    'profile fields and membership ids are saved together'::text as details

  union all

  select
    'security',
    'save_admin_profile authenticated execute',
    case when has_function_privilege(
      'authenticated',
      'public.save_admin_profile(uuid, text, text, text, text, text, uuid[], text, integer, integer, uuid)',
      'execute'
    ) then 'pass' else 'fail' end,
    'browser users can call the guarded Admin RPC'

  union all

  select
    'table',
    'employee_profile_departments exists',
    case when exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = 'employee_profile_departments'
    ) then 'pass' else 'fail' end,
    'durable equal department memberships'
)
select audit_area, check_name, audit_status, details
from audit_checks
order by
  case audit_status when 'fail' then 1 else 2 end,
  audit_area,
  check_name;
